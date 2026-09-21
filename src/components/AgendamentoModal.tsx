import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import * as api from "../lib/api";
import {
  ausenciaQueBloqueia,
  encadearServicos,
  encontrarConflito,
  horarioDoDia,
  normalizarTelefone,
  normalizarTexto,
  validarAgendamento,
} from "../lib/agenda";
import { combinarDataHora, dataPorExtenso, minutosDesdeMeiaNoite } from "../lib/datas";
import {
  ROTULO_AUSENCIA,
  ROTULO_STATUS,
  STATUS_AGENDAMENTO,
  type Agendamento,
  type Ausencia,
  type Cliente,
  type Configuracoes,
  type Funcionario,
  type Servico,
  type StatusAgendamento,
} from "../lib/types";
import ConfirmarModal from "./ConfirmarModal";

export type PreDefinicao = {
  data: string;
  inicio?: string;
  funcionarioId?: string;
};

/** Um serviço da visita. Várias linhas = vários serviços na mesma ida ao salão. */
type LinhaServico = {
  chave: string;
  servicoId: string;
  funcionarioId: string;
  duracaoMinutos: number;
  /** Em vez de vir a seguir, acontece ao mesmo tempo que o serviço anterior. */
  emParalelo: boolean;
};

type Props = {
  agendamento: Agendamento | null;
  preDefinicao: PreDefinicao;
  funcionarios: Funcionario[];
  servicos: Servico[];
  clientes: Cliente[];
  agendamentosDaSemana: Agendamento[];
  ausencias: Ausencia[];
  configuracoes: Configuracoes;
  onFechar: () => void;
  onGuardado: (agendamentos: Agendamento[], clienteNovo: Cliente | null) => void;
  onApagado: (id: string) => void;
};

