import { horarioDoDia, intervaloDaGrelha } from "./agenda";
import {
  abreviaturaDiaSemana,
  dataCompacta,
  dataPorExtenso,
  fimDoMes,
  gerarHoras,
  inicioDaSemana,
  inicioDoMes,
  mesPorExtenso,
  minutosDesdeMeiaNoite,
  numeroDoDia,
  somarDias,
  somarMeses,
} from "./datas";
import type { Agendamento, Ausencia, Configuracoes, Funcionario, Servico } from "./types";

export type TipoPeriodo = "dia" | "semana" | "mes";

export type Periodo = {
  tipo: TipoPeriodo;
  /** AAAA-MM-DD, ambos incluídos. */
  inicio: string;
  fim: string;
  anterior: { inicio: string; fim: string };
  /** "Setembro de 2026", "21 SET – 27 SET", "Segunda-feira, 21 de setembro". */
  rotulo: string;
  /** Para as comparações: "à semana anterior". */
  comparadoCom: string;
  dias: string[];
};

const diasEntre = (inicio: string, fim: string) => {
  const dias: string[] = [];
  for (let dia = inicio; dia <= fim; dia = somarDias(dia, 1)) dias.push(dia);
  return dias;
};

export const criarPeriodo = (tipo: TipoPeriodo, referencia: string): Periodo => {
  if (tipo === "dia") {
    return {
      tipo,
      inicio: referencia,
      fim: referencia,
      anterior: { inicio: somarDias(referencia, -1), fim: somarDias(referencia, -1) },
      rotulo: dataPorExtenso(referencia),
      comparadoCom: "ao dia anterior",
      dias: [referencia],
    };
  }

  if (tipo === "semana") {
    const segunda = inicioDaSemana(referencia);
    const domingo = somarDias(segunda, 6);
    return {
      tipo,
      inicio: segunda,
      fim: domingo,
      anterior: { inicio: somarDias(segunda, -7), fim: somarDias(segunda, -1) },
      rotulo: `${dataCompacta(segunda)} – ${dataCompacta(domingo)}`,
      comparadoCom: "à semana anterior",
      dias: diasEntre(segunda, domingo),
    };
  }

  const primeiro = inicioDoMes(referencia);
  const ultimo = fimDoMes(referencia);
  const mesAnterior = somarMeses(primeiro, -1);
  return {
    tipo,
    inicio: primeiro,
    fim: ultimo,
    anterior: { inicio: mesAnterior, fim: fimDoMes(mesAnterior) },
    rotulo: mesPorExtenso(primeiro),
    comparadoCom: "ao mês anterior",
    dias: diasEntre(primeiro, ultimo),
  };
};

/** Data de referência do período seguinte (passo 1) ou anterior (passo -1). */
export const moverPeriodo = (tipo: TipoPeriodo, referencia: string, passo: number) => {
  if (tipo === "dia") return somarDias(referencia, passo);
  if (tipo === "semana") return somarDias(referencia, 7 * passo);
  return somarMeses(referencia, passo);
};

export const dentroDe = (marcacoes: Agendamento[], inicio: string, fim: string) =>
  marcacoes.filter((item) => item.data >= inicio && item.data <= fim);

/* ---------------------------------------------------------------- */
/* Resumo                                                            */
/* ---------------------------------------------------------------- */

export type Resumo = {
  faturacao: number;
  /** Parte da faturação cujas marcações já acabaram. */
  realizada: number;
  marcacoes: number;
  valorMedio: number;
  clientes: number;
};

export const resumir = (
  marcacoes: Agendamento[],
  precoDe: (servicoId: string) => number,
  agora: number,
): Resumo => {
  const faturacao = marcacoes.reduce((total, item) => total + precoDe(item.servicoId), 0);
  const realizada = marcacoes
    .filter((item) => item.fimMs <= agora)
    .reduce((total, item) => total + precoDe(item.servicoId), 0);
  const clientes = new Set(marcacoes.map((item) => item.clienteId ?? `nome:${item.cliente}`));

  return {
    faturacao,
    realizada,
    marcacoes: marcacoes.length,
    valorMedio: marcacoes.length > 0 ? faturacao / marcacoes.length : 0,
    clientes: clientes.size,
  };
};

/**
 * Variação em percentagem face ao período anterior. Null quando não há com que
 * comparar (o anterior foi zero e este não), para não se inventar um "+∞%".
 */
export const variacao = (atual: number, anterior: number): number | null => {
  if (anterior === 0) return atual === 0 ? 0 : null;
  return ((atual - anterior) / anterior) * 100;
};

/* ---------------------------------------------------------------- */
/* Evolução ao longo do período                                      */
/* ---------------------------------------------------------------- */

export type Ponto = {
  chave: string;
  /** Rótulo curto, para o eixo: "SEG", "21", "10h". */
  rotulo: string;
  /** Rótulo completo, para o tooltip e a tabela. */
  rotuloCompleto: string;
  faturacao: number;
  marcacoes: number;
};

/** Um dia divide-se em horas; uma semana e um mês, em dias. */
export const serieDoPeriodo = (
  periodo: Periodo,
  marcacoes: Agendamento[],
  precoDe: (servicoId: string) => number,
  configuracoes: Configuracoes,
): Ponto[] => {
  if (periodo.tipo === "dia") {
    const doDia = dentroDe(marcacoes, periodo.inicio, periodo.fim);
    const intervalo = intervaloDaGrelha(configuracoes, doDia);

    return gerarHoras(intervalo.inicio, intervalo.fim).map((hora) => {
      const nestaHora = doDia.filter((item) => item.inicio.slice(0, 2) === hora.slice(0, 2));
      return {
        chave: hora,
        rotulo: `${Number(hora.slice(0, 2))}h`,
        rotuloCompleto: `${hora} – ${String(Number(hora.slice(0, 2)) + 1).padStart(2, "0")}:00`,
        faturacao: nestaHora.reduce((total, item) => total + precoDe(item.servicoId), 0),
        marcacoes: nestaHora.length,
      };
    });
  }

  return periodo.dias.map((dia) => {
    const doDia = marcacoes.filter((item) => item.data === dia);
    return {
      chave: dia,
      rotulo: periodo.tipo === "semana" ? abreviaturaDiaSemana(dia) : numeroDoDia(dia),
      rotuloCompleto: dataPorExtenso(dia),
      faturacao: doDia.reduce((total, item) => total + precoDe(item.servicoId), 0),
      marcacoes: doDia.length,
    };
  });
};

