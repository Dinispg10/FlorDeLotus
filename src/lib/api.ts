import { supabase } from "./supabase";
import {
  CONFIGURACOES_PADRAO,
  DIAS_DA_SEMANA,
  type Agendamento,
  type Ausencia,
  type Cliente,
  type Configuracoes,
  type DiaDaSemana,
  type Funcionario,
  type HorarioDia,
  type HorarioSemanal,
  type Servico,
  type StatusAgendamento,
  type TipoAusencia,
} from "./types";
import { chaveData, combinarDataHora, horaLocal } from "./datas";

const client = () => {
  if (!supabase) {
    throw new Error("Supabase não está configurado. Verifica o ficheiro .env.");
  }
  return supabase;
};

/** Converte o erro do Supabase numa mensagem legível para quem está ao balcão. */
const falhar = (contexto: string, error: { message: string; code?: string } | null) => {
  if (!error) return;
  console.error(contexto, error);

  // 23P01: a base de dados recusou porque o horário já está ocupado.
  if (error.code === "23P01") {
    throw new Error(
      "Esse horário já foi ocupado por outra marcação (talvez noutro computador). Atualiza a agenda e escolhe outra hora.",
    );
  }

  // 42501: as regras da base de dados não deixam (ex.: só a gerente muda serviços).
  if (error.code === "42501") {
    throw new Error("Só a gerente pode fazer isto.");
  }

  if (error.message.toLowerCase().includes("failed to fetch")) {
    throw new Error("Sem ligação ao servidor. Verifica a internet e tenta outra vez.");
  }

  throw new Error(`${contexto}: ${error.message}`);
};

export type Papel = "gerente" | "funcionaria";

/**
 * O papel de quem entrou. Quem não tiver perfil conta como funcionária. Se a tabela
 * perfis ainda não existir (migração 012 por correr), a base de dados ainda deixa
 * tudo a todos, e a app mostra tudo como antes.
 */
export const carregarPapel = async (): Promise<Papel> => {
  const { data, error } = await client().from("perfis").select("papel").maybeSingle();
  if (error) {
    const semTabela = error.code === "PGRST205" || error.code === "42P01";
    if (!semTabela) console.error("Não foi possível ler o papel", error);
    return semTabela ? "gerente" : "funcionaria";
  }
  return data?.papel === "gerente" ? "gerente" : "funcionaria";
};

type RawFuncionario = {
  id: string;
  nome: string;
  cor: string | null;
};

type RawServico = {
  id: string;
  nome: string;
  duracao_minutos: number | null;
  preco: number | string | null;
  ativo: boolean | null;
};

type RawCliente = {
  id: string;
  nome: string;
  telefone: string | null;
  observacoes: string | null;
};

type RawAgendamento = {
  id: string;
  cliente_id: string | null;
  funcionario_id: string | null;
  servico_id: string | null;
  data_hora_inicio: string;
  data_hora_fim: string;
  duracao_minutos: number | null;
  status: string | null;
  telefone_cliente: string | null;
  observacoes: string | null;
  lembrete_enviado: boolean | null;
  // Só existem depois da migração 013.
  preco?: number | string | null;
  servico_nome?: string | null;
  clientes?: { nome: string | null; telefone: string | null } | null;
};

const paraFuncionario = (item: RawFuncionario): Funcionario => ({
  id: item.id,
  nome: item.nome,
  cor: item.cor ?? "#8B5CF6",
});

const paraServico = (item: RawServico): Servico => ({
  id: item.id,
  nome: item.nome,
  duracaoMinutos: item.duracao_minutos ?? 60,
  preco: Number(item.preco ?? 0),
  ativo: item.ativo ?? true,
});

const paraCliente = (item: RawCliente): Cliente => ({
  id: item.id,
  nome: item.nome,
  telefone: item.telefone ?? "",
  observacoes: item.observacoes ?? "",
});

