import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import * as api from "../lib/api";
import { mensagemDeFalha } from "../lib/guardado";
import {
  ausenciaQueBloqueia,
  encadearServicos,
  encontrarConflito,
  horarioDoDia,
  linhasDaVisita,
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
import CampoNumero from "./CampoNumero";

export type PreDefinicao = {
  data: string;
  inicio?: string;
  funcionarioId?: string;
};

/** Um serviço da visita. Várias linhas = vários serviços na mesma ida ao salão. */
type LinhaServico = {
  chave: string;
  /** A marcação que esta linha já é na base de dados (ao editar uma visita). */
  id?: string;
  servicoId: string;
  funcionarioId: string;
  duracaoMinutos: number;
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
  onGuardado: (agendamentos: Agendamento[], clienteNovo: Cliente | null, removidos: string[]) => void;
  onApagado: (ids: string[]) => void;
};

/** crypto.randomUUID só existe em https; no telemóvel em teste (http) faz-se à mão. */
const novoId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
        (Number(c) ^ (Math.floor(Math.random() * 16) >> (Number(c) / 4))).toString(16),
      );

/**
 * Ao abrir uma marcação, a visita inteira: todos os serviços do cliente marcados
 * juntos. Se as horas não encaixarem em cadeia, edita-se só a marcação aberta.
 */
