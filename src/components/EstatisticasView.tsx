import { useCallback, useEffect, useMemo, useState } from "react";
import * as api from "../lib/api";
import EcraEspera from "./EcraEspera";
import { mensagemDeFalha } from "../lib/guardado";
import { formatarPreco, hoje } from "../lib/datas";
import {
  criarPeriodo,
  dentroDe,
  moverPeriodo,
  porFuncionaria,
  porServico,
  resumir,
  serieDoPeriodo,
  variacao,
  type Ponto,
  type TipoPeriodo,
} from "../lib/estatisticas";
import type { Agendamento, Ausencia, Configuracoes, Funcionario, Servico } from "../lib/types";
import SeletorTelemovel from "./SeletorTelemovel";
import { useEcraPequeno } from "../hooks/useEcraPequeno";

type Props = {
  configuracoes: Configuracoes;
  funcionarios: Funcionario[];
  servicos: Servico[];
  onErro: (mensagem: string) => void;
};

const TIPOS: { chave: TipoPeriodo; rotulo: string }[] = [
  { chave: "dia", rotulo: "Dia" },
  { chave: "semana", rotulo: "Semana" },
  { chave: "mes", rotulo: "Mês" },
];

const formatarHoras = (minutos: number) => {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (horas === 0) return `${resto} min`;
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
};

/** Valores redondos para o eixo: 0, 50, 100 em vez de 0, 47, 94. */
const topoRedondo = (maximo: number) => {
  if (maximo <= 0) return 10;
  const ordem = 10 ** Math.floor(Math.log10(maximo));
  const passo = [1, 2, 2.5, 5, 10].find((f) => f * ordem >= maximo) ?? 10;
  return passo * ordem;
};

/** Euros sem cêntimos quando são redondos, para o eixo e os rótulos do gráfico. */
const eurosCurtos = (valor: number) => formatarPreco(valor).replace(",00", "");

function IndicadorVariacao({
  valor,
  comparadoCom,
}: {
  valor: number | null;
  comparadoCom: string;
}) {
  if (valor === null) {
    return <span className="variacao neutra">sem registos no período anterior</span>;
  }

  const arredondado = Math.round(valor);
  if (arredondado === 0) {
    return <span className="variacao neutra">igual {comparadoCom}</span>;
  }

  // A seta e o texto dizem o sentido; a cor só reforça.
  const sobe = arredondado > 0;
  return (
    <span className={`variacao ${sobe ? "sobe" : "desce"}`}>
      <span aria-hidden="true">{sobe ? "▲" : "▼"}</span> {Math.abs(arredondado)}% face{" "}
      {comparadoCom}
    </span>
  );
}