const paraAgendamento = (item: RawAgendamento): Agendamento => {
  const inicio = new Date(item.data_hora_inicio);
  const fim = new Date(item.data_hora_fim);
  const duracao =
    item.duracao_minutos ?? Math.max(5, Math.round((fim.getTime() - inicio.getTime()) / 60000));

  return {
    id: item.id,
    clienteId: item.cliente_id,
    cliente: item.clientes?.nome ?? (item.cliente_id ? "Cliente sem nome" : "Cliente removido"),
    telefone: item.telefone_cliente ?? item.clientes?.telefone ?? "",
    funcionarioId: item.funcionario_id ?? "",
    servicoId: item.servico_id ?? "",
    data: chaveData(inicio),
    inicio: horaLocal(inicio),
    fim: horaLocal(fim),
    duracaoMinutos: duracao,
    status: item.status === "pendente" ? "pendente" : "confirmado",
    observacoes: item.observacoes ?? "",
    lembreteEnviado: item.lembrete_enviado ?? false,
    preco: item.preco === null || item.preco === undefined ? null : Number(item.preco),
    servicoNome: item.servico_nome ?? "",
    inicioMs: inicio.getTime(),
    fimMs: fim.getTime(),
  };
};

/* ---------------------------------------------------------------- */
/* Funcionários                                                      */
/* ---------------------------------------------------------------- */

export const listarFuncionarios = async (): Promise<Funcionario[]> => {
  const { data, error } = await client()
    .from("funcionarios")
    .select("id, nome, cor")
    .order("criado_em", { ascending: true });

  falhar("Não foi possível carregar as funcionárias", error);
  return (data ?? []).map(paraFuncionario);
};

export const criarFuncionario = async (dados: Omit<Funcionario, "id">) => {
  const { data, error } = await client()
    .from("funcionarios")
    .insert({
      nome: dados.nome,
      cor: dados.cor,
    })
    .select("id, nome, cor")
    .single();

  falhar("Não foi possível criar a funcionária", error);
  return paraFuncionario(data as RawFuncionario);
};

export const atualizarFuncionario = async (
  id: string,
  dados: Partial<Omit<Funcionario, "id">>,
) => {
  const { data, error } = await client()
    .from("funcionarios")
    .update({
      ...(dados.nome !== undefined ? { nome: dados.nome } : {}),
      ...(dados.cor !== undefined ? { cor: dados.cor } : {}),
    })
    .eq("id", id)
    .select("id, nome, cor")
    .single();

  falhar("Não foi possível guardar a funcionária", error);
  return paraFuncionario(data as RawFuncionario);
};

/**
 * Quantas marcações ainda por acontecer apontam para esta pessoa. Apagar a ficha de
 * alguém que vem amanhã deixava a marcação sem cliente ou sem funcionária.
 */
const marcacoesFuturas = async (coluna: "cliente_id" | "funcionario_id", id: string) => {
  const { count, error } = await client()
    .from("agendamentos")
    .select("id", { count: "exact", head: true })
    .eq(coluna, id)
    .gte("data_hora_fim", new Date().toISOString());

  falhar("Não foi possível confirmar as marcações", error);
  return count ?? 0;
};

const emTexto = (quantas: number) => (quantas === 1 ? "1 marcação" : `${quantas} marcações`);

/**
 * Apaga a funcionária. As marcações que já passaram ficam (para as estatísticas),
 * sem funcionária; as folgas dela vão com ela.
 */
export const apagarFuncionario = async (funcionaria: Funcionario) => {
  const futuras = await marcacoesFuturas("funcionario_id", funcionaria.id);
  if (futuras > 0) {
    throw new Error(
      `${funcionaria.nome} ainda tem ${emTexto(futuras)} por acontecer. Passa-as para outra funcionária ou cancela-as antes de a apagar.`,
    );
  }

  const { error } = await client().from("funcionarios").delete().eq("id", funcionaria.id);
  falhar("Não foi possível apagar a funcionária", error);
};

/* ---------------------------------------------------------------- */
/* Serviços                                                          */
/* ---------------------------------------------------------------- */

