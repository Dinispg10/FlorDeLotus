import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import {
  ausenciasDoDia,
  corComTransparencia,
  distribuirEmFaixas,
  horarioDoDia,
  intervaloDaGrelha,
  descreverDiaEspecial,
  diaEspecialDe,
} from "../lib/agenda";
import {
  abreviaturaDiaSemana,
  dataCompacta,
  gerarHoras,
  hoje,
  inicioDaSemana,
  minutosDesdeMeiaNoite,
  numeroDoDia,
  somarDias,
} from "../lib/datas";
import {
  ROTULO_AUSENCIA,
  ROTULO_STATUS,
  type Agendamento,
  type Cliente,
  type Ausencia,
  type Configuracoes,
  type Funcionario,
  type Servico,
  type StatusAgendamento,
} from "../lib/types";
import type { PreDefinicao } from "./AgendamentoModal";
import PesquisaMarcacoes from "./PesquisaMarcacoes";
import ListaSemana from "./ListaSemana";

/**
 * Espaço por hora, em pixels por minuto. O salão escolhe o nível com os botões
 * − / +; por omissão uma marcação de 30 min tem altura para hora, cliente e serviço.
 */
const NIVEIS_ZOOM = [1.2, 1.6, 2.2, 2.8, 3.4];
const ZOOM_PADRAO = 2;
const CHAVE_ZOOM = "flordelotus.zoomAgenda";
/** Num ecrã muito alto a grelha estica para não sobrar branco, mas não mais do que isto. */
const ALTURA_MINUTO_MAX = 3.4;

const lerZoomGuardado = () => {
  try {
    const guardado = Number(window.localStorage.getItem(CHAVE_ZOOM));
    return Number.isInteger(guardado) && guardado >= 0 && guardado < NIVEIS_ZOOM.length
      ? guardado
      : ZOOM_PADRAO;
  } catch {
    return ZOOM_PADRAO;
  }
};
/** Altura do cabeçalho das colunas, descontada ao medir o espaço disponível. */
const ALTURA_CABECALHO = 56;
/**
 * Cada funcionária tem a sua cor, e é ela que pinta as marcações.
 * O estado lê-se pelo preenchimento: cheio = confirmada, tracejado = pendente.
 */
const corDoBloco = (status: StatusAgendamento, cor: string | undefined) => {
  if (!cor) return {};

  const base = {
    borderLeftColor: cor,
    "--cor-funcionaria": cor,
  } as Record<string, string>;

  if (status === "pendente") return { ...base, background: "#fff", borderColor: cor };
  return { ...base, background: corComTransparencia(cor, 0.22) };
};

/** Separador de linhas do tooltip nativo. */
const QUEBRA = String.fromCharCode(10);
/** Abaixo desta altura, o bloco não tem espaço para duas linhas. */
const BLOCO_COMPACTO = 46;

export type Vista = "dia" | "semana";

type Coluna = {
  chave: string;
  titulo: string;
  subtitulo: string | null;
  cor: string;
  /** Dia que esta coluna representa. */
  data: string;
  /** Null quando a coluna junta várias funcionárias (vista semanal de "todas"). */
  funcionarioId: string | null;
  marcacoes: Agendamento[];
  destacada: boolean;
};

type Props = {
  dia: string;
  vista: Vista;
  funcionariaSelecionada: string | null;
  agendamentosDaSemana: Agendamento[];
  ausencias: Ausencia[];
  funcionarios: Funcionario[];
  servicos: Servico[];
  configuracoes: Configuracoes;
  bloqueado: boolean;
  motivoBloqueio: string;
  onMudarDia: (dia: string) => void;
  onMudarVista: (vista: Vista) => void;
  onEscolherFuncionaria: (funcionariaId: string | null) => void;
  onAbrirNovo: (pre: PreDefinicao) => void;
  onAbrirExistente: (agendamento: Agendamento) => void;
  onPedirCancelamento: (agendamento: Agendamento) => void;
  clientes: Cliente[];
};

