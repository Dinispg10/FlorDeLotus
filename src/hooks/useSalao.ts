import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "../lib/api";
import { supabase } from "../lib/supabase";
import { inicioDaSemana, somarDias } from "../lib/datas";
import {
  CONFIGURACOES_PADRAO,
  type Agendamento,
  type Ausencia,
  type Cliente,
  type Configuracoes,
  type Funcionario,
  type Servico,
} from "../lib/types";

const mensagemDeErro = (erro: unknown) =>
  erro instanceof Error ? erro.message : "Ocorreu um erro inesperado.";

/**
 * Carrega e mantém os dados do salão.
 * A agenda é carregada à semana (segunda a domingo) do dia selecionado.
 */
export function useSalao(ativo: boolean, diaSelecionado: string) {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [ausencias, setAusencias] = useState<Ausencia[]>([]);
  const [configuracoes, setConfiguracoes] = useState<Configuracoes>(CONFIGURACOES_PADRAO);
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState("");

  const segunda = inicioDaSemana(diaSelecionado);
  const domingo = somarDias(segunda, 6);

  const carregarBase = useCallback(async () => {
    if (!ativo) return;
    try {
      const [listaFuncionarios, listaServicos, listaClientes, config] = await Promise.all([
        api.listarFuncionarios(),
        api.listarServicos(),
        api.listarClientes(),
        api.carregarConfiguracoes(),
      ]);
      setFuncionarios(listaFuncionarios);
      setServicos(listaServicos);
      setClientes(listaClientes);
      setConfiguracoes(config);
      setErro("");
    } catch (causa) {
      setErro(mensagemDeErro(causa));
    }
  }, [ativo]);

  const carregarAgenda = useCallback(async () => {
    if (!ativo) return;
    try {
      const [marcacoes, folgas] = await Promise.all([
        api.listarAgendamentos(segunda, domingo),
        api.listarAusencias(segunda, domingo),
      ]);
      setAgendamentos(marcacoes);
      setAusencias(folgas);
      setErro("");
    } catch (causa) {
      setErro(mensagemDeErro(causa));
    }
  }, [ativo, segunda, domingo]);

  // As subscrições abaixo vivem enquanto a sessão durar; estas referências dão-lhes
  // sempre a versão atual das funções (que muda quando se muda de semana).
  const recarregarAgendaAtual = useRef(carregarAgenda);
  const recarregarBaseAtual = useRef(carregarBase);
  useEffect(() => {
    recarregarAgendaAtual.current = carregarAgenda;
  }, [carregarAgenda]);
  useEffect(() => {
    recarregarBaseAtual.current = carregarBase;
  }, [carregarBase]);

  /**
   * Tempo real: quando outro aparelho (o telemóvel de uma funcionária, o outro
   * computador) muda alguma coisa, o Supabase avisa e esta app recarrega sozinha.
   * Precisa das tabelas na publicação supabase_realtime (migração 010).
   */
  useEffect(() => {
    if (!ativo || !supabase) return;
    const ligacao = supabase;
    const temporizadores: Record<"agenda" | "base", number | undefined> = {
      agenda: undefined,
      base: undefined,
    };

    // Uma visita com três serviços são três avisos seguidos: dá uma só recarga.
    const agendar = (tipo: "agenda" | "base") => {
      window.clearTimeout(temporizadores[tipo]);
      temporizadores[tipo] = window.setTimeout(() => {
        if (tipo === "agenda") recarregarAgendaAtual.current();
        else recarregarBaseAtual.current();
      }, 400);
    };

    const canal = ligacao
      .channel("alteracoes-do-salao")
      .on("postgres_changes", { event: "*", schema: "public", table: "agendamentos" }, () => agendar("agenda"))
      .on("postgres_changes", { event: "*", schema: "public", table: "ausencias" }, () => agendar("agenda"))
      .on("postgres_changes", { event: "*", schema: "public", table: "clientes" }, () => agendar("base"))
      .on("postgres_changes", { event: "*", schema: "public", table: "funcionarios" }, () => agendar("base"))
      .on("postgres_changes", { event: "*", schema: "public", table: "servicos" }, () => agendar("base"))
      .on("postgres_changes", { event: "*", schema: "public", table: "configuracoes" }, () => agendar("base"))
      .subscribe();

    return () => {
      window.clearTimeout(temporizadores.agenda);
      window.clearTimeout(temporizadores.base);
      ligacao.removeChannel(canal);
    };
  }, [ativo]);

  /**
   * Rede de segurança: ao voltar à app, recarrega. O telemóvel corta as ligações
   * quando o ecrã apaga, e aí os avisos em tempo real perdem-se.
   */
  useEffect(() => {
    if (!ativo) return;
    let ultimaVez = Date.now();

    const aoVoltar = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - ultimaVez < 15000) return;
      ultimaVez = Date.now();
      recarregarAgendaAtual.current();
      recarregarBaseAtual.current();
    };

    window.addEventListener("focus", aoVoltar);
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      window.removeEventListener("focus", aoVoltar);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [ativo]);

  useEffect(() => {
    if (!ativo) return;
    let cancelado = false;

    const arrancar = async () => {
      setACarregar(true);
      await Promise.all([carregarBase(), carregarAgenda()]);
      if (!cancelado) setACarregar(false);
    };

    arrancar();
    return () => {
      cancelado = true;
    };
  }, [ativo, carregarBase, carregarAgenda]);

  /** Substitui (ou acrescenta) uma marcação na lista já carregada. */
  const guardarNaLista = useCallback((agendamento: Agendamento) => {
    setAgendamentos((anteriores) => {
      const existe = anteriores.some((item) => item.id === agendamento.id);
      const lista = existe
        ? anteriores.map((item) => (item.id === agendamento.id ? agendamento : item))
        : [...anteriores, agendamento];
      return lista.sort((a, b) => a.inicioMs - b.inicioMs);
    });
  }, []);

  const removerDaLista = useCallback((id: string) => {
    setAgendamentos((anteriores) => anteriores.filter((item) => item.id !== id));
  }, []);

  return {
    funcionarios,
    servicos,
    clientes,
    agendamentos,
    ausencias,
    configuracoes,
    aCarregar,
    erro,
    setErro,
    setFuncionarios,
    setServicos,
    setClientes,
    setAusencias,
    guardarNaLista,
    removerDaLista,
    recarregarBase: carregarBase,
    recarregarAgenda: carregarAgenda,
  };
}
