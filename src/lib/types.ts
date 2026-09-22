export type Funcionario = {
  id: string;
  nome: string;
  cor: string;
};

export type Servico = {
  id: string;
  nome: string;
  duracaoMinutos: number;
  preco: number;
  ativo: boolean;
};

export type Cliente = {
  id: string;
  nome: string;
  telefone: string;
  observacoes: string;
};

/**
 * Uma marcação ou está confirmada ou está por confirmar. Cancelar é apagar:
 * uma marcação que não vai acontecer não tem de ocupar espaço na agenda.
 */
export const STATUS_AGENDAMENTO = ["confirmado", "pendente"] as const;

export type StatusAgendamento = (typeof STATUS_AGENDAMENTO)[number];

export const ROTULO_STATUS: Record<StatusAgendamento, string> = {
  confirmado: "Confirmada",
  pendente: "Pendente",
};

export type Agendamento = {
  id: string;
  clienteId: string | null;
  cliente: string;
  telefone: string;
  funcionarioId: string;
  servicoId: string;
  /** Data local no formato AAAA-MM-DD */
  data: string;
  /** Hora local no formato HH:MM */
  inicio: string;
  fim: string;
  duracaoMinutos: number;
  status: StatusAgendamento;
  observacoes: string;
  /** Já foi avisado deste horário? */
  lembreteEnviado: boolean;
  /** Preço do serviço guardado na marcação (null antes da migração 013) */
  preco: number | null;
  /** Nome do serviço guardado na marcação ("" antes da migração 013) */
  servicoNome: string;
  /** Instante de início em milissegundos, para ordenar e detetar sobreposições */
  inicioMs: number;
  fimMs: number;
};

export const TIPOS_AUSENCIA = ["folga", "ferias"] as const;

export type TipoAusencia = (typeof TIPOS_AUSENCIA)[number];

export const ROTULO_AUSENCIA: Record<TipoAusencia, string> = {
  folga: "Folga",
  ferias: "Férias",
};

/** Período em que uma funcionária não está disponível. */
export type Ausencia = {
  id: string;
  funcionarioId: string;
  tipo: TipoAusencia;
  /** AAAA-MM-DD. O último dia está incluído. */
  dataInicio: string;
  dataFim: string;
  /** Null nos dois = dia inteiro. */
  horaInicio: string | null;
  horaFim: string | null;
  observacoes: string;
};

/**
 * A grelha da agenda mostra pelo menos estas horas. Se o horário do salão ou alguma
 * marcação da semana for mais cedo ou mais tarde, a grelha estica para as mostrar.
 */
export const GRELHA_INICIO = "08:00";
export const GRELHA_FIM = "20:00";

/** 1 = segunda, ... 7 = domingo (como o ISO). */
export type DiaDaSemana = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const DIAS_DA_SEMANA: { dia: DiaDaSemana; nome: string; curto: string }[] = [
  { dia: 1, nome: "Segunda-feira", curto: "SEG" },
  { dia: 2, nome: "Terça-feira", curto: "TER" },
  { dia: 3, nome: "Quarta-feira", curto: "QUA" },
  { dia: 4, nome: "Quinta-feira", curto: "QUI" },
  { dia: 5, nome: "Sexta-feira", curto: "SEX" },
  { dia: 6, nome: "Sábado", curto: "SÁB" },
  { dia: 7, nome: "Domingo", curto: "DOM" },
];

export type HorarioDia = {
  aberto: boolean;
  inicio: string;
  fim: string;
};

export type HorarioSemanal = Record<DiaDaSemana, HorarioDia>;

export type Configuracoes = {
  horarioSemanal: HorarioSemanal;
  lembreteHorasAntes: number;
  smsAtivo: boolean;
  modeloLembrete: string;
};

export const MODELO_LEMBRETE_PADRAO =
  "Olá {cliente}! Lembramos a sua marcação no Flor de Lotus: {dia} às {hora}, {servico} com {funcionaria}. Até já!";

const diaUtil: HorarioDia = { aberto: true, inicio: "09:00", fim: "19:00" };

export const CONFIGURACOES_PADRAO: Configuracoes = {
  horarioSemanal: {
    1: { ...diaUtil },
    2: { ...diaUtil },
    3: { ...diaUtil },
    4: { ...diaUtil },
    5: { ...diaUtil },
    6: { aberto: true, inicio: "09:00", fim: "18:00" },
    7: { aberto: false, inicio: "09:00", fim: "19:00" },
  },
  lembreteHorasAntes: 8,
  smsAtivo: false,
  modeloLembrete: MODELO_LEMBRETE_PADRAO,
};