export const listarServicos = async (): Promise<Servico[]> => {
  const { data, error } = await client()
    .from("servicos")
    .select("id, nome, duracao_minutos, preco, ativo")
    .order("criado_em", { ascending: true });

  falhar("Não foi possível carregar os serviços", error);
  return (data ?? []).map(paraServico);
};

export const criarServico = async (dados: Omit<Servico, "id">) => {
  const { data, error } = await client()
    .from("servicos")
    .insert({
      nome: dados.nome,
      duracao_minutos: dados.duracaoMinutos,
      preco: dados.preco,
      ativo: dados.ativo,
    })
    .select("id, nome, duracao_minutos, preco, ativo")
    .single();

  falhar("Não foi possível criar o serviço", error);
  return paraServico(data as RawServico);
};

export const atualizarServico = async (id: string, dados: Partial<Omit<Servico, "id">>) => {
  const { data, error } = await client()
    .from("servicos")
    .update({
      ...(dados.nome !== undefined ? { nome: dados.nome } : {}),
      ...(dados.duracaoMinutos !== undefined ? { duracao_minutos: dados.duracaoMinutos } : {}),
      ...(dados.preco !== undefined ? { preco: dados.preco } : {}),
      ...(dados.ativo !== undefined ? { ativo: dados.ativo } : {}),
    })
    .eq("id", id)
    .select("id, nome, duracao_minutos, preco, ativo")
    .single();

  falhar("Não foi possível guardar o serviço", error);
  return paraServico(data as RawServico);
};

/* ---------------------------------------------------------------- */
/* Clientes                                                          */
/* ---------------------------------------------------------------- */

export const listarClientes = async (): Promise<Cliente[]> => {
  const { data, error } = await client()
    .from("clientes")
    .select("id, nome, telefone, observacoes")
    .order("nome", { ascending: true });

  falhar("Não foi possível carregar os clientes", error);
  return (data ?? []).map(paraCliente);
};

export const criarCliente = async (dados: {
  nome: string;
  telefone: string;
  observacoes?: string;
}): Promise<Cliente> => {
  const { data, error } = await client()
    .from("clientes")
    .insert({
      nome: dados.nome,
      telefone: dados.telefone || null,
      observacoes: dados.observacoes || null,
    })
    .select("id, nome, telefone, observacoes")
    .single();

  falhar("Não foi possível criar o cliente", error);
  return paraCliente(data as RawCliente);
};

export const atualizarCliente = async (id: string, dados: Partial<Omit<Cliente, "id">>) => {
  const { data, error } = await client()
    .from("clientes")
    .update({
      ...(dados.nome !== undefined ? { nome: dados.nome } : {}),
      ...(dados.telefone !== undefined ? { telefone: dados.telefone || null } : {}),
      ...(dados.observacoes !== undefined ? { observacoes: dados.observacoes || null } : {}),
    })
    .eq("id", id)
    .select("id, nome, telefone, observacoes")
    .single();

  falhar("Não foi possível guardar o cliente", error);
  return paraCliente(data as RawCliente);
};

/**
 * Apaga a ficha do cliente. As marcações que já passaram ficam (a faturação continua
 * certa) e passam a aparecer como "Cliente removido".
 */
export const apagarCliente = async (cliente: Cliente) => {
  const futuras = await marcacoesFuturas("cliente_id", cliente.id);
  if (futuras > 0) {
    throw new Error(
      `${cliente.nome} ainda tem ${emTexto(futuras)} por acontecer. Cancela-as antes de apagar a ficha.`,
    );
  }

  const { error } = await client().from("clientes").delete().eq("id", cliente.id);
  falhar("Não foi possível apagar o cliente", error);
};

/* ---------------------------------------------------------------- */
/* Agendamentos                                                      */
/* ---------------------------------------------------------------- */

