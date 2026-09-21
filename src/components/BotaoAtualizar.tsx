import { useCallback, useEffect, useState } from "react";
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

  const conteudo = () => {
    if (estado.tipo === "a-verificar") {
      return <span className="atualizar-texto">A procurar...</span>;
    }

    if (estado.tipo === "em-dia") {
      return <span className="atualizar-texto ok">✓ Versão mais recente</span>;
    }

    if (estado.tipo === "disponivel") {
      return (
        <button
          type="button"
          className="atualizar-disponivel"
          onClick={instalar}
          title={estado.atualizacao.body ?? undefined}
        >
          Instalar v{estado.atualizacao.version}
        </button>
      );
    }

    if (estado.tipo === "a-descarregar") {
      return (
        <span className="atualizar-progresso" title={`${estado.percentagem}%`}>
          <span style={{ width: `${estado.percentagem}%` }} />
        </span>
      );
    }

    if (estado.tipo === "instalada") {
      return (
        <button type="button" className="atualizar-disponivel" onClick={() => relaunch()}>
          Reiniciar agora
        </button>
      );
    }

    if (estado.tipo === "erro") {
      return (
        <button
          type="button"
          className="atualizar-texto erro"
          onClick={() => setEstado({ tipo: "parado" })}
          title={estado.mensagem}
        >
          ⚠ Não deu para atualizar
        </button>
      );
    }

    return (
      <button
        type="button"
        className="janela-botao"
        onClick={() => verificar(false)}
        aria-label="Procurar atualizações"
        title="Procurar atualizações"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
        </svg>
      </button>
    );
  };

  return (
    <div className="atualizar">
      {versao ? <span className="versao-app">v{versao}</span> : null}
      {conteudo()}
    </div>
  );
}