/* ---------------------------------------------------------------- */
/* Por funcionária                                                   */
/* ---------------------------------------------------------------- */

/** Junta intervalos [início, fim) sobrepostos e devolve a soma dos minutos. */
const somarIntervalos = (intervalos: [number, number][]) => {
  const ordenados = intervalos.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  let total = 0;
  let atual: [number, number] | null = null;

  for (const [a, b] of ordenados) {
    if (!atual || a > atual[1]) {
      if (atual) total += atual[1] - atual[0];
      atual = [a, b];
    } else {
      atual[1] = Math.max(atual[1], b);
    }
  }
  if (atual) total += atual[1] - atual[0];
  return total;
};

/**
 * Minutos em que a funcionária podia receber clientes no período: horas de abertura
 * do salão, tirando as folgas e férias dela. É o denominador da ocupação — sem
 * descontar as folgas, quem esteve de férias aparecia com ocupação baixíssima.
 */
export const minutosDisponiveis = (
  funcionarioId: string,
  dias: string[],
  configuracoes: Configuracoes,
  ausencias: Ausencia[],
) =>
  dias.reduce((total, dia) => {
    const horario = horarioDoDia(configuracoes, dia);
    if (!horario.aberto) return total;

    const abre = minutosDesdeMeiaNoite(horario.inicio);
    const fecha = minutosDesdeMeiaNoite(horario.fim);

    const bloqueios = ausencias
      .filter(
        (ausencia) =>
          ausencia.funcionarioId === funcionarioId &&
          ausencia.dataInicio <= dia &&
          dia <= ausencia.dataFim,
      )
      .map((ausencia): [number, number] =>
        ausencia.horaInicio && ausencia.horaFim
          ? [
              Math.max(abre, minutosDesdeMeiaNoite(ausencia.horaInicio)),
              Math.min(fecha, minutosDesdeMeiaNoite(ausencia.horaFim)),
            ]
          : [abre, fecha],
      );

    return total + (fecha - abre) - somarIntervalos(bloqueios);
  }, 0);

export type LinhaFuncionaria = {
  funcionaria: Funcionario;
  marcacoes: number;
  faturacao: number;
  minutosMarcados: number;
  minutosDisponiveis: number;
  /** 0-100, ou null quando não havia tempo disponível (folga o período todo). */
  ocupacao: number | null;
};

export const porFuncionaria = (
  funcionarios: Funcionario[],
  periodo: Periodo,
  marcacoes: Agendamento[],
  ausencias: Ausencia[],
  configuracoes: Configuracoes,
  precoDe: (servicoId: string) => number,
): LinhaFuncionaria[] =>
  funcionarios
    // Uma funcionária já desativada ainda conta se trabalhou neste período.
    .filter((item) => item.ativo || marcacoes.some((m) => m.funcionarioId === item.id))
    .map((funcionaria) => {
      const suas = marcacoes.filter((item) => item.funcionarioId === funcionaria.id);
      const marcados = suas.reduce((total, item) => total + item.duracaoMinutos, 0);
      const disponiveis = minutosDisponiveis(
        funcionaria.id,
        periodo.dias,
        configuracoes,
        ausencias,
      );

      return {
        funcionaria,
        marcacoes: suas.length,
        faturacao: suas.reduce((total, item) => total + precoDe(item.servicoId), 0),
        minutosMarcados: marcados,
        minutosDisponiveis: disponiveis,
        ocupacao: disponiveis > 0 ? Math.min(100, Math.round((marcados / disponiveis) * 100)) : null,
      };
    })
    .sort((a, b) => b.faturacao - a.faturacao || b.marcacoes - a.marcacoes);

/* ---------------------------------------------------------------- */
/* Por serviço                                                       */
/* ---------------------------------------------------------------- */

export type LinhaServico = {
  servicoId: string;
  nome: string;
  vezes: number;
  faturacao: number;
  /** Peso na faturação do período, 0-100. */
  percentagem: number;
};

export const porServico = (
  marcacoes: Agendamento[],
  servicos: Servico[],
  precoDe: (servicoId: string) => number,
): LinhaServico[] => {
  const contagem = new Map<string, { vezes: number; faturacao: number }>();

  marcacoes.forEach((item) => {
    const atual = contagem.get(item.servicoId) ?? { vezes: 0, faturacao: 0 };
    atual.vezes += 1;
    atual.faturacao += precoDe(item.servicoId);
    contagem.set(item.servicoId, atual);
  });

  const total = [...contagem.values()].reduce((soma, item) => soma + item.faturacao, 0);

  return [...contagem.entries()]
    .map(([servicoId, dados]) => ({
      servicoId,
      nome: servicos.find((servico) => servico.id === servicoId)?.nome ?? "Serviço removido",
      vezes: dados.vezes,
      faturacao: dados.faturacao,
      percentagem: total > 0 ? (dados.faturacao / total) * 100 : 0,
    }))
    .sort((a, b) => b.faturacao - a.faturacao || b.vezes - a.vezes);
};