// "*" em vez da lista de colunas: assim a app funciona antes e depois de a
// migração 013 (preço guardado em cada marcação) ter corrido.
const SELECT_AGENDAMENTO = "*, clientes(nome, telefone)";

/** Carrega os agendamentos entre duas datas locais (inclusive). */
export const listarAgendamentos = async (
  dataInicio: string,
  dataFim: string,
): Promise<Agendamento[]> => {
  const inicio = combinarDataHora(dataInicio, "00:00");
  const fim = combinarDataHora(dataFim, "00:00");
  fim.setDate(fim.getDate() + 1);

  const { data, error } = await client()
    .from("agendamentos")
    .select(SELECT_AGENDAMENTO)
    .gte("data_hora_inicio", inicio.toISOString())
    .lt("data_hora_inicio", fim.toISOString())
    .neq("status", "cancelado")
    .order("data_hora_inicio", { ascending: true });

  falhar("Não foi possível carregar a agenda", error);
  return (data ?? []).map((item) => paraAgendamento(item as unknown as RawAgendamento));
};

/** Histórico completo de um cliente, do mais recente para o mais antigo. */
/** As próximas marcações (ainda por acabar) de vários clientes, da mais cedo para a mais tarde. */
export const proximasMarcacoesDe = async (clienteIds: string[]): Promise<Agendamento[]> => {
  if (clienteIds.length === 0) return [];
  const { data, error } = await client()
    .from("agendamentos")
    .select(SELECT_AGENDAMENTO)
    .in("cliente_id", clienteIds)
    .gte("data_hora_fim", new Date().toISOString())
    .order("data_hora_inicio", { ascending: true })
    .limit(60);

  falhar("Não foi possível procurar as marcações", error);
  return (data ?? []).map((item) => paraAgendamento(item as unknown as RawAgendamento));
};

export const listarAgendamentosDoCliente = async (clienteId: string): Promise<Agendamento[]> => {
  const { data, error } = await client()
    .from("agendamentos")
    .select(SELECT_AGENDAMENTO)
    .eq("cliente_id", clienteId)
    .neq("status", "cancelado")
    .order("data_hora_inicio", { ascending: false });

  falhar("Não foi possível carregar o histórico do cliente", error);
  return (data ?? []).map((item) => paraAgendamento(item as unknown as RawAgendamento));
};

export type DadosAgendamento = {
  clienteId: string;
  funcionarioId: string;
  servicoId: string;
  data: string;
  inicio: string;
  duracaoMinutos: number;
  status: StatusAgendamento;
  telefone: string;
  observacoes: string;
};

const corpoAgendamento = (dados: DadosAgendamento) => {
  const inicio = combinarDataHora(dados.data, dados.inicio);
  const fim = new Date(inicio.getTime() + dados.duracaoMinutos * 60000);

  return {
    cliente_id: dados.clienteId,
    funcionario_id: dados.funcionarioId,
    servico_id: dados.servicoId,
    data_hora_inicio: inicio.toISOString(),
    data_hora_fim: fim.toISOString(),
    duracao_minutos: dados.duracaoMinutos,
    status: dados.status,
    telefone_cliente: dados.telefone || null,
    observacoes: dados.observacoes || null,
  };
};

export const criarAgendamento = async (dados: DadosAgendamento): Promise<Agendamento> => {
  const { data, error } = await client()
    .from("agendamentos")
    .insert(corpoAgendamento(dados))
    .select(SELECT_AGENDAMENTO)
    .single();

  falhar("Não foi possível guardar a marcação", error);
  return paraAgendamento(data as unknown as RawAgendamento);
};

export const atualizarAgendamento = async (
  id: string,
  dados: DadosAgendamento,
): Promise<Agendamento> => {
  const { data, error } = await client()
    .from("agendamentos")
    .update(corpoAgendamento(dados))
    .eq("id", id)
    .select(SELECT_AGENDAMENTO)
    .single();

  falhar("Não foi possível guardar a marcação", error);
  return paraAgendamento(data as unknown as RawAgendamento);
};

