import { useCallback, useEffect, useMemo, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import * as api from "../lib/api";
import { dataPorExtenso, hoje, somarDias } from "../lib/datas";
import { contarCaracteres, escreverMensagem, linkWhatsApp } from "../lib/mensagens";
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

export default function MensagensView({
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
  const [aEditarModelo, setAEditarModelo] = useState(false);
  const [aGuardarModelo, setAGuardarModelo] = useState(false);

  const carregar = useCallback(async () => {
    setACarregar(true);
    try {
      const doDia = await api.listarAgendamentos(dia, dia);
      setMarcacoes(doDia);
    } catch (causa) {
      onErro(causa instanceof Error ? causa.message : "Não foi possível carregar o dia.");
    } finally {
      setACarregar(false);
    }
  }, [dia, onErro]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    setModelo(configuracoes.modeloLembrete);
  }, [configuracoes.modeloLembrete]);

  const textoDe = useCallback(
    (marcacao: Agendamento) =>
      escreverMensagem(
        modelo,
        marcacao,
        servicos.find((item) => item.id === marcacao.servicoId),
        funcionarios.find((item) => item.id === marcacao.funcionarioId),
      ),
    [funcionarios, modelo, servicos],
  );

  const porAvisar = marcacoes.filter((item) => !item.lembreteEnviado);
  const semTelefone = marcacoes.filter((item) => !linkWhatsApp(item.telefone, "x"));

  const exemplo = useMemo(() => {
    if (marcacoes.length > 0) return textoDe(marcacoes[0]);
    return modelo;
  }, [marcacoes, modelo, textoDe]);

  const contagem = contarCaracteres(exemplo);

  const marcarComoAvisado = async (marcacao: Agendamento, mensagem: string) => {
    try {
      await api.registarLembrete({
        agendamentoId: marcacao.id,
        destinatario: marcacao.telefone,
        mensagem,
      });
      setMarcacoes((anteriores) =>
        anteriores.map((item) =>
          item.id === marcacao.id ? { ...item, lembreteEnviado: true } : item,
        ),
      );
    } catch (causa) {
      onErro(causa instanceof Error ? causa.message : "Não foi possível registar a mensagem.");
    }
  };

  const abrirWhatsApp = async (marcacao: Agendamento) => {
    const mensagem = textoDe(marcacao);
    const link = linkWhatsApp(marcacao.telefone, mensagem);

    if (!link) {
      onErro(`${marcacao.cliente} não tem um telefone válido na ficha.`);
      return;
    }

    try {
      if (dentroDoTauri()) {
        await openUrl(link);
      } else {
        window.open(link, "_blank");
      }
      await marcarComoAvisado(marcacao, mensagem);
    } catch (causa) {
      onErro(causa instanceof Error ? causa.message : "Não foi possível abrir o WhatsApp.");
    }
  };

  const copiar = async (marcacao: Agendamento) => {
    const mensagem = textoDe(marcacao);
    try {
      await navigator.clipboard.writeText(mensagem);
      onAviso("Mensagem copiada.");
    } catch {
      onErro("Não foi possível copiar. Seleciona o texto à mão.");
    }
  };

  const anular = async (marcacao: Agendamento) => {
    try {
      await api.anularLembrete(marcacao.id);
      setMarcacoes((anteriores) =>
        anteriores.map((item) =>
          item.id === marcacao.id ? { ...item, lembreteEnviado: false } : item,
        ),
      );
    } catch (causa) {
      onErro(causa instanceof Error ? causa.message : "Não foi possível anular.");
    }
  };

  const guardarModelo = async () => {
    setAGuardarModelo(true);
    try {
      await api.guardarModeloLembrete(modelo);
      onConfiguracoesAlteradas();
      setAEditarModelo(false);
      onAviso("Texto da mensagem guardado.");
    } catch (causa) {
      onErro(causa instanceof Error ? causa.message : "Não foi possível guardar o texto.");
    } finally {
      setAGuardarModelo(false);
    }
  };

  return (
    <section className="pagina-lista">
      <div className="cartao">
        <div className="cartao-topo">
          <div>
            <h2>Lembretes</h2>
            <p className="subtitulo">
              {dataPorExtenso(dia)} · {marcacoes.length} marcações ·{" "}
              {porAvisar.length} por avisar
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
              <input
                type="date"
                className="data-lembretes"
                value={dia}
                onChange={(evento) => evento.target.value && setDia(evento.target.value)}
              />
              <button
                type="button"
                className="seta"
                onClick={() => setDia(somarDias(dia, 1))}
                aria-label="Dia seguinte"
              >
                ›
              </button>
            </div>
            <button
              type="button"
              className="ghost-button"
              onClick={() => setDia(somarDias(hoje(), 1))}
            >
              Amanhã
            </button>
          </div>
        </div>

        <div className="caixa-modelo">
          <div className="modelo-topo">
            <strong>Texto da mensagem</strong>
            <button
              type="button"
              className="ghost-button"
              onClick={() => setAEditarModelo((anterior) => !anterior)}
            >
              {aEditarModelo ? "Fechar" : "Editar"}
            </button>
          </div>

          {aEditarModelo ? (
            <>
              <textarea
                rows={3}
                value={modelo}
                onChange={(evento) => setModelo(evento.target.value)}
              />
              <p className="dica">
                Campos disponíveis: {"{cliente}"} {"{nome}"} {"{dia}"} {"{data}"} {"{hora}"}{" "}
                {"{servico}"} {"{funcionaria}"}
              </p>
              <div className="modal-actions-direita">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    setModelo(configuracoes.modeloLembrete);
                    setAEditarModelo(false);
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={guardarModelo}
                  disabled={aGuardarModelo}
                >
                  {aGuardarModelo ? "A guardar..." : "Guardar texto"}
                </button>
              </div>
            </>
          ) : (
            <p className="exemplo-mensagem">{exemplo}</p>
          )}

          <p className="dica">
            {contagem.total} caracteres
            {contagem.temAcentos
              ? " · com acentos, uma SMS leva só 70 caracteres (tira-os se um dia enviares por SMS)"
              : " · sem acentos, cabe numa SMS de 160"}
          </p>
        </div>

        {aCarregar ? (
          <div className="estado-vazio">A carregar...</div>
        ) : marcacoes.length === 0 ? (
          <div className="estado-vazio">Não há marcações neste dia.</div>
        ) : (
          <ul className="lista-registos ampla">
            {marcacoes.map((marcacao) => {
              const servico = servicos.find((item) => item.id === marcacao.servicoId);
              const temTelefone = linkWhatsApp(marcacao.telefone, "x") !== null;

              return (
                <li key={marcacao.id} className={marcacao.lembreteEnviado ? "avisado" : ""}>
                  <div>
                    <strong>
                      {marcacao.inicio} · {marcacao.cliente}
                    </strong>
                    <span>
                      {servico?.nome ?? "Serviço"} ·{" "}
                      {temTelefone ? marcacao.telefone : "sem telefone válido"}
                    </span>
                  </div>

                  <div className="acoes-registo">
                    {marcacao.lembreteEnviado ? (
                      <>
                        <span className="etiqueta-avisado">Avisado</span>
                        <button type="button" className="ghost-button" onClick={() => anular(marcacao)}>
                          Anular
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => copiar(marcacao)}
                        >
                          Copiar
                        </button>
                        <button
                          type="button"
                          className="primary-button"
                          onClick={() => abrirWhatsApp(marcacao)}
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
            {semTelefone.length === 1 ? "cliente sem telefone" : "clientes sem telefone"} na
            ficha — esses têm de ser avisados por telefone.
          </p>
        ) : null}
      </div>
    </section>
  );
}
