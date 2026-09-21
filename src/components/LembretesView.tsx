import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import * as api from "../lib/api";
import { dataPorExtenso, hoje, somarDias } from "../lib/datas";
import {
  agruparEmVisitas,
  escreverMensagem,
  linkSms,
  linkWhatsApp,
  nomesDosServicos,
  type Visita,
} from "../lib/mensagens";
import { dentroDoTauri } from "./BotoesJanela";
import type { Agendamento, Configuracoes, Funcionario, Servico } from "../lib/types";

type Props = {
  configuracoes: Configuracoes;
  funcionarios: Funcionario[];
  servicos: Servico[];
  onConfiguracoesAlteradas: () => void;
  onErro: (mensagem: string) => void;
  onAviso: (mensagem: string) => void;
};

/** Telemóvel ou tablet: aí faz sentido abrir as Mensagens para enviar por SMS. */
const ecraTatil = () =>
  typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

/**
 * Lembretes sem custos: a app escreve a mensagem e abre o WhatsApp (ou as Mensagens
 * do telemóvel) com ela pronta; quem está ao balcão só carrega em enviar.
 */
export default function LembretesView({
  configuracoes,
  funcionarios,
  servicos,
  onConfiguracoesAlteradas,
  onErro,
  onAviso,
}: Props) {
  const [dia, setDia] = useState(() => somarDias(hoje(), 1));
  const [marcacoes, setMarcacoes] = useState<Agendamento[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  const [modelo, setModelo] = useState(configuracoes.modeloLembrete);
  const [aGuardarModelo, setAGuardarModelo] = useState(false);
  const tatil = useMemo(ecraTatil, []);

  const carregar = useCallback(async () => {
    setACarregar(true);
    try {
      setMarcacoes(await api.listarAgendamentos(dia, dia));
    } catch (causa) {
      onErro(causa instanceof Error ? causa.message : "Não foi possível carregar o dia.");
    } finally {
      setACarregar(false);
    }
  }, [dia, onErro]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Se o texto mudar noutro aparelho, acompanha, a não ser que se esteja a escrevê-lo aqui.
  const alterado = modelo !== configuracoes.modeloLembrete;
  const textoGuardado = useRef(configuracoes.modeloLembrete);
  useEffect(() => {
    setModelo((atual) => (atual === textoGuardado.current ? configuracoes.modeloLembrete : atual));
    textoGuardado.current = configuracoes.modeloLembrete;
  }, [configuracoes.modeloLembrete]);

  const visitas = useMemo(() => agruparEmVisitas(marcacoes), [marcacoes]);
  const porAvisar = visitas.filter((visita) => !visita.avisada);
  const semTelefone = visitas.filter((visita) => !linkWhatsApp(visita.telefone, "x"));

  const textoDe = useCallback(
    (visita: Visita) => escreverMensagem(modelo, visita, servicos, funcionarios),
    [funcionarios, modelo, servicos],
  );

  const exemplo = visitas.length > 0 ? textoDe(visitas[0]) : modelo;

  const mudarAvisada = (visita: Visita, avisada: boolean) => {
    const ids = new Set(visita.marcacoes.map((item) => item.id));
    setMarcacoes((anteriores) =>
      anteriores.map((item) => (ids.has(item.id) ? { ...item, lembreteEnviado: avisada } : item)),
    );
  };

  const marcarComoAvisada = async (visita: Visita, mensagem: string) => {
    try {
      for (const marcacao of visita.marcacoes) {
        await api.registarLembrete({
          agendamentoId: marcacao.id,
          destinatario: visita.telefone,
          mensagem,
        });
      }
      mudarAvisada(visita, true);
    } catch (causa) {
      onErro(causa instanceof Error ? causa.message : "Não foi possível registar o lembrete.");
    }
  };

  const abrir = async (link: string) => {
    if (dentroDoTauri()) {
      await openUrl(link);
    } else if (link.startsWith("sms:")) {
      window.location.href = link;
    } else {
      window.open(link, "_blank", "noopener");
    }
  };

  const enviar = async (visita: Visita, meio: "whatsapp" | "sms") => {
    const mensagem = textoDe(visita);
    const link =
      meio === "whatsapp" ? linkWhatsApp(visita.telefone, mensagem) : linkSms(visita.telefone, mensagem);

    if (!link) {
      onErro(`${visita.cliente} não tem um telefone válido na ficha.`);
      return;
    }

    try {
      await abrir(link);
      await marcarComoAvisada(visita, mensagem);
    } catch (causa) {
      onErro(
        causa instanceof Error
          ? causa.message
          : meio === "whatsapp"
            ? "Não foi possível abrir o WhatsApp."
            : "Não foi possível abrir as Mensagens.",
      );
    }
  };

  const copiar = async (visita: Visita) => {
    const mensagem = textoDe(visita);
    try {
      await navigator.clipboard.writeText(mensagem);
    } catch {
      onErro("Não foi possível copiar. Seleciona o texto à mão.");
      return;
    }
    await marcarComoAvisada(visita, mensagem);
    onAviso("Mensagem copiada. Ficou marcada como avisada.");
  };

  const anular = async (visita: Visita) => {
    try {
      for (const marcacao of visita.marcacoes) {
        await api.anularLembrete(marcacao.id);
      }
      mudarAvisada(visita, false);
    } catch (causa) {
      onErro(causa instanceof Error ? causa.message : "Não foi possível anular.");
    }
  };

  const guardarModelo = async () => {
    setAGuardarModelo(true);
    try {
      await api.guardarModeloLembrete(modelo);
      onConfiguracoesAlteradas();
      onAviso("Texto da mensagem guardado.");
    } catch (causa) {
      onErro(causa instanceof Error ? causa.message : "Não foi possível guardar o texto.");
    } finally {
      setAGuardarModelo(false);
    }
  };

  const amanha = somarDias(hoje(), 1);

  return (
    <section className="pagina-lista">
      <div className="cartao">
        <div className="cartao-topo">
          <div>
            <h2>Lembretes</h2>
            <p className="subtitulo">
              {visitas.length === 0
                ? "Sem marcações neste dia"
                : `${visitas.length} ${visitas.length === 1 ? "cliente" : "clientes"} · ${
                    porAvisar.length === 0 ? "todos avisados" : `${porAvisar.length} por avisar`
                  }`}
            </p>
          </div>

          <div className="acoes-registo">
            <div className="navegador-data">
              <button
                type="button"
                className="seta"
                onClick={() => setDia(somarDias(dia, -1))}
                aria-label="Dia anterior"
              >
                ‹
              </button>
              <label className="data-lembretes">
                <span>{dataPorExtenso(dia)}</span>
                <input
                  type="date"
                  value={dia}
                  onChange={(evento) => evento.target.value && setDia(evento.target.value)}
                  onClick={(evento) => {
                    try {
                      evento.currentTarget.showPicker();
                    } catch {
                      // browsers antigos abrem o calendário sozinhos
                    }
                  }}
                  aria-label="Escolher o dia"
                />
              </label>
              <button
                type="button"
                className="seta"
                onClick={() => setDia(somarDias(dia, 1))}
                aria-label="Dia seguinte"
              >
                ›
              </button>
            </div>
            {dia !== amanha ? (
              <button type="button" className="ghost-button" onClick={() => setDia(amanha)}>
                Amanhã
              </button>
            ) : null}
          </div>
        </div>

        <div className="caixa-modelo">
          <label className="modelo-topo" htmlFor="texto-lembrete">
            <strong>Texto da mensagem</strong>
          </label>
          <textarea
            id="texto-lembrete"
            rows={3}
            value={modelo}
            onChange={(evento) => setModelo(evento.target.value)}
          />
          <p className="dica">
            Preenchem-se sozinhos: {"{cliente}"} (primeiro nome) {"{nome}"} {"{dia}"} {"{data}"}{" "}
            {"{hora}"} {"{servico}"} {"{funcionaria}"}
          </p>

          {visitas.length > 0 ? (
            <>
              <span className="exemplo-rotulo">Assim fica para {visitas[0].cliente}:</span>
              <p className="exemplo-mensagem">{exemplo}</p>
            </>
          ) : null}

          {alterado ? (
            <div className="modal-actions-direita">
              <button
                type="button"
                className="ghost-button"
                onClick={() => setModelo(configuracoes.modeloLembrete)}
              >
                Repor o texto guardado
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={guardarModelo}
                disabled={aGuardarModelo}
              >
                {aGuardarModelo ? "A guardar..." : "Guardar para as próximas vezes"}
              </button>
            </div>
          ) : null}
        </div>

        {aCarregar ? (
          <div className="estado-vazio">A carregar...</div>
        ) : visitas.length === 0 ? (
          <div className="estado-vazio">Não há marcações neste dia.</div>
        ) : (
          <ul className="lista-registos ampla lista-lembretes">
            {visitas.map((visita) => {
              const temTelefone = linkWhatsApp(visita.telefone, "x") !== null;

              return (
                <li key={visita.chave} className={visita.avisada ? "avisado" : ""}>
                  <div>
                    <strong>
                      {visita.inicio} · {visita.cliente}
                    </strong>
                    <span>
                      {nomesDosServicos(visita, servicos) || "Serviço"} ·{" "}
                      {temTelefone ? visita.telefone : "sem telefone válido"}
                    </span>
                  </div>

                  <div className="acoes-registo">
                    {visita.avisada ? (
                      <>
                        <span className="etiqueta-avisado">Avisado</span>
                        <button type="button" className="ghost-button" onClick={() => anular(visita)}>
                          Anular
                        </button>
                      </>
                    ) : (
                      <>
                        {tatil ? (
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => enviar(visita, "sms")}
                            disabled={!temTelefone}
                          >
                            SMS
                          </button>
                        ) : (
                          <button type="button" className="ghost-button" onClick={() => copiar(visita)}>
                            Copiar
                          </button>
                        )}
                        <button
                          type="button"
                          className="primary-button"
                          onClick={() => enviar(visita, "whatsapp")}
                          disabled={!temTelefone}
                          title={
                            temTelefone
                              ? "Abrir o WhatsApp com a mensagem escrita"
                              : "Este cliente não tem telefone na ficha"
                          }
                        >
                          WhatsApp
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {semTelefone.length > 0 ? (
          <p className="dica">
            {semTelefone.length}{" "}
            {semTelefone.length === 1 ? "cliente sem telefone" : "clientes sem telefone"} na ficha:
            esses têm de ser avisados por chamada.
          </p>
        ) : null}
      </div>
    </section>
  );
}
