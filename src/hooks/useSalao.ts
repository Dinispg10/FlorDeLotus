import { useCallback, useEffect, useState } from "react";
import * as api from "../lib/api";
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