function GraficoEvolucao({ pontos, titulo }: { pontos: Ponto[]; titulo: string }) {
  const [ativo, setAtivo] = useState<string | null>(null);
  const [verTabela, setVerTabela] = useState(false);

  const maximo = Math.max(...pontos.map((p) => p.faturacao), 0);
  const topo = topoRedondo(maximo);
  const marcas = [topo, topo / 2, 0];
  // Só o valor mais alto leva rótulo; os outros vêem-se ao passar o rato.
  const maisAlto = pontos.find((p) => p.faturacao === maximo && maximo > 0)?.chave;
  const hojeChave = hoje();

  return (
    <div className="cartao grafico-cartao">
      <div className="cartao-topo">
        <h3>{titulo}</h3>
        <button type="button" className="ghost-button" onClick={() => setVerTabela((v) => !v)}>
          {verTabela ? "Ver gráfico" : "Ver valores"}
        </button>
      </div>

      {verTabela ? (
        <table className="tabela-estatisticas">
          <thead>
            <tr>
              <th>Período</th>
              <th>Marcações</th>
              <th>Faturação</th>
            </tr>
          </thead>
          <tbody>
            {pontos.map((ponto) => (
              <tr key={ponto.chave}>
                <td>{ponto.rotuloCompleto}</td>
                <td>{ponto.marcacoes}</td>
                <td>{formatarPreco(ponto.faturacao)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="grafico">
          <div className="grafico-eixo" aria-hidden="true">
            {marcas.map((valor) => (
              <span key={valor}>{eurosCurtos(valor)}</span>
            ))}
          </div>

          <div className="grafico-area">
            {marcas.map((valor) => (
              <div
                key={valor}
                className="grafico-linha"
                style={{ bottom: `${(valor / topo) * 100}%` }}
              />
            ))}

            <div className="grafico-barras">
              {pontos.map((ponto) => {
                const altura = (ponto.faturacao / topo) * 100;
                const destaque = ponto.chave === ativo;

                return (
                  <div
                    key={ponto.chave}
                    className={`grafico-faixa ${destaque ? "ativa" : ""}`}
                    tabIndex={0}
                    aria-label={`${ponto.rotuloCompleto}: ${formatarPreco(ponto.faturacao)}, ${ponto.marcacoes} marcações`}
                    onPointerEnter={() => setAtivo(ponto.chave)}
                    onPointerLeave={() => setAtivo(null)}
                    onFocus={() => setAtivo(ponto.chave)}
                    onBlur={() => setAtivo(null)}
                  >
                    {ponto.chave === maisAlto && !destaque ? (
                      <span className="grafico-rotulo-valor" style={{ bottom: `${altura}%` }}>
                        {eurosCurtos(ponto.faturacao)}
                      </span>
                    ) : null}

                    {ponto.faturacao > 0 ? (
                      <span className="grafico-barra" style={{ height: `${altura}%` }} />
                    ) : null}

                    {destaque ? (
                      <span className="grafico-dica" style={{ bottom: `${Math.min(altura, 70)}%` }}>
                        <strong>{formatarPreco(ponto.faturacao)}</strong>
                        <span>{ponto.rotuloCompleto}</span>
                        <span>
                          {ponto.marcacoes} {ponto.marcacoes === 1 ? "marcação" : "marcações"}
                        </span>
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grafico-x" aria-hidden="true">
            {pontos.map((ponto) => (
              <span key={ponto.chave} className={ponto.chave === hojeChave ? "hoje" : ""}>
                {ponto.rotulo}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Por baixo do período, no telemóvel, quando ele inclui o dia de hoje. */
const PERIODO_ATUAL: Record<TipoPeriodo, string> = {
  dia: "Hoje",
  semana: "Esta semana",
  mes: "Este mês",
};

export default function EstatisticasView({ configuracoes, funcionarios, servicos, onErro }: Props) {
  const telemovel = useEcraPequeno();
  const [tipo, setTipo] = useState<TipoPeriodo>("semana");
  const [referencia, setReferencia] = useState(hoje());
  const [marcacoes, setMarcacoes] = useState<Agendamento[]>([]);
  const [ausencias, setAusencias] = useState<Ausencia[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  const [carregouUmaVez, setCarregouUmaVez] = useState(false);
  const [erroDoPeriodo, setErroDoPeriodo] = useState("");

  const periodo = useMemo(() => criarPeriodo(tipo, referencia), [tipo, referencia]);

  // Traz o período e o anterior de uma só vez: estão sempre encostados.
  const carregar = useCallback(async () => {
    setACarregar(true);
    try {
      const [lista, folgas] = await Promise.all([
        api.listarAgendamentos(periodo.anterior.inicio, periodo.fim),
        api.listarAusencias(periodo.inicio, periodo.fim),
      ]);
      setMarcacoes(lista);
      setAusencias(folgas);
      setCarregouUmaVez(true);
      setErroDoPeriodo("");
    } catch (causa) {
      setErroDoPeriodo(mensagemDeFalha(causa, "Não foi possível carregar as estatísticas."));
    } finally {
      setACarregar(false);
    }
  }, [onErro, periodo.anterior.inicio, periodo.fim, periodo.inicio]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // O preço guardado na marcação, como numa fatura: mudar o preço de um serviço não
  // mexe no que já passou. Só marcações de antes da migração 013 usam o preço atual.
  const precoDe = useMemo(() => {
    const precos = new Map(servicos.map((servico) => [servico.id, servico.preco]));
    return (marcacao: Agendamento) => marcacao.preco ?? precos.get(marcacao.servicoId) ?? 0;
  }, [servicos]);

  const doPeriodo = useMemo(
    () => dentroDe(marcacoes, periodo.inicio, periodo.fim),
    [marcacoes, periodo.fim, periodo.inicio],
  );
  const doAnterior = useMemo(
    () => dentroDe(marcacoes, periodo.anterior.inicio, periodo.anterior.fim),
    [marcacoes, periodo.anterior.fim, periodo.anterior.inicio],
  );

  const agora = Date.now();
  const atual = resumir(doPeriodo, precoDe, agora);
  const anterior = resumir(doAnterior, precoDe, agora);

  const serie = useMemo(
    () => serieDoPeriodo(periodo, doPeriodo, precoDe, configuracoes),
    [configuracoes, doPeriodo, periodo, precoDe],
  );
  const linhasFuncionarias = useMemo(
    () => porFuncionaria(funcionarios, periodo, doPeriodo, ausencias, configuracoes, precoDe),
    [ausencias, configuracoes, doPeriodo, funcionarios, periodo, precoDe],
  );
  const linhasServicos = useMemo(
    () => porServico(doPeriodo, servicos, precoDe),
    [doPeriodo, precoDe, servicos],
  );

  const incluiHoje = periodo.inicio <= hoje() && hoje() <= periodo.fim;
  const maiorServico = Math.max(...linhasServicos.map((l) => l.faturacao), 0);

  return (
    <section className="estatisticas">
      <div className="linha-filtros filtros-estatisticas">
        <div className="alternador">
          {TIPOS.map((item) => (
            <button
              key={item.chave}
              type="button"
              className={tipo === item.chave ? "ativo" : ""}
              onClick={() => setTipo(item.chave)}
            >
              {item.rotulo}
            </button>
          ))}
        </div>

        {telemovel ? (
          <SeletorTelemovel
            titulo={periodo.rotulo}
            subtitulo={incluiHoje ? PERIODO_ATUAL[tipo] : undefined}
            dia={referencia}
            onEscolherDia={setReferencia}
            onAnterior={() => setReferencia(moverPeriodo(tipo, referencia, -1))}
            onSeguinte={() => setReferencia(moverPeriodo(tipo, referencia, 1))}
            rotuloAnterior="Período anterior"
            rotuloSeguinte="Período seguinte"
          />
        ) : (
          <div className="navegador-data">
            <button
              type="button"
              className="seta"
              onClick={() => setReferencia(moverPeriodo(tipo, referencia, -1))}
              aria-label="Período anterior"
            >
              ‹
            </button>
            <span className="rotulo-periodo rotulo-estatisticas">{periodo.rotulo}</span>
            <button
              type="button"
              className="seta"
              onClick={() => setReferencia(moverPeriodo(tipo, referencia, 1))}
              aria-label="Período seguinte"
            >
              ›
            </button>
          </div>
        )}

        {!incluiHoje ? (
          <button type="button" className="ghost-button" onClick={() => setReferencia(hoje())}>
            Voltar ao período atual
          </button>
        ) : null}
      </div>

      {/* Ao mudar de período, o anterior fica esbatido em vez de a página piscar. */}
      <div className={`conteudo-estatisticas ${aCarregar && carregouUmaVez ? "a-atualizar" : ""}`}>
        {erroDoPeriodo ? (
          <div className="estado-vazio">{erroDoPeriodo}</div>
        ) : !carregouUmaVez ? (
          <EcraEspera texto="A carregar as estatísticas..." />
        ) : (
          <>
            <div className="stats-grid">
              <article className="stat-card">
                <span>Faturação</span>
                <strong>{formatarPreco(atual.faturacao)}</strong>
                <IndicadorVariacao
                  valor={variacao(atual.faturacao, anterior.faturacao)}
                  comparadoCom={periodo.comparadoCom}
                />
                {atual.realizada < atual.faturacao ? (
                  <small>{formatarPreco(atual.realizada)} já realizados</small>
                ) : null}
              </article>

              <article className="stat-card">
                <span>Marcações</span>
                <strong>{atual.marcacoes}</strong>
                <IndicadorVariacao
                  valor={variacao(atual.marcacoes, anterior.marcacoes)}
                  comparadoCom={periodo.comparadoCom}
                />
              </article>

              <article className="stat-card">
                <span>Valor médio por marcação</span>
                <strong>{formatarPreco(atual.valorMedio)}</strong>
                <IndicadorVariacao
                  valor={variacao(atual.valorMedio, anterior.valorMedio)}
                  comparadoCom={periodo.comparadoCom}
                />
              </article>

              <article className="stat-card">
                <span>Clientes atendidos</span>
                <strong>{atual.clientes}</strong>
                <IndicadorVariacao
                  valor={variacao(atual.clientes, anterior.clientes)}
                  comparadoCom={periodo.comparadoCom}
                />
              </article>
            </div>

            {atual.marcacoes === 0 ? (
              <div className="estado-vazio">Não há marcações neste período.</div>
            ) : (
              <>
                <GraficoEvolucao
                  pontos={serie}
                  titulo={tipo === "dia" ? "Faturação por hora" : "Faturação por dia"}
                />

                <div className="painel-duplo">
                  <div className="cartao">
                    <h3>Por funcionária</h3>
                    <table className="tabela-estatisticas">
                      <thead>
                        <tr>
                          <th>Funcionária</th>
                          <th>Marcações</th>
                          <th>Faturação</th>
                          <th>Ocupação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {linhasFuncionarias.map((linha) => (
                          <tr key={linha.funcionaria.id}>
                            <td>
                              <span
                                className="ponto-cor"
                                style={{ background: linha.funcionaria.cor }}
                              />{" "}
                              {linha.funcionaria.nome}
                            </td>
                            <td>{linha.marcacoes}</td>
                            <td>{formatarPreco(linha.faturacao)}</td>
                            <td
                              title={
                                linha.ocupacao === null
                                  ? "Sem horas disponíveis neste período (folga, férias ou salão fechado)"
                                  : `${formatarHoras(linha.minutosMarcados)} marcadas de ${formatarHoras(linha.minutosDisponiveis)} disponíveis`
                              }
                            >
                              {linha.ocupacao === null ? (
                                <span className="sem-valor">ausente</span>
                              ) : (
                                <span className="medidor">
                                  <span className="medidor-trilho">
                                    <span
                                      style={{
                                        width: `${linha.ocupacao}%`,
                                        background: linha.funcionaria.cor,
                                      }}
                                    />
                                  </span>
                                  <span className="medidor-valor">{linha.ocupacao}%</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="dica">
                      A ocupação compara o tempo marcado com as horas em que o salão está aberto,
                      já sem contar folgas nem férias.
                    </p>
                  </div>

                  <div className="cartao">
                    <h3>Por serviço</h3>
                    <table className="tabela-estatisticas">
                      <thead>
                        <tr>
                          <th>Serviço</th>
                          <th>Vezes</th>
                          <th>Faturação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {linhasServicos.map((linha) => (
                          <tr key={linha.servicoId}>
                            <td>
                              <span className="servico-nome">{linha.nome}</span>
                              <span className="barra-peso" aria-hidden="true">
                                <span
                                  style={{
                                    width: `${maiorServico > 0 ? (linha.faturacao / maiorServico) * 100 : 0}%`,
                                  }}
                                />
                              </span>
                            </td>
                            <td>{linha.vezes}</td>
                            <td>
                              {formatarPreco(linha.faturacao)}
                              <small> · {Math.round(linha.percentagem)}%</small>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
