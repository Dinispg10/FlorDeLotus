import {
  combinarDataHora,
  diaDaSemanaISO,
  minutosDesdeMeiaNoite,
  somarMinutos,
} from "./datas";
import {
  GRELHA_FIM,
  GRELHA_INICIO,
  type Agendamento,
  type Ausencia,
  type Configuracoes,
  type HorarioDia,
} from "./types";

export type CandidatoAgendamento = {
  /** Preenchido quando se está a editar uma marcação existente. */
  id?: string;
  funcionarioId: string;
  data: string;
  inicio: string;
  duracaoMinutos: number;
};

/** Devolve a marcação que colide com o candidato, ou null se o horário estiver livre. */
export const encontrarConflito = (
  agendamentos: Agendamento[],
  candidato: CandidatoAgendamento,
): Agendamento | null => {
  const inicio = combinarDataHora(candidato.data, candidato.inicio).getTime();
  const fim = inicio + candidato.duracaoMinutos * 60000;

  return (
    agendamentos.find((item) => {
      if (item.id === candidato.id) return false;
      if (item.funcionarioId !== candidato.funcionarioId) return false;
      return item.inicioMs < fim && inicio < item.fimMs;
    }) ?? null
  );
};

/** Ausências de uma funcionária que apanham um determinado dia. */
export const ausenciasDoDia = (
  ausencias: Ausencia[],
  funcionarioId: string | null,
  data: string,
) =>
  ausencias.filter(
    (ausencia) =>
      (funcionarioId === null || ausencia.funcionarioId === funcionarioId) &&
      ausencia.dataInicio <= data &&
      data <= ausencia.dataFim,
  );

/**
 * Devolve a folga ou as férias que impedem esta marcação, ou null se a funcionária
 * estiver disponível.
 */
export const ausenciaQueBloqueia = (
  ausencias: Ausencia[],
  candidato: CandidatoAgendamento,
): Ausencia | null => {
  const inicioMin = minutosDesdeMeiaNoite(candidato.inicio);
  const fimMin = inicioMin + candidato.duracaoMinutos;

  return (
    ausenciasDoDia(ausencias, candidato.funcionarioId, candidato.data).find((ausencia) => {
      // Sem horas marcadas, a funcionária falta o dia inteiro.
      if (!ausencia.horaInicio || !ausencia.horaFim) return true;
      const desde = minutosDesdeMeiaNoite(ausencia.horaInicio);
      const ate = minutosDesdeMeiaNoite(ausencia.horaFim);
      return desde < fimMin && inicioMin < ate;
    }) ?? null
  );
};

export type ServicoPlaneado = {
  duracaoMinutos: number;
  /** Acontece ao mesmo tempo que o anterior, em vez de vir a seguir. */
  emParalelo: boolean;
};

/**
 * Dá horas a uma visita com vários serviços: por omissão vêm em cadeia, e os
 * marcados como paralelos começam à mesma hora que o serviço anterior. O que vier
 * depois de um par em paralelo arranca quando o mais demorado dos dois acabar.
 */
export const encadearServicos = <T extends ServicoPlaneado>(
  inicio: string,
  linhas: T[],
): (T & { inicio: string; fim: string })[] => {
  let inicioAnterior = inicio;
  let fimMaisTarde = inicio;

  return linhas.map((linha, indice) => {
    const comeca = indice === 0 ? inicio : linha.emParalelo ? inicioAnterior : fimMaisTarde;
    const acaba = somarMinutos(comeca, linha.duracaoMinutos);

    inicioAnterior = comeca;
    if (minutosDesdeMeiaNoite(acaba) > minutosDesdeMeiaNoite(fimMaisTarde)) {
      fimMaisTarde = acaba;
    }

    return { ...linha, inicio: comeca, fim: acaba };
  });
};

