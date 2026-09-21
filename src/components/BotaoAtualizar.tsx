import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { getVersion } from "@tauri-apps/api/app";
import { dentroDoTauri } from "./BotoesJanela";

type Estado =
  | { tipo: "parado" }
  | { tipo: "a-verificar" }
  | { tipo: "em-dia" }
  | { tipo: "disponivel"; atualizacao: Update }
  | { tipo: "a-descarregar"; percentagem: number }
  | { tipo: "instalada" }
  | { tipo: "erro"; mensagem: string };

/**
 * Procura versões novas publicadas no GitHub (ver .github/workflows/release.yml).
 * Verifica sozinho ao abrir a app, em silêncio; o botão serve para voltar a ver.
 */
export default function BotaoAtualizar() {
  const [estado, setEstado] = useState<Estado>({ tipo: "parado" });
  const [versao, setVersao] = useState("");

  const verificar = useCallback(async (silencioso: boolean) => {
    if (!silencioso) setEstado({ tipo: "a-verificar" });
    try {
      const atualizacao = await check();
      if (atualizacao) {
        setEstado({ tipo: "disponivel", atualizacao });
      } else if (!silencioso) {
        setEstado({ tipo: "em-dia" });
        window.setTimeout(() => setEstado({ tipo: "parado" }), 3000);
      }
    } catch (causa) {
      // Ao arrancar sem internet não vale a pena incomodar ninguém.
      if (silencioso) return;
      setEstado({ tipo: "erro", mensagem: String(causa) });
      window.setTimeout(() => setEstado({ tipo: "parado" }), 6000);
    }
  }, []);

  useEffect(() => {
    if (!dentroDoTauri()) return;
    getVersion().then(setVersao).catch(() => {});
    verificar(true);
  }, [verificar]);

  if (!dentroDoTauri()) return null;

  const instalar = async () => {
    if (estado.tipo !== "disponivel") return;

    let recebido = 0;
    let total = 0;

    try {
      await estado.atualizacao.downloadAndInstall((progresso) => {
        if (progresso.event === "Started") {
          total = progresso.data.contentLength ?? 0;
          setEstado({ tipo: "a-descarregar", percentagem: 0 });
        } else if (progresso.event === "Progress") {
          recebido += progresso.data.chunkLength;
          setEstado({
            tipo: "a-descarregar",
            percentagem: total > 0 ? Math.round((recebido / total) * 100) : 0,
          });
        }
      });
      // No Windows o instalador fecha e volta a abrir a app sozinho; nos outros
      // sistemas chega-se aqui e reinicia-se à mão.
      setEstado({ tipo: "instalada" });
    } catch (causa) {
      setEstado({ tipo: "erro", mensagem: String(causa) });
    }
  };

  // Um botão só: o texto e o que ele faz mudam com o estado.
  const botao = (() => {
    switch (estado.tipo) {
      case "a-verificar":
        return { rotulo: "A procurar…", classe: "", acao: undefined };
      case "em-dia":
        return { rotulo: "Já está atualizada", classe: "ok", acao: undefined };
      case "disponivel":
        return {
          rotulo: `Instalar v${estado.atualizacao.version}`,
          classe: "novo",
          acao: instalar,
          dica: estado.atualizacao.body ?? undefined,
        };
      case "a-descarregar":
        return {
          rotulo: `A descarregar ${estado.percentagem}%`,
          classe: "a-descarregar",
          acao: undefined,
          progresso: estado.percentagem,
        };
      case "instalada":
        return { rotulo: "Reiniciar agora", classe: "novo", acao: () => relaunch() };
      case "erro":
        return {
          rotulo: "Não foi possível atualizar",
          classe: "erro",
          acao: () => setEstado({ tipo: "parado" }),
          dica: estado.mensagem,
        };
      default:
        return { rotulo: "Atualizar", classe: "", acao: () => verificar(false) };
    }
  })();

  return (
    <div className="atualizar">
      {versao ? <span className="versao-app">v{versao}</span> : null}
      <button
        type="button"
        className={`botao-atualizar ${botao.classe}`}
        onClick={botao.acao}
        disabled={!botao.acao}
        title={"dica" in botao ? botao.dica : undefined}
        style={
          "progresso" in botao
            ? ({ "--progresso": `${botao.progresso}%` } as CSSProperties)
            : undefined
        }
      >
        {botao.rotulo}
      </button>
    </div>
  );
}
