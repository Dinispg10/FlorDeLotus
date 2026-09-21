import { useMemo, useState } from "react";
import { horarioDoDia } from "../lib/agenda";
import {
  dataCompacta,
  dataPorExtenso,
  formatarPreco,
  inicioDaSemana,
  minutosDesdeMeiaNoite,
  somarDias,
} from "../lib/datas";
import type { Agendamento, Configuracoes, Funcionario, Servico } from "../lib/types";

type Props = {
  dia: string;
  agendamentosDaSemana: Agendamento[];
  funcionarios: Funcionario[];
  servicos: Servico[];
  configuracoes: Configuracoes;
};

export default function EstatisticasView({
  dia,
  agendamentosDaSemana,
  funcionarios,
  servicos,
  configuracoes,
}: Props) {
  const [periodo, setPeriodo] = useState<"dia" | "semana">("semana");

  const noPeriodo = useMemo(
    () =>
      periodo === "semana"
        ? agendamentosDaSemana
        : agendamentosDaSemana.filter((item) => item.data === dia),
    [agendamentosDaSemana, dia, periodo],
  );

  const precoDe = useMemo(() => {
    const mapa = new Map(servicos.map((servico) => [servico.id, servico]));
    return (id: string) => mapa.get(id)?.preco ?? 0;
  }, [servicos]);

  const resumo = useMemo(() => {
    // "Já realizado" é o que já acabou: é assim que se sabe o que foi feito,
    // agora que as marcações não se dão como concluídas à mão.
    const agora = Date.now();
    const realizadas = noPeriodo.filter((item) => item.fimMs <= agora);

    return {
      total: noPeriodo.length,
      confirmadas: noPeriodo.filter((item) => item.status === "confirmado").length,
      pendentes: noPeriodo.filter((item) => item.status === "pendente").length,
      realizadas: realizadas.length,
      previsto: noPeriodo.reduce((total, item) => total + precoDe(item.servicoId), 0),
      faturado: realizadas.reduce((total, item) => total + precoDe(item.servicoId), 0),
    };
  }, [noPeriodo, precoDe]);

  /**
   * Minutos em que o salão está aberto no período — serve de denominador à ocupação.
   * Dias fechados não contam, senão a percentagem aparecia sempre mais baixa do que é.
   */
  const minutosDisponiveis = useMemo(() => {
    const dias =
      periodo === "semana"
        ? Array.from({ length: 7 }, (_, indice) => somarDias(inicioDaSemana(dia), indice))
        : [dia];

    const total = dias.reduce((soma, data) => {
      const horario = horarioDoDia(configuracoes, data);
      if (!horario.aberto) return soma;
      return soma + (minutosDesdeMeiaNoite(horario.fim) - minutosDesdeMeiaNoite(horario.inicio));
    }, 0);

    return Math.max(total, 1);
  }, [configuracoes, dia, periodo]);

  const porFuncionaria = useMemo(
    () =>
      funcionarios
        .filter((item) => item.ativo)
        .map((funcionaria) => {
          const suas = noPeriodo.filter((item) => item.funcionarioId === funcionaria.id);
          const minutos = suas.reduce((total, item) => total + item.duracaoMinutos, 0);

          return {
            funcionaria,
            marcacoes: suas.length,
            receita: suas.reduce((total, item) => total + precoDe(item.servicoId), 0),
            ocupacao: Math.round((minutos / minutosDisponiveis) * 100),
          };
        })
        .sort((a, b) => b.receita - a.receita),
    [funcionarios, minutosDisponiveis, noPeriodo, precoDe],
  );

  const porServico = useMemo(() => {
    const contagem = new Map<string, { nome: string; vezes: number; receita: number }>();

    noPeriodo.forEach((item) => {
        const servico = servicos.find((s) => s.id === item.servicoId);
        if (!servico) return;
        const atual = contagem.get(servico.id) ?? { nome: servico.nome, vezes: 0, receita: 0 };
        atual.vezes += 1;
        atual.receita += servico.preco;
        contagem.set(servico.id, atual);
      });

    return [...contagem.values()].sort((a, b) => b.vezes - a.vezes).slice(0, 6);
  }, [noPeriodo, servicos]);

  const segunda = inicioDaSemana(dia);
  const maiorOcupacao = Math.max(...porFuncionaria.map((item) => item.ocupacao), 1);

  return (
    <section className="estatisticas">
      <div className="linha-filtros">
        <div>
          <h2>
            {periodo === "semana"
              ? `Semana de ${dataCompacta(segunda)} a ${dataCompacta(somarDias(segunda, 6))}`
              : dataPorExtenso(dia)}
          </h2>
          <p className="subtitulo">
            Os números seguem o dia escolhido na agenda.
          </p>
        </div>

        <div className="alternador">
          <button
            type="button"
            className={periodo === "dia" ? "ativo" : ""}
            onClick={() => setPeriodo("dia")}
          >
            Dia
          </button>
          <button
            type="button"
            className={periodo === "semana" ? "ativo" : ""}
            onClick={() => setPeriodo("semana")}
          >
            Semana
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <article className="stat-card">
          <span>Marcações</span>
          <strong>{resumo.total}</strong>
        </article>
        <article className="stat-card verde">
          <span>Faturação prevista</span>
          <strong>{formatarPreco(resumo.previsto)}</strong>
        </article>
        <article className="stat-card verde">
          <span>Já realizado</span>
          <strong>{formatarPreco(resumo.faturado)}</strong>
        </article>
        <article className="stat-card">
          <span>Por confirmar</span>
          <strong>{resumo.pendentes}</strong>
        </article>
      </div>

      <div className="painel-duplo">
        <div className="cartao">
          <h3>Por funcionária</h3>
          {porFuncionaria.length === 0 ? (
            <p className="subtitulo">Sem funcionárias ativas.</p>
          ) : (
            <ul className="lista-barras">
              {porFuncionaria.map((item) => (
                <li key={item.funcionaria.id}>
                  <div className="barra-topo">
                    <strong>
                      <span className="ponto-cor" style={{ background: item.funcionaria.cor }} />
                      {item.funcionaria.nome}
                    </strong>
                    <span>
                      {item.marcacoes} marcações · {formatarPreco(item.receita)}
                    </span>
                  </div>
                  <div className="barra">
                    <div
                      className="barra-preenchida"
                      style={{
                        width: `${(item.ocupacao / maiorOcupacao) * 100}%`,
                        background: item.funcionaria.cor,
                      }}
                    />
                  </div>
                  <span className="barra-legenda">{item.ocupacao}% do horário ocupado</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="cartao">
          <h3>Serviços mais pedidos</h3>
          {porServico.length === 0 ? (
            <p className="subtitulo">Ainda não há marcações neste período.</p>
          ) : (
            <ul className="lista-registos">
              {porServico.map((item) => (
                <li key={item.nome}>
                  <div>
                    <strong>{item.nome}</strong>
                    <span>{formatarPreco(item.receita)}</span>
                  </div>
                  <span className="badge">{item.vezes}×</span>
                </li>
              ))}
            </ul>
          )}

          <div className="detalhe-estados">
            <span>
              Confirmadas <strong>{resumo.confirmadas}</strong>
            </span>
            <span>
              Pendentes <strong>{resumo.pendentes}</strong>
            </span>
            <span>
              Já realizadas <strong>{resumo.realizadas}</strong>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