const paraHora = (minutos: number) =>
  `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;

/**
 * Horas que a grelha tem de mostrar: no mínimo GRELHA_INICIO-GRELHA_FIM, alargado
 * para caber o dia mais comprido do horário e qualquer marcação da semana.
 * Arredonda para horas cheias e nunca passa da meia-noite.
 */
export const intervaloDaGrelha = (
  configuracoes: Configuracoes,
  agendamentos: Agendamento[],
) => {
  let desde = minutosDesdeMeiaNoite(GRELHA_INICIO);
  let ate = minutosDesdeMeiaNoite(GRELHA_FIM);

  Object.values(configuracoes.horarioSemanal).forEach((horario) => {
    if (!horario.aberto) return;
    desde = Math.min(desde, minutosDesdeMeiaNoite(horario.inicio));
    ate = Math.max(ate, minutosDesdeMeiaNoite(horario.fim));
  });

  agendamentos.forEach((marcacao) => {
    const comeca = minutosDesdeMeiaNoite(marcacao.inicio);
    const acaba = minutosDesdeMeiaNoite(marcacao.fim);
    desde = Math.min(desde, comeca);
    // Uma marcação que acaba depois da meia-noite estica até ao fim do dia.
    ate = Math.max(ate, acaba <= comeca ? 24 * 60 : acaba);
  });

  return {
    inicio: paraHora(Math.max(0, Math.floor(desde / 60) * 60)),
    fim: paraHora(Math.min(24 * 60, Math.ceil(ate / 60) * 60)),
  };
};

/** Horário de abertura do salão no dia indicado. */
export const horarioDoDia = (configuracoes: Configuracoes, data: string): HorarioDia =>
  configuracoes.horarioSemanal[diaDaSemanaISO(data)];

/** Valida o formulário de marcação. Devolve a primeira mensagem de erro, ou null. */
export const validarAgendamento = (
  candidato: CandidatoAgendamento & { clienteNome: string },
  configuracoes: Configuracoes,
): string | null => {
  if (!candidato.clienteNome.trim()) {
    return "Escolhe ou cria um cliente para esta marcação.";
  }

  if (!candidato.funcionarioId) {
    return "Escolhe a funcionária que vai fazer o serviço.";
  }

  if (!candidato.data || !candidato.inicio) {
    return "Indica a data e a hora da marcação.";
  }

  if (!Number.isFinite(candidato.duracaoMinutos) || candidato.duracaoMinutos < 5) {
    return "A duração tem de ser de pelo menos 5 minutos.";
  }

  const horario = horarioDoDia(configuracoes, candidato.data);

  if (!horario.aberto) {
    return "O salão está fechado nesse dia. Muda a data ou altera o horário em Definições.";
  }

  const inicioMin = minutosDesdeMeiaNoite(candidato.inicio);
  const fimMin = inicioMin + candidato.duracaoMinutos;

  if (inicioMin < minutosDesdeMeiaNoite(horario.inicio) || fimMin > minutosDesdeMeiaNoite(horario.fim)) {
    return `Nesse dia o salão está aberto das ${horario.inicio} às ${horario.fim}. Esta marcação fica fora desse horário.`;
  }

  return null;
};

export type MarcacaoEmFaixa = {
  marcacao: Agendamento;
  faixa: number;
  totalFaixas: number;
};

/**
 * Coloca lado a lado as marcações que se sobrepõem na mesma coluna.
 * Precisamos disto na vista semanal, onde uma coluna é um dia inteiro e pode
 * ter várias funcionárias à mesma hora.
 */
export const distribuirEmFaixas = (marcacoes: Agendamento[]): MarcacaoEmFaixa[] => {
  const ordenadas = [...marcacoes].sort((a, b) => a.inicioMs - b.inicioMs || a.fimMs - b.fimMs);
  const resultado: MarcacaoEmFaixa[] = [];

  let grupo: MarcacaoEmFaixa[] = [];
  let fimDoGrupo = -Infinity;
  let fimDeCadaFaixa: number[] = [];

  const fecharGrupo = () => {
    const total = fimDeCadaFaixa.length || 1;
    grupo.forEach((item) => {
      item.totalFaixas = total;
    });
    resultado.push(...grupo);
    grupo = [];
    fimDeCadaFaixa = [];
    fimDoGrupo = -Infinity;
  };

  ordenadas.forEach((marcacao) => {
    // Começa um grupo novo quando já não há sobreposição com nada do grupo atual.
    if (marcacao.inicioMs >= fimDoGrupo) fecharGrupo();

    let faixa = fimDeCadaFaixa.findIndex((fim) => fim <= marcacao.inicioMs);
    if (faixa === -1) {
      faixa = fimDeCadaFaixa.length;
      fimDeCadaFaixa.push(marcacao.fimMs);
    } else {
      fimDeCadaFaixa[faixa] = marcacao.fimMs;
    }

    fimDoGrupo = Math.max(fimDoGrupo, marcacao.fimMs);
    grupo.push({ marcacao, faixa, totalFaixas: 1 });
  });

  fecharGrupo();
  return resultado;
};

/**
 * Versão transparente de uma cor #rrggbb, para pintar o fundo dos blocos com a
 * cor da funcionária sem perder a legibilidade do texto.
 */
export const corComTransparencia = (hex: string, alfa: number) => {
  const limpo = hex.replace("#", "");
  if (limpo.length !== 6) return hex;
  const r = parseInt(limpo.slice(0, 2), 16);
  const g = parseInt(limpo.slice(2, 4), 16);
  const b = parseInt(limpo.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alfa})`;
};

/** Normaliza um número de telefone português para comparação (só dígitos). */
export const normalizarTelefone = (telefone: string) => telefone.replace(/\D/g, "");

/** Remove acentos e maiúsculas, para pesquisar clientes sem chatices. */
export const normalizarTexto = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