export const alterarStatusAgendamento = async (
  id: string,
  status: StatusAgendamento,
): Promise<Agendamento> => {
  const { data, error } = await client()
    .from("agendamentos")
    .update({ status })
    .eq("id", id)
    .select(SELECT_AGENDAMENTO)
    .single();

  falhar("Não foi possível alterar o estado da marcação", error);
  return paraAgendamento(data as unknown as RawAgendamento);
};

export const apagarAgendamento = async (id: string) => {
  const { error } = await client().from("agendamentos").delete().eq("id", id);
  falhar("Não foi possível apagar a marcação", error);
};

/* ---------------------------------------------------------------- */
/* Folgas e férias                                                   */
/* ---------------------------------------------------------------- */

type RawAusencia = {
  id: string;
  funcionario_id: string;
  tipo: string;
  data_inicio: string;
  data_fim: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  observacoes: string | null;
};

/** As horas vêm do Postgres como "14:00:00"; a app só usa horas e minutos. */
const horaCurta = (valor: string | null) => (valor ? valor.slice(0, 5) : null);

const paraAusencia = (item: RawAusencia): Ausencia => ({
  id: item.id,
  funcionarioId: item.funcionario_id,
  tipo: (item.tipo as TipoAusencia) ?? "folga",
  dataInicio: item.data_inicio,
  dataFim: item.data_fim,
  horaInicio: horaCurta(item.hora_inicio),
  horaFim: horaCurta(item.hora_fim),
  observacoes: item.observacoes ?? "",
});

const SELECT_AUSENCIA =
  "id, funcionario_id, tipo, data_inicio, data_fim, hora_inicio, hora_fim, observacoes";

/** Ausências que tocam no intervalo pedido, mesmo que comecem antes ou acabem depois. */
export const listarAusencias = async (
  dataInicio: string,
  dataFim: string,
): Promise<Ausencia[]> => {
  const { data, error } = await client()
    .from("ausencias")
    .select(SELECT_AUSENCIA)
    .lte("data_inicio", dataFim)
    .gte("data_fim", dataInicio)
    .order("data_inicio", { ascending: true });

  falhar("Não foi possível carregar as folgas", error);
  return (data ?? []).map((item) => paraAusencia(item as RawAusencia));
};

/** Todas as ausências de uma funcionária a partir de hoje, para a ficha dela. */
export const listarAusenciasDaFuncionaria = async (
  funcionarioId: string,
): Promise<Ausencia[]> => {
  const { data, error } = await client()
    .from("ausencias")
    .select(SELECT_AUSENCIA)
    .eq("funcionario_id", funcionarioId)
    .order("data_inicio", { ascending: true });

  falhar("Não foi possível carregar as folgas", error);
  return (data ?? []).map((item) => paraAusencia(item as RawAusencia));
};

export const criarAusencia = async (dados: {
  funcionarioId: string;
  tipo: TipoAusencia;
  dataInicio: string;
  dataFim: string;
  horaInicio: string | null;
  horaFim: string | null;
  observacoes: string;
}): Promise<Ausencia> => {
  const { data, error } = await client()
    .from("ausencias")
    .insert({
      funcionario_id: dados.funcionarioId,
      tipo: dados.tipo,
      data_inicio: dados.dataInicio,
      data_fim: dados.dataFim,
      hora_inicio: dados.horaInicio,
      hora_fim: dados.horaFim,
      observacoes: dados.observacoes || null,
    })
    .select(SELECT_AUSENCIA)
    .single();

  falhar("Não foi possível guardar a folga", error);
  return paraAusencia(data as RawAusencia);
};

export const apagarAusencia = async (id: string) => {
  const { error } = await client().from("ausencias").delete().eq("id", id);
  falhar("Não foi possível apagar a folga", error);
};

/* ---------------------------------------------------------------- */
/* Configurações                                                     */
/* ---------------------------------------------------------------- */