export default function AgendaView({
  dia,
  vista,
  funcionariaSelecionada,
  agendamentosDaSemana,
  ausencias,
  funcionarios,
  servicos,
  configuracoes,
  bloqueado,
  motivoBloqueio,
  onMudarDia,
  onMudarVista,
  onEscolherFuncionaria,
  onAbrirNovo,
  onAbrirExistente,
  onPedirCancelamento,
  clientes,
}: Props) {
  const ativas = funcionarios;
  const funcionaria = funcionarios.find((item) => item.id === funcionariaSelecionada) ?? null;
  const intervalo = useMemo(
    () => intervaloDaGrelha(configuracoes, agendamentosDaSemana),
    [agendamentosDaSemana, configuracoes],
  );
  const horas = gerarHoras(intervalo.inicio, intervalo.fim);
  const aberturaMin = minutosDesdeMeiaNoite(intervalo.inicio);
  const fechoMin = aberturaMin + horas.length * 60;
  const grelha = useRef<HTMLDivElement>(null);
  const [nivelZoom, setNivelZoom] = useState(lerZoomGuardado);
  const [escalaQueEnche, setEscalaQueEnche] = useState(0);

  // O nível escolhido manda; só se estica mais se, mesmo assim, sobrar ecrã em baixo.
  const alturaMinuto = Math.max(
    NIVEIS_ZOOM[nivelZoom],
    Math.min(escalaQueEnche, ALTURA_MINUTO_MAX),
  );
  const alturaGrelha = horas.length * 60 * alturaMinuto;

  const mudarZoom = (delta: number) => {
    setNivelZoom((atual) => {
      const novo = Math.min(Math.max(atual + delta, 0), NIVEIS_ZOOM.length - 1);
      try {
        window.localStorage.setItem(CHAVE_ZOOM, String(novo));
      } catch {
        // Sem armazenamento, o nível só dura até fechar a app.
      }
      return novo;
    });
  };

  useEffect(() => {
    const elemento = grelha.current;
    if (!elemento) return;

    const medir = () => {
      const disponivel = elemento.clientHeight - ALTURA_CABECALHO;
      if (disponivel > 0) setEscalaQueEnche(disponivel / (horas.length * 60));
    };

    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(elemento);
    return () => observador.disconnect();
  }, [horas.length]);

  /**
   * Com mais espaço por hora a grelha passa a ter scroll: ao abrir um dia, ou ao
   * mudar o zoom, põe-se à vista a hora que interessa — agora, se for hoje e o
   * salão estiver aberto; senão, a hora de abertura desse dia.
   */
  useEffect(() => {
    const elemento = grelha.current;
    if (!elemento) return;

    const horario = horarioDoDia(configuracoes, dia);
    const agora = new Date();
    const minutoAgora = agora.getHours() * 60 + agora.getMinutes();
    const abertura = horario.aberto ? minutosDesdeMeiaNoite(horario.inicio) : aberturaMin;
    const fecho = horario.aberto ? minutosDesdeMeiaNoite(horario.fim) : fechoMin;

    const alvo =
      dia === hoje() && minutoAgora >= abertura && minutoAgora < fecho
        ? minutoAgora - 30
        : abertura;

    elemento.scrollTop = Math.max(0, (alvo - aberturaMin) * alturaMinuto);
    // Só quando muda o dia, a vista ou o zoom: não se rouba o scroll a quem está a ver.
  }, [dia, vista, nivelZoom]);
  const segunda = inicioDaSemana(dia);
  const diasDaSemana = Array.from({ length: 7 }, (_, indice) => somarDias(segunda, indice));

  const visiveis = useMemo(
    () =>
      funcionariaSelecionada
        ? agendamentosDaSemana.filter((item) => item.funcionarioId === funcionariaSelecionada)
        : agendamentosDaSemana,
    [agendamentosDaSemana, funcionariaSelecionada],
  );

  const especialDoDia = diaEspecialDe(configuracoes, dia);

  const colunas = useMemo<Coluna[]>(() => {
    const doDia = (data: string) => visiveis.filter((item) => item.data === data);

    if (vista === "semana") {
      return diasDaSemana.map((data) => ({
        chave: data,
        titulo: abreviaturaDiaSemana(data),
        subtitulo: diaEspecialDe(configuracoes, data)
          ? `${numeroDoDia(data)} · ${diaEspecialDe(configuracoes, data)?.nome}`
          : numeroDoDia(data),
        cor: funcionaria?.cor ?? "#EDE9FE",
        data,
        funcionarioId: funcionariaSelecionada,
        marcacoes: doDia(data),
        destacada: data === hoje(),
      }));
    }

    if (funcionaria) {
      return [
        {
          chave: funcionaria.id,
          titulo: funcionaria.nome,
          subtitulo: null,
          cor: funcionaria.cor,
          data: dia,
          funcionarioId: funcionaria.id,
          marcacoes: doDia(dia),
          destacada: false,
        },
      ];
    }

    return ativas.map((item) => {
      const suas = doDia(dia).filter((marcacao) => marcacao.funcionarioId === item.id);
      return {
        chave: item.id,
        titulo: item.nome,
        subtitulo: null,
        cor: item.cor,
        data: dia,
        funcionarioId: item.id,
        marcacoes: suas,
        destacada: false,
      };
    });
  }, [ativas, configuracoes, dia, diasDaSemana, funcionaria, funcionariaSelecionada, visiveis, vista]);

  // "21 – 27 SET", ou "28 SET – 4 OUT" quando a semana muda de mês.
  const domingoDaSemana = somarDias(segunda, 6);
  const rotuloSemana =
    segunda.slice(0, 7) === domingoDaSemana.slice(0, 7)
      ? `${numeroDoDia(segunda)} – ${dataCompacta(domingoDaSemana)}`
      : `${dataCompacta(segunda)} – ${dataCompacta(domingoDaSemana)}`;

  /**
   * A semana de todas as funcionárias não cabe numa grelha de horas: seriam
   * sete dias vezes uma coluna por pessoa. Nesse caso mostra-se a lista do dia.
   */
  const emLista = vista === "semana" && funcionariaSelecionada === null;
  const seletorData = useRef<HTMLInputElement>(null);

  /**
   * Abre o calendário do sistema a partir da data no canto da grelha.
   * showPicker() existe no WebView2 (Chromium); se falhar, resta focar o campo.
   */
  const abrirSeletorDeData = () => {
    const campo = seletorData.current;
    if (!campo) return;
    try {
      campo.showPicker();
    } catch {
      campo.focus();
    }
  };

  const criarNoSlot = (
    evento: MouseEvent<HTMLDivElement>,
    data: string,
    funcionarioId: string | null,
  ) => {
    if (bloqueado) return;
    const caixa = evento.currentTarget.getBoundingClientRect();
    const minutosNoDia = (evento.clientY - caixa.top) / alturaMinuto;
    const minutoAbsoluto = aberturaMin + Math.floor(minutosNoDia / 15) * 15;
    const hora = String(Math.floor(minutoAbsoluto / 60)).padStart(2, "0");
    const minuto = String(minutoAbsoluto % 60).padStart(2, "0");
    onAbrirNovo({
      data,
      inicio: `${hora}:${minuto}`,
      funcionarioId: funcionarioId ?? undefined,
    });
  };

  return (
    <section className="agenda">
      <div className="linha-filtros linha-filtros-agenda">
        <div className="chips">
          <button
            type="button"
            className={`chip ${funcionariaSelecionada === null ? "ativo" : ""}`}
            onClick={() => onEscolherFuncionaria(null)}
          >
            Todas
          </button>
          {ativas.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`chip ${funcionariaSelecionada === item.id ? "ativo" : ""}`}
              onClick={() => onEscolherFuncionaria(item.id)}
            >
              <span className="ponto-cor" style={{ background: item.cor }} />
              {item.nome}
            </button>
          ))}
        </div>

        {/* Dois seletores, ao centro: um anda de dia em dia, o outro de semana em semana. */}
        <div className="navegadores-centro">
          <div className="navegador-data">
            <span className="etiqueta-navegador">Dia</span>
            <button
              type="button"
              className="seta"
              onClick={() => onMudarDia(somarDias(dia, -1))}
              aria-label="Dia anterior"
            >
              ‹
            </button>
            <button
              type="button"
              className="rotulo-periodo"
              onClick={abrirSeletorDeData}
              title="Escolher data"
            >
              {dia === hoje() ? "Hoje" : `${abreviaturaDiaSemana(dia)}, ${dataCompacta(dia)}`}
            </button>
            <input
              ref={seletorData}
              type="date"
              className="seletor-data"
              value={dia}
              onChange={(evento) => {
                if (evento.target.value) onMudarDia(evento.target.value);
              }}
              tabIndex={-1}
              aria-label="Escolher data"
            />
            <button
              type="button"
              className="seta"
              onClick={() => onMudarDia(somarDias(dia, 1))}
              aria-label="Dia seguinte"
            >
              ›
            </button>
          </div>

          <div className="navegador-data">
            <span className="etiqueta-navegador">Semana</span>
            <button
              type="button"
              className="seta"
              onClick={() => onMudarDia(somarDias(dia, -7))}
              aria-label="Semana anterior"
            >
              ‹
            </button>
            <span className="rotulo-periodo rotulo-semana">{rotuloSemana}</span>
            <button
              type="button"
              className="seta"
              onClick={() => onMudarDia(somarDias(dia, 7))}
              aria-label="Semana seguinte"
            >
              ›
            </button>
          </div>
        </div>

        <div className="acoes-agenda">
          <PesquisaMarcacoes
            clientes={clientes}
            funcionarios={funcionarios}
            servicos={servicos}
            onEscolher={(marcacao) => {
              onMudarDia(marcacao.data);
              onAbrirExistente(marcacao);
            }}
          />
          {!emLista ? (
            <div className="zoom-agenda" title="Espaço por hora">
              <button
                type="button"
                onClick={() => mudarZoom(-1)}
                disabled={nivelZoom === 0}
                aria-label="Menos espaço por hora"
                title="Menos espaço por hora"
              >
                −
              </button>
              <span aria-hidden="true">⇕</span>
              <button
                type="button"
                onClick={() => mudarZoom(1)}
                disabled={nivelZoom === NIVEIS_ZOOM.length - 1}
                aria-label="Mais espaço por hora"
                title="Mais espaço por hora"
              >
                +
              </button>
            </div>
          ) : null}

          <div className="alternador">
            <button
              type="button"
              className={vista === "dia" ? "ativo" : ""}
              onClick={() => onMudarVista("dia")}
            >
              Dia
            </button>
            <button
              type="button"
              className={vista === "semana" ? "ativo" : ""}
              onClick={() => onMudarVista("semana")}
            >
              Semana
            </button>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={() =>
              onAbrirNovo({ data: dia, funcionarioId: funcionariaSelecionada ?? undefined })
            }
            disabled={bloqueado}
            title={bloqueado ? motivoBloqueio : "Criar uma marcação nova"}
          >
            + Marcar
          </button>
        </div>
      </div>

      {/* Feriado ou dia especial: o nome e o horário desse dia, por cima da grelha. */}
      {vista === "dia" && especialDoDia ? (
        <p className="aviso-dia-especial">{descreverDiaEspecial(especialDoDia)}</p>
      ) : null}

      {colunas.length === 0 ? (
        <div className="estado-vazio">
          Ainda não há funcionárias ativas. Podes adicioná-las em Definições → Funcionárias.
        </div>
      ) : emLista ? (
        <ListaSemana
          dias={diasDaSemana}
          funcionarios={ativas}
          servicos={servicos}
          agendamentos={visiveis}
          ausencias={ausencias}
          configuracoes={configuracoes}
          onAbrirDia={(escolhido) => {
            onMudarDia(escolhido);
            onMudarVista("dia");
          }}
          onAbrirExistente={onAbrirExistente}
        />
      ) : (
        <div className="grelha" ref={grelha}>
          <div className="coluna-horas">
            <div className="cabecalho-coluna vazio" />
            {horas.map((hora) => (
              <div key={hora} className="marca-hora" style={{ height: `${60 * alturaMinuto}px` }}>
                <span>{hora}</span>
              </div>
            ))}
          </div>

          {colunas.map((coluna) => (
            <div
              key={coluna.chave}
              className={`coluna-funcionaria ${coluna.destacada ? "coluna-hoje" : ""}`}
            >
              {coluna.funcionarioId === null || vista === "semana" ? (
                <button
                  type="button"
                  className="cabecalho-coluna clicavel"
                  onClick={() => {
                    onMudarDia(coluna.data);
                    onMudarVista("dia");
                  }}
                  title="Ver este dia"
                >
                  <span className="risco-cor" style={{ background: coluna.cor }} />
                  <h3>{coluna.titulo}</h3>
                  {coluna.subtitulo ? <p>{coluna.subtitulo}</p> : null}
                </button>
              ) : (
                <div className="cabecalho-coluna">
                  <span className="risco-cor" style={{ background: coluna.cor }} />
                  <h3>{coluna.titulo}</h3>
                </div>
              )}

              <div
                className="pista"
                style={{ height: `${alturaGrelha}px` }}
                onClick={(evento) => criarNoSlot(evento, coluna.data, coluna.funcionarioId)}
                title={bloqueado ? motivoBloqueio : "Clica num espaço livre para marcar"}
              >
                {horas.map((hora) => (
                  <div
                    key={hora}
                    className="linha-hora"
                    style={{ height: `${60 * alturaMinuto}px` }}
                  />
                ))}

                {(() => {
                  const horario = horarioDoDia(configuracoes, coluna.data);
                  const faixas = !horario.aberto
                    ? [
                        {
                          de: aberturaMin,
                          ate: fechoMin,
                          rotulo: diaEspecialDe(configuracoes, coluna.data)
                            ? `${diaEspecialDe(configuracoes, coluna.data)?.nome} · fechado`
                            : "Fechado",
                        },
                      ]
                    : [
                        { de: aberturaMin, ate: minutosDesdeMeiaNoite(horario.inicio), rotulo: "" },
                        { de: minutosDesdeMeiaNoite(horario.fim), ate: fechoMin, rotulo: "" },
                      ];

                  return faixas
                    .filter((faixa) => faixa.ate > faixa.de)
                    .map((faixa) => (
                      <div
                        key={`fechado-${faixa.de}`}
                        className="faixa-fechado"
                        style={{
                          top: `${(faixa.de - aberturaMin) * alturaMinuto}px`,
                          height: `${(faixa.ate - faixa.de) * alturaMinuto}px`,
                        }}
                        title="O salão está fechado a esta hora"
                        onClick={(evento) => evento.stopPropagation()}
                      >
                        {faixa.rotulo ? <span>{faixa.rotulo}</span> : null}
                      </div>
                    ));
                })()}

                {ausenciasDoDia(ausencias, coluna.funcionarioId, coluna.data).map((ausencia) => {
                  const desde = ausencia.horaInicio
                    ? minutosDesdeMeiaNoite(ausencia.horaInicio)
                    : aberturaMin;
                  const ate = ausencia.horaFim
                    ? minutosDesdeMeiaNoite(ausencia.horaFim)
                    : aberturaMin + horas.length * 60;
                  const dona = funcionarios.find((item) => item.id === ausencia.funcionarioId);

                  return (
                    <div
                      key={ausencia.id}
                      className={`faixa-ausencia ${ausencia.tipo}`}
                      style={{
                        top: `${(desde - aberturaMin) * alturaMinuto}px`,
                        height: `${(ate - desde) * alturaMinuto}px`,
                      }}
                      title={`${dona?.nome ?? ""} — ${ROTULO_AUSENCIA[ausencia.tipo]}`}
                      onClick={(evento) => evento.stopPropagation()}
                    >
                      <span>
                        {ROTULO_AUSENCIA[ausencia.tipo]}
                        {coluna.funcionarioId === null && dona ? ` · ${dona.nome}` : ""}
                      </span>
                    </div>
                  );
                })}

                {distribuirEmFaixas(coluna.marcacoes).map(({ marcacao, faixa, totalFaixas }) => {
                  const topo =
                    (minutosDesdeMeiaNoite(marcacao.inicio) - aberturaMin) * alturaMinuto;
                  // 3px a menos: uma marcação que acaba às 14:20 e outra que começa às
                  // 14:20 ficam separadas por uma folga, em vez de coladas. Sem altura
                  // mínima grande, para uma marcação curta não invadir a seguinte.
                  const altura = Math.max(marcacao.duracaoMinutos * alturaMinuto - 3, 14);
                  const compacto = altura < BLOCO_COMPACTO;
                  // Com marcações lado a lado não há largura para a hora de fim.
                  const estreito = totalFaixas > 1;
                  const largura = 100 / totalFaixas;
                  const servico = servicos.find((item) => item.id === marcacao.servicoId);
                  const dona = funcionarios.find((item) => item.id === marcacao.funcionarioId);
                  const mostrarFuncionaria = coluna.funcionarioId === null;

                  // Os blocos ficam estreitos na vista semanal; o detalhe todo
                  // fica à distância do rato.
                  const detalhes = [
                    `${marcacao.inicio}-${marcacao.fim} · ${marcacao.cliente}`,
                    servico ? `${servico.nome} (${marcacao.duracaoMinutos} min)` : "",
                    dona ? dona.nome : "",
                    marcacao.telefone,
                    ROTULO_STATUS[marcacao.status],
                    marcacao.observacoes,
                  ]
                    .filter(Boolean)
                    .join(QUEBRA);

                  return (
                    <article
                      key={marcacao.id}
                      className={`bloco estado-${marcacao.status} ${compacto ? "compacto" : ""}`}
                      style={{
                        top: `${topo}px`,
                        height: `${altura}px`,
                        left: `calc(${faixa * largura}% + 3px)`,
                        width: `calc(${largura}% - 6px)`,
                        ...corDoBloco(marcacao.status, dona?.cor),
                      }}
                      title={detalhes}
                      onClick={(evento) => {
                        evento.stopPropagation();
                        onAbrirExistente(marcacao);
                      }}
                    >
                      <div className="bloco-topo">
                        <span className="bloco-hora">
                          {compacto || estreito
                            ? marcacao.inicio
                            : `${marcacao.inicio}-${marcacao.fim}`}
                        </span>
                        {compacto ? <strong>{marcacao.cliente}</strong> : null}
                        <span className="bloco-acoes">
                          <button
                            type="button"
                            title="Cancelar marcação"
                            onClick={(evento) => {
                              evento.stopPropagation();
                              onPedirCancelamento(marcacao);
                            }}
                          >
                            ✕
                          </button>
                        </span>
                      </div>
                      {compacto ? null : <strong>{marcacao.cliente}</strong>}
                      {/* O serviço aparece sempre que haja altura; só se esconde quando
                          há marcações lado a lado e a largura não chega. */}
                      {!compacto && !estreito && altura > 62 ? (
                        <span className="bloco-servico">
                          {mostrarFuncionaria && dona ? `${dona.nome} · ` : ""}
                          {servico?.nome ?? ""}
                        </span>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