const prepararEdicao = (agendamento: Agendamento, daVisita: Agendamento[]) => {
  const planeada = linhasDaVisita(daVisita.length > 0 ? daVisita : [agendamento]);
  const marcacoes = planeada ? planeada.linhas : [agendamento];

  return {
    soEsta: planeada === null,
    inicio: planeada ? planeada.inicio : agendamento.inicio,
    ids: marcacoes.map((marcacao) => marcacao.id),
    linhas: marcacoes.map(
      (marcacao): LinhaServico => ({
        chave: marcacao.id,
        id: marcacao.id,
        servicoId: marcacao.servicoId,
        funcionarioId: marcacao.funcionarioId,
        duracaoMinutos: marcacao.duracaoMinutos,
      }),
    ),
  };
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
  const funcionariosAtivos = funcionarios;
  // Um serviço desativado entretanto continua a aparecer nas visitas que já o têm.
  const servicosDaVisita = new Set(
    agendamento
      ? [
          agendamento.servicoId,
          ...agendamentosDaSemana
            .filter((item) => item.visitaId === agendamento.visitaId)
            .map((item) => item.servicoId),
        ]
      : [],
  );
  const servicosAtivos = servicos.filter((item) => item.ativo || servicosDaVisita.has(item.id));

  const [clienteId, setClienteId] = useState<string | null>(agendamento?.clienteId ?? null);
  const [nomeCliente, setNomeCliente] = useState(agendamento?.cliente ?? "");
  const [telefone, setTelefone] = useState(agendamento?.telefone ?? "");
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);

  // A visita já está na semana carregada, a não ser que se tenha vindo da pesquisa
  // ou da ficha do cliente para outro dia; aí lê-se da base de dados.
  const naSemana = agendamento
    ? agendamentosDaSemana.some((item) => item.id === agendamento.id)
    : false;
  // Só ao abrir: depois quem manda é o que se muda na janela.
  const [edicaoInicial] = useState(() =>
    agendamento
      ? prepararEdicao(
          agendamento,
          agendamentosDaSemana.filter((item) => item.visitaId === agendamento.visitaId),
        )
      : null,
  );
  const [aCarregarVisita, setACarregarVisita] = useState(Boolean(agendamento) && !naSemana);
  const [soEsta, setSoEsta] = useState(edicaoInicial?.soEsta ?? false);
  const [idsDaVisita, setIdsDaVisita] = useState<string[]>(edicaoInicial?.ids ?? []);

  const [data, setData] = useState(agendamento?.data ?? preDefinicao.data);
  // Numa visita, começa quando começa o primeiro serviço dela.
  const [inicio, setInicio] = useState(
    edicaoInicial?.inicio ??
      preDefinicao.inicio ??
      horarioDoDia(configuracoes, agendamento?.data ?? preDefinicao.data).inicio,
  );
  const [status, setStatus] = useState<StatusAgendamento>(agendamento?.status ?? "confirmado");
  const [observacoes, setObservacoes] = useState(agendamento?.observacoes ?? "");

  const [linhas, setLinhas] = useState<LinhaServico[]>(
    () =>
      edicaoInicial?.linhas ?? [
        {
          chave: "1",
          servicoId: servicosAtivos[0]?.id ?? "",
          funcionarioId: preDefinicao.funcionarioId ?? funcionariosAtivos[0]?.id ?? "",
          duracaoMinutos: servicosAtivos[0]?.duracaoMinutos ?? 60,
        },
      ],
  );

  const [retiradas, setRetiradas] = useState<LinhaServico[]>([]);
  const [tentouGuardar, setTentouGuardar] = useState(false);
  const [erro, setErro] = useState("");
  const [aGuardar, setAGuardar] = useState(false);
  const [confirmarCancelar, setConfirmarCancelar] = useState(false);
  const primeiroCampo = useRef<HTMLInputElement>(null);

  // Vindo de outro dia (pesquisa, ficha do cliente): ler a visita da base de dados.
  useEffect(() => {
    if (!agendamento || naSemana) return;
    let ativo = true;
    api
      .listarDaVisita(agendamento.visitaId)
      .then((daVisita) => {
        if (!ativo) return;
        const edicao = prepararEdicao(agendamento, daVisita);
        setSoEsta(edicao.soEsta);
        setIdsDaVisita(edicao.ids);
        setLinhas(edicao.linhas);
        setInicio(edicao.inicio);
      })
      .catch((causa) => {
        if (ativo) {
          setErro(mensagemDeFalha(causa, "Não foi possível carregar a visita."));
        }
      })
      .finally(() => {
        if (ativo) setACarregarVisita(false);
      });
    return () => {
      ativo = false;
    };
    // Só ao abrir a janela.
  }, []);

  // Numa marcação nova começa-se pelo nome; numa existente, o cursor não vai para lá
  // (senão abria logo a lista de sugestões de clientes por cima do formulário).
  useEffect(() => {
    if (!emEdicao) primeiroCampo.current?.focus();
  }, [emEdicao]);

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
        id: item.id ?? `nova-${indice}`,
        visitaId: "esta-visita",
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
        preco: null,
        servicoNome: "",
        inicioMs: combinarDataHora(data, item.inicio).getTime(),
        fimMs: combinarDataHora(data, item.fim).getTime(),
      })),
    [agenda, data, nomeCliente],
  );

  /** O resto da agenda, sem os serviços da visita que se está a editar. */
  const outrasMarcacoes = useMemo(() => {
    const daVisita = new Set(idsDaVisita);
    return agendamentosDaSemana.filter((item) => !daVisita.has(item.id));
  }, [agendamentosDaSemana, idsDaVisita]);

  /** Primeiro problema encontrado em qualquer um dos serviços. */
  const problema = useMemo(() => {
    for (const [indice, item] of agenda.entries()) {
      const candidato = {
        id: item.id,
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
      const conflito = encontrarConflito([...outrasMarcacoes, ...outrasLinhas], candidato);
      if (conflito) {
        return `${nome} às ${item.inicio}: ${quem} já tem ${conflito.cliente} das ${conflito.inicio} às ${conflito.fim}.`;
      }
    }

    return null;
  }, [agenda, ausencias, comoAgendamentos, data, funcionarios, outrasMarcacoes, servicos]);

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

  useEffect(() => {
    setTentouGuardar(false);
  }, [problema]);

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
      },
    ]);
    setErro("");
  };

  const removerLinha = (chave: string) => {
    const linha = linhas.find((item) => item.chave === chave);
    // Um serviço que já estava guardado fica à vista até se guardar (dá para desfazer).
    if (linha?.id) setRetiradas((anteriores) => [...anteriores, linha]);
    setLinhas((anteriores) => anteriores.filter((item) => item.chave !== chave));
  };

  // Voltam ao lugar que tinham na visita (senão as horas trocavam); os serviços
  // acrescentados agora ficam no fim.
  const desfazerRetiradas = () => {
    const lugar = (linha: LinhaServico) =>
      linha.id ? idsDaVisita.indexOf(linha.id) : idsDaVisita.length;
    setLinhas((anteriores) =>
      [...anteriores, ...retiradas].sort((a, b) => lugar(a) - lugar(b)),
    );
    setRetiradas([]);
  };

  const guardar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();

    for (const item of agenda) {
      const aviso = validarAgendamento(
        {
          id: item.id,
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

    // O aviso já está à vista por cima dos botões; em vez de repetir o mesmo texto
    // numa segunda linha, o aviso passa a vermelho.
    if (problema) {
      setTentouGuardar(true);
      return;
    }

    setAGuardar(true);
    setErro("");

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

      // Serviços que estavam na visita e foram tirados na janela.
      const removidos = idsDaVisita.filter((id) => !agenda.some((item) => item.id === id));

      const guardados = await api.guardarVisita({
        visitaId: agendamento?.visitaId ?? novoId(),
        apagar: removidos,
        marcacoes: agenda.map((item) => ({
          id: item.id,
          clienteId: clienteFinalId,
          funcionarioId: item.funcionarioId,
          servicoId: item.servicoId,
          data,
          inicio: item.inicio,
          duracaoMinutos: item.duracaoMinutos,
          status,
          telefone: telefone.trim(),
          observacoes: observacoes.trim(),
        })),
      });

      onGuardado(guardados, clienteNovo, removidos);
    } catch (causa) {
      // A base de dados guarda tudo ou nada: não fica meia visita para desfazer.
      setErro(causa instanceof Error ? causa.message : "Não foi possível guardar a marcação.");
      setAGuardar(false);
    }
  };

  /** Cancelar é tirar da agenda a visita inteira (todos os serviços dela). */
  const cancelar = async () => {
    if (!agendamento) return;
    setAGuardar(true);
    try {
      const ids = idsDaVisita.length > 0 ? idsDaVisita : [agendamento.id];
      await api.guardarVisita({ visitaId: agendamento.visitaId, marcacoes: [], apagar: ids });
      onApagado(ids);
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
          {emEdicao ? (
            <div>
              <p className="eyebrow">Editar marcação</p>
              <h2>{agendamento.cliente}</h2>
            </div>
          ) : (
            <h2 className="titulo-nova-marcacao">Nova marcação</h2>
          )}
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
                  onFocus={() => {
                    if (clienteId === null) setMostrarSugestoes(true);
                  }}
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
            {agenda.map((item) => (
              <div key={item.chave} className="linha-servico">

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
                    <CampoNumero
                      value={item.duracaoMinutos}
                      onChange={(minutos) => alterarLinha(item.chave, { duracaoMinutos: minutos })}
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
                      aria-label="Remover este serviço"
                      title="Remover este serviço"
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              </div>
            ))}

            {retiradas.length > 0 ? (
              <p className="aviso-retirados" role="status">
                {retiradas.length === 1 ? "Sai desta visita ao guardar: " : "Saem desta visita ao guardar: "}
                <strong>
                  {retiradas
                    .map((linha) => servicos.find((item) => item.id === linha.servicoId)?.nome ?? "serviço")
                    .join(", ")}
                </strong>
                <button type="button" className="botao-texto" onClick={desfazerRetiradas}>
                  Desfazer
                </button>
              </p>
            ) : null}

            {soEsta ? (
              <p className="dica">
                Os serviços desta visita têm horas soltas, por isso aqui muda-se só este. Para
                acrescentar outro, faz uma marcação nova.
              </p>
            ) : (
              <button type="button" className="ghost-button" onClick={acrescentarServico}>
                + Acrescentar serviço
              </button>
            )}
          </div>

          {/* Por omissão, confirmada; pendente serve para quem ainda vai confirmar. */}
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

          <label>
            Observações
            <textarea
              rows={2}
              value={observacoes}
              onChange={(evento) => setObservacoes(evento.target.value)}
              placeholder="Ex: alergia a amoníaco, prefere franja"
            />
          </label>

          {problema ? (
            <p className={`aviso-conflito ${tentouGuardar ? "impede" : ""}`} role="alert">
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
              <button
                type="submit"
                className="primary-button"
                disabled={aGuardar || aCarregarVisita}
              >
                {aGuardar
                  ? "A guardar..."
                  : aCarregarVisita
                    ? "A carregar..."
                    : emEdicao
                      ? "Guardar alterações"
                      : linhas.length > 1
                        ? `Guardar ${linhas.length} marcações`
                        : "Guardar marcação"}
              </button>
            </div>
          </div>
        </form>

        {confirmarCancelar && agendamento ? (
          <ConfirmarModal
            titulo={idsDaVisita.length > 1 ? "Cancelar esta visita?" : "Cancelar esta marcação?"}
            textoConfirmar="Sim, cancelar"
            textoAProcessar="A cancelar..."
            aProcessar={aGuardar}
            onConfirmar={cancelar}
            onVoltar={() => setConfirmarCancelar(false)}
          >
            <p>
              <strong>{agendamento.cliente}</strong>
              <br />
              {dataPorExtenso(agendamento.data)} às {agendamento.inicio}
            </p>
            <p>
              {idsDaVisita.length > 1
                ? `Os ${idsDaVisita.length} serviços desta visita saem da agenda e não podem ser recuperados. Para tirar só um, usa o × ao lado dele.`
                : "A marcação será removida da agenda e não poderá ser recuperada."}
            </p>
          </ConfirmarModal>
        ) : null}
      </div>
    </div>
  );
}