export default function AgendamentoModal({
  agendamento,
  preDefinicao,
  funcionarios,
  servicos,
  clientes,
  agendamentosDaSemana,
  ausencias,
  configuracoes,
  onFechar,
  onGuardado,
  onApagado,
}: Props) {
  const emEdicao = agendamento !== null;
  const funcionariosAtivos = funcionarios.filter(
    (item) => item.ativo || item.id === agendamento?.funcionarioId,
  );
  const servicosAtivos = servicos.filter(
    (item) => item.ativo || item.id === agendamento?.servicoId,
  );

  const [clienteId, setClienteId] = useState<string | null>(agendamento?.clienteId ?? null);
  const [nomeCliente, setNomeCliente] = useState(agendamento?.cliente ?? "");
  const [telefone, setTelefone] = useState(agendamento?.telefone ?? "");
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);

  const [data, setData] = useState(agendamento?.data ?? preDefinicao.data);
  const [inicio, setInicio] = useState(
    agendamento?.inicio ??
      preDefinicao.inicio ??
      horarioDoDia(configuracoes, agendamento?.data ?? preDefinicao.data).inicio,
  );
  const [status, setStatus] = useState<StatusAgendamento>(agendamento?.status ?? "confirmado");
  const [observacoes, setObservacoes] = useState(agendamento?.observacoes ?? "");

  const [linhas, setLinhas] = useState<LinhaServico[]>(() => [
    {
      chave: "1",
      servicoId: agendamento?.servicoId ?? servicosAtivos[0]?.id ?? "",
      funcionarioId:
        agendamento?.funcionarioId ??
        preDefinicao.funcionarioId ??
        funcionariosAtivos[0]?.id ??
        "",
      duracaoMinutos: agendamento?.duracaoMinutos ?? servicosAtivos[0]?.duracaoMinutos ?? 60,
      emParalelo: false,
    },
  ]);

  const [erro, setErro] = useState("");
  const [aGuardar, setAGuardar] = useState(false);
  const [confirmarCancelar, setConfirmarCancelar] = useState(false);
  const primeiroCampo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    primeiroCampo.current?.focus();
  }, []);

  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") onFechar();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  const sugestoes = useMemo(() => {
    const procura = normalizarTexto(nomeCliente);
    const digitos = normalizarTelefone(telefone);
    if (!procura && !digitos) return [];

    return clientes
      .filter((cliente) => {
        if (!cliente.ativo) return false;
        const porNome = procura ? normalizarTexto(cliente.nome).includes(procura) : false;
        const porTelefone =
          digitos.length >= 6 ? normalizarTelefone(cliente.telefone).includes(digitos) : false;
        return porNome || porTelefone;
      })
      .slice(0, 6);
  }, [clientes, nomeCliente, telefone]);

  const clienteSelecionado = clientes.find((cliente) => cliente.id === clienteId) ?? null;
  const vaiCriarCliente = clienteId === null && nomeCliente.trim().length > 0;

  /**
   * A que horas começa cada serviço: em cadeia, ou ao mesmo tempo que o anterior
   * quando assim for pedido (ex.: manicure enquanto a cor atua).
   */
  const agenda = useMemo(() => encadearServicos(inicio, linhas), [inicio, linhas]);

  const fimDaVisita = agenda.reduce(
    (tarde, item) =>
      minutosDesdeMeiaNoite(item.fim) > minutosDesdeMeiaNoite(tarde) ? item.fim : tarde,
    inicio,
  );

  /** As linhas ainda não existem na base de dados, mas já ocupam horário entre si. */
  const comoAgendamentos = useMemo<Agendamento[]>(
    () =>
      agenda.map((item, indice) => ({
        id: `nova-${indice}`,
        clienteId: null,
        cliente: nomeCliente || "Esta visita",
        telefone: "",
        funcionarioId: item.funcionarioId,
        servicoId: item.servicoId,
        data,
        inicio: item.inicio,
        fim: item.fim,
        duracaoMinutos: item.duracaoMinutos,
        status: "confirmado",
        observacoes: "",
        lembreteEnviado: false,
        inicioMs: combinarDataHora(data, item.inicio).getTime(),
        fimMs: combinarDataHora(data, item.fim).getTime(),
      })),
    [agenda, data, nomeCliente],
  );

  /** Primeiro problema encontrado em qualquer um dos serviços. */
  const problema = useMemo(() => {
    for (const [indice, item] of agenda.entries()) {
      const candidato = {
        id: agendamento?.id,
        funcionarioId: item.funcionarioId,
        data,
        inicio: item.inicio,
        duracaoMinutos: item.duracaoMinutos,
      };

      const nome = servicos.find((servico) => servico.id === item.servicoId)?.nome ?? "O serviço";
      const quem =
        funcionarios.find((funcionario) => funcionario.id === item.funcionarioId)?.nome ??
        "A funcionária";

      const folga = ausenciaQueBloqueia(ausencias, candidato);
      if (folga) {
        return `${quem} está de ${ROTULO_AUSENCIA[folga.tipo].toLowerCase()} nesse dia.`;
      }

      const outrasLinhas = comoAgendamentos.filter((_, outro) => outro !== indice);
      const conflito = encontrarConflito([...agendamentosDaSemana, ...outrasLinhas], candidato);
      if (conflito) {
        return `${nome} às ${item.inicio}: ${quem} já tem ${conflito.cliente} das ${conflito.inicio} às ${conflito.fim}.`;
      }
    }

    return null;
  }, [
    agenda,
    agendamento?.id,
    agendamentosDaSemana,
    ausencias,
    comoAgendamentos,
    data,
    funcionarios,
    servicos,
  ]);

  const precoTotal = agenda.reduce(
    (total, item) => total + (servicos.find((s) => s.id === item.servicoId)?.preco ?? 0),
    0,
  );

  const escolherCliente = (cliente: Cliente) => {
    setClienteId(cliente.id);
    setNomeCliente(cliente.nome);
    if (cliente.telefone) setTelefone(cliente.telefone);
    setMostrarSugestoes(false);
    setErro("");
  };

  const alterarLinha = (chave: string, mudanca: Partial<LinhaServico>) =>
    setLinhas((anteriores) =>
      anteriores.map((linha) => (linha.chave === chave ? { ...linha, ...mudanca } : linha)),
    );

  const escolherServico = (chave: string, servicoId: string) => {
    const servico = servicos.find((item) => item.id === servicoId);
    alterarLinha(chave, {
      servicoId,
      ...(servico ? { duracaoMinutos: servico.duracaoMinutos } : {}),
    });
  };

  const acrescentarServico = () => {
    const ultima = linhas[linhas.length - 1];
    const seguinte =
      servicosAtivos.find((item) => item.id !== ultima?.servicoId) ?? servicosAtivos[0];

    setLinhas((anteriores) => [
      ...anteriores,
      {
        chave: `${Date.now()}`,
        servicoId: seguinte?.id ?? "",
        funcionarioId: ultima?.funcionarioId ?? funcionariosAtivos[0]?.id ?? "",
        duracaoMinutos: seguinte?.duracaoMinutos ?? 60,
        emParalelo: false,
      },
    ]);
    setErro("");
  };

  const removerLinha = (chave: string) =>
    setLinhas((anteriores) => anteriores.filter((linha) => linha.chave !== chave));

  const guardar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();

    for (const item of agenda) {
      const aviso = validarAgendamento(
        {
          id: agendamento?.id,
          funcionarioId: item.funcionarioId,
          data,
          inicio: item.inicio,
          duracaoMinutos: item.duracaoMinutos,
          clienteNome: nomeCliente,
        },
        configuracoes,
      );

      if (aviso) {
        setErro(aviso);
        return;
      }
    }

    if (problema) {
      setErro(problema);
      return;
    }

    setAGuardar(true);
    setErro("");

    const criados: Agendamento[] = [];

    try {
      let clienteFinalId = clienteId;
      let clienteNovo: Cliente | null = null;

      if (!clienteFinalId) {
        clienteNovo = await api.criarCliente({
          nome: nomeCliente.trim(),
          telefone: telefone.trim(),
        });
        clienteFinalId = clienteNovo.id;
      } else if (
        clienteSelecionado &&
        telefone.trim() &&
        clienteSelecionado.telefone !== telefone.trim()
      ) {
        // O telefone mudou na ficha: manter o cliente atualizado.
        await api.atualizarCliente(clienteFinalId, { telefone: telefone.trim() });
      }

      if (agendamento) {
        const item = agenda[0];
        const guardado = await api.atualizarAgendamento(agendamento.id, {
          clienteId: clienteFinalId,
          funcionarioId: item.funcionarioId,
          servicoId: item.servicoId,
          data,
          inicio: item.inicio,
          duracaoMinutos: item.duracaoMinutos,
          status,
          telefone: telefone.trim(),
          observacoes: observacoes.trim(),
        });

        onGuardado([guardado], clienteNovo);
        return;
      }

      for (const item of agenda) {
        criados.push(
          await api.criarAgendamento({
            clienteId: clienteFinalId,
            funcionarioId: item.funcionarioId,
            servicoId: item.servicoId,
            data,
            inicio: item.inicio,
            duracaoMinutos: item.duracaoMinutos,
            status,
            telefone: telefone.trim(),
            observacoes: observacoes.trim(),
          }),
        );
      }

      onGuardado(criados, clienteNovo);
    } catch (causa) {
      // Se falhou a meio, desfaz o que já entrou para não ficar meia visita marcada.
      await Promise.all(criados.map((item) => api.apagarAgendamento(item.id).catch(() => {})));
      setErro(causa instanceof Error ? causa.message : "Não foi possível guardar a marcação.");
      setAGuardar(false);
    }
  };

  /** Cancelar uma marcação é tirá-la da agenda. */
  const cancelar = async () => {
    if (!agendamento) return;
    setAGuardar(true);
    try {
      await api.apagarAgendamento(agendamento.id);
      onApagado(agendamento.id);
    } catch (causa) {
      setConfirmarCancelar(false);
      setErro(causa instanceof Error ? causa.message : "Não foi possível cancelar a marcação.");
      setAGuardar(false);
    }
  };

  return (
    <div className="modal-overlay" onMouseDown={onFechar}>
      <div
        className="modal-card modal-larga"
        role="dialog"
        aria-modal="true"
        aria-label={emEdicao ? "Editar marcação" : "Nova marcação"}
        onMouseDown={(evento) => evento.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <p className="eyebrow">{emEdicao ? "Editar marcação" : "Nova marcação"}</p>
            <h2>{emEdicao ? agendamento.cliente : "Quem vem ao salão?"}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onFechar} aria-label="Fechar">
            ×
          </button>
        </header>

        <form onSubmit={guardar} className="booking-form">
          <div className="inline-fields">
            <div className="campo-cliente">
              <label>
                Cliente
                <input
                  ref={primeiroCampo}
                  type="text"
                  value={nomeCliente}
                  onChange={(evento) => {
                    setNomeCliente(evento.target.value);
                    setClienteId(null);
                    setMostrarSugestoes(true);
                    setErro("");
                  }}
                  onFocus={() => setMostrarSugestoes(true)}
                  placeholder="Escreve o nome para procurar"
                  autoComplete="off"
                />
              </label>

              {mostrarSugestoes && sugestoes.length > 0 ? (
                <ul className="sugestoes">
                  {sugestoes.map((cliente) => (
                    <li key={cliente.id}>
                      <button type="button" onClick={() => escolherCliente(cliente)}>
                        <strong>{cliente.nome}</strong>
                        <span>{cliente.telefone || "sem telefone"}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <label>
              Telefone
              <input
                type="tel"
                value={telefone}
                onChange={(evento) => setTelefone(evento.target.value)}
                placeholder="+351 912 345 678"
              />
            </label>
          </div>

          {clienteSelecionado ? (
            <p className="dica sucesso">Cliente já registado: {clienteSelecionado.nome}</p>
          ) : null}
          {vaiCriarCliente ? (
            <p className="dica">Vai ser criada uma ficha nova para «{nomeCliente.trim()}».</p>
          ) : null}

          <div className="inline-fields">
            <label>
              Data
              <input type="date" value={data} onChange={(evento) => setData(evento.target.value)} />
            </label>

            <label>
              Começa às
              <input
                type="time"
                step={300}
                value={inicio}
                onChange={(evento) => setInicio(evento.target.value)}
              />
            </label>
          </div>

          <div className="lista-servicos">
            {agenda.map((item, indice) => (
              <div key={item.chave} className="linha-servico">
                {indice > 0 ? (
                  <label className="checkbox linha-paralelo">
                    <input
                      type="checkbox"
                      checked={item.emParalelo}
                      onChange={(evento) =>
                        alterarLinha(item.chave, { emParalelo: evento.target.checked })
                      }
                    />
                    à mesma hora que o anterior
                  </label>
                ) : null}

                <div className="campos-servico">
                  <label>
                    Serviço
                    <select
                      value={item.servicoId}
                      onChange={(evento) => escolherServico(item.chave, evento.target.value)}
                    >
                      {servicosAtivos.map((servico) => (
                        <option key={servico.id} value={servico.id}>
                          {servico.nome}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Funcionária
                    <select
                      value={item.funcionarioId}
                      onChange={(evento) =>
                        alterarLinha(item.chave, { funcionarioId: evento.target.value })
                      }
                    >
                      {funcionariosAtivos.map((funcionario) => (
                        <option key={funcionario.id} value={funcionario.id}>
                          {funcionario.nome}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="campo-duracao">
                    Min
                    <input
                      type="number"
                      min={5}
                      step={5}
                      value={item.duracaoMinutos}
                      onChange={(evento) =>
                        alterarLinha(item.chave, { duracaoMinutos: Number(evento.target.value) })
                      }
                    />
                  </label>

                  <span className="horas-servico">
                    {item.inicio}-{item.fim}
                  </span>

                  {linhas.length > 1 ? (
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => removerLinha(item.chave)}
                      aria-label="Tirar este serviço"
                      title="Tirar este serviço"
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              </div>
            ))}

            {emEdicao ? null : (
              <button type="button" className="ghost-button" onClick={acrescentarServico}>
                + Acrescentar serviço
              </button>
            )}
          </div>

          {emEdicao ? (
            <label>
              Estado
              <select
                value={status}
                onChange={(evento) => setStatus(evento.target.value as StatusAgendamento)}
              >
                {STATUS_AGENDAMENTO.map((valor) => (
                  <option key={valor} value={valor}>
                    {ROTULO_STATUS[valor]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label>
            Observações
            <textarea
              rows={2}
              value={observacoes}
              onChange={(evento) => setObservacoes(evento.target.value)}
              placeholder="Ex: alergia a amoníaco, quer franja"
            />
          </label>

          {problema ? (
            <p className="aviso-conflito" role="alert">
              ⚠ {problema}
            </p>
          ) : null}

          {erro ? (
            <p className="login-error" role="alert">
              {erro}
            </p>
          ) : null}

          <div className="booking-preview">
            <span>Resumo</span>
            <strong>
              {inicio}-{fimDaVisita} ·{" "}
              {linhas.length === 1 ? "1 serviço" : `${linhas.length} serviços`} ·{" "}
              {precoTotal > 0 ? `${precoTotal.toFixed(2)} €` : "preço a definir"}
            </strong>
          </div>

          <div className="modal-actions">
            {emEdicao ? (
              <button
                type="button"
                className="danger-button"
                onClick={() => setConfirmarCancelar(true)}
                disabled={aGuardar}
              >
                Cancelar marcação
              </button>
            ) : (
              <span />
            )}

            <div className="modal-actions-direita">
              <button type="button" className="ghost-button" onClick={onFechar}>
                Fechar
              </button>
              <button type="submit" className="primary-button" disabled={aGuardar}>
                {aGuardar
                  ? "A guardar..."
                  : linhas.length > 1
                    ? `Guardar ${linhas.length} marcações`
                    : "Guardar marcação"}
              </button>
            </div>
          </div>
        </form>

        {confirmarCancelar && agendamento ? (
          <ConfirmarModal
            titulo="Cancelar esta marcação?"
            textoConfirmar="Sim, cancelar"
            aProcessar={aGuardar}
            onConfirmar={cancelar}
            onVoltar={() => setConfirmarCancelar(false)}
          >
            <p>
              <strong>{agendamento.cliente}</strong>
              <br />
              {dataPorExtenso(agendamento.data)} às {agendamento.inicio}
            </p>
            <p>A marcação sai da agenda e não pode ser recuperada.</p>
          </ConfirmarModal>
        ) : null}
      </div>
    </div>
  );
}