/**
 * O horário de cada dia fica guardado numa linha da tabela configuracoes,
 * com o nome "horario_1" (segunda) a "horario_7" (domingo) e o valor
 * "09:00-19:00" ou "fechado".
 */
const chaveDoDia = (dia: DiaDaSemana) => `horario_${dia}`;

const HORA_VALIDA = /^\d{2}:\d{2}$/;

const lerHorarioDia = (valor: string | undefined, padrao: HorarioDia): HorarioDia => {
  if (!valor) return { ...padrao };
  if (valor.trim().toLowerCase() === "fechado") return { ...padrao, aberto: false };

  const [inicio, fim] = valor.split("-").map((parte) => parte.trim());
  if (!HORA_VALIDA.test(inicio ?? "") || !HORA_VALIDA.test(fim ?? "")) return { ...padrao };
  return { aberto: true, inicio, fim };
};

const escreverHorarioDia = (horario: HorarioDia) =>
  horario.aberto ? `${horario.inicio}-${horario.fim}` : "fechado";

export const carregarConfiguracoes = async (): Promise<Configuracoes> => {
  const { data, error } = await client().from("configuracoes").select("nome, valor");

  falhar("Não foi possível carregar as configurações", error);

  const mapa = new Map((data ?? []).map((item) => [item.nome as string, item.valor as string]));
  const lembrete = Number(mapa.get("lembrete_horas_antes"));

  const horarioSemanal = { ...CONFIGURACOES_PADRAO.horarioSemanal };
  DIAS_DA_SEMANA.forEach(({ dia }) => {
    horarioSemanal[dia] = lerHorarioDia(
      mapa.get(chaveDoDia(dia)),
      CONFIGURACOES_PADRAO.horarioSemanal[dia],
    );
  });

  return {
    horarioSemanal,
    lembreteHorasAntes: Number.isFinite(lembrete)
      ? lembrete
      : CONFIGURACOES_PADRAO.lembreteHorasAntes,
    smsAtivo: mapa.get("sms_ativo") === "true",
    modeloLembrete: mapa.get("modelo_lembrete") ?? CONFIGURACOES_PADRAO.modeloLembrete,
  };
};

export const guardarModeloLembrete = async (modelo: string) => {
  const { error } = await client()
    .from("configuracoes")
    .upsert(
      { nome: "modelo_lembrete", valor: modelo, atualizado_em: new Date().toISOString() },
      { onConflict: "nome" },
    );

  falhar("Não foi possível guardar o texto da mensagem", error);
};

/**
 * Regista que o cliente foi avisado de uma marcação: fica no histórico de
 * mensagens e marca a própria marcação, para não se avisar duas vezes.
 */
export const registarLembrete = async (dados: {
  agendamentoId: string;
  destinatario: string;
  mensagem: string;
}) => {
  const { error } = await client().from("logs_sms").insert({
    agendamento_id: dados.agendamentoId,
    destinatario: dados.destinatario,
    tipo: "lembrete",
    status: "enviado",
    mensagem: dados.mensagem,
  });

  falhar("Não foi possível registar a mensagem", error);

  const { error: erroMarcacao } = await client()
    .from("agendamentos")
    .update({ lembrete_enviado: true })
    .eq("id", dados.agendamentoId);

  falhar("Não foi possível marcar o lembrete", erroMarcacao);
};

export const anularLembrete = async (agendamentoId: string) => {
  const { error } = await client()
    .from("agendamentos")
    .update({ lembrete_enviado: false })
    .eq("id", agendamentoId);

  falhar("Não foi possível anular o lembrete", error);
};

export const guardarHorarioSemanal = async (horario: HorarioSemanal) => {
  const linhas = DIAS_DA_SEMANA.map(({ dia }) => ({
    nome: chaveDoDia(dia),
    valor: escreverHorarioDia(horario[dia]),
    atualizado_em: new Date().toISOString(),
  }));

  const { error } = await client().from("configuracoes").upsert(linhas, { onConflict: "nome" });
  falhar("Não foi possível guardar o horário", error);
};
