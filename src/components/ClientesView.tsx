import { useMemo, useState } from "react";
import * as api from "../lib/api";
import { normalizarTelefone, normalizarTexto } from "../lib/agenda";
import type { Agendamento, Cliente, Funcionario, Servico } from "../lib/types";
import ClienteModal from "./ClienteModal";
import ConfirmarModal from "./ConfirmarModal";

type Props = {
  clientes: Cliente[];
  agendamentos: Agendamento[];
  servicos: Servico[];
  funcionarios: Funcionario[];
  onClientesAlterados: (clientes: Cliente[]) => void;
  onAbrirMarcacao: (agendamento: Agendamento) => void;
  onErro: (mensagem: string) => void;
  onAviso: (mensagem: string) => void;
};

type EstadoModal = { cliente: Cliente | null };

export default function ClientesView({
  clientes,
  agendamentos,
  servicos,
  funcionarios,
  onClientesAlterados,
  onAbrirMarcacao,
  onErro,
  onAviso,
}: Props) {
  const [procura, setProcura] = useState("");
  const [modal, setModal] = useState<EstadoModal | null>(null);
  const [aApagar, setAApagar] = useState<Cliente | null>(null);
  const [aProcessar, setAProcessar] = useState(false);

  const visiveis = useMemo(() => {
    const texto = normalizarTexto(procura);
    const digitos = normalizarTelefone(procura);
    if (!texto) return clientes;

    return clientes.filter((cliente) => {
      const porNome = normalizarTexto(cliente.nome).includes(texto);
      const porTelefone =
        digitos.length >= 3 && normalizarTelefone(cliente.telefone).includes(digitos);
      return porNome || porTelefone;
    });
  }, [clientes, procura]);

  const marcacoesPorCliente = useMemo(() => {
    const contagem = new Map<string, number>();
    agendamentos.forEach((item) => {
      if (!item.clienteId) return;
      contagem.set(item.clienteId, (contagem.get(item.clienteId) ?? 0) + 1);
    });
    return contagem;
  }, [agendamentos]);

  const aoGuardar = (cliente: Cliente, criado: boolean) => {
    const lista = criado
      ? [...clientes, cliente]
      : clientes.map((item) => (item.id === cliente.id ? cliente : item));

    onClientesAlterados(lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-PT")));
    setModal(null);
    onAviso(criado ? "Cliente criado." : "Ficha do cliente atualizada.");
  };

  const apagar = async () => {
    if (!aApagar) return;
    setAProcessar(true);
    try {
      await api.apagarCliente(aApagar);
      onClientesAlterados(clientes.filter((item) => item.id !== aApagar.id));
      onAviso(`Ficha de ${aApagar.nome} apagada.`);
    } catch (causa) {
      onErro(causa instanceof Error ? causa.message : "Não foi possível apagar o cliente.");
    } finally {
      setAProcessar(false);
      setAApagar(null);
    }
  };

  return (
    <section className="pagina-lista">
      <div className="cartao">
        <div className="cartao-topo">
          <div>
            <h2>Clientes ({visiveis.length})</h2>
            <p className="subtitulo">
              As fichas também são criadas automaticamente ao marcar, quando o nome ainda não existe.
            </p>
          </div>
          <div className="acoes-registo">
            <button
              type="button"
              className="primary-button"
              onClick={() => setModal({ cliente: null })}
            >
              + Novo cliente
            </button>
          </div>
        </div>

        <input
          type="search"
          className="campo-procura"
          value={procura}
          onChange={(evento) => setProcura(evento.target.value)}
          placeholder="Procurar por nome ou telefone"
        />

        {visiveis.length === 0 ? (
          <div className="estado-vazio">
            {clientes.length === 0
              ? "Ainda não há clientes. As fichas também são criadas automaticamente ao fazer uma marcação."
              : "Nenhum cliente encontrado."}
          </div>
        ) : (
          <ul className="lista-registos ampla">
            {visiveis.map((cliente) => (
              <li key={cliente.id}>
                <div>
                  <strong>{cliente.nome}</strong>
                  <span>{cliente.telefone || "sem telefone"}</span>
                  {cliente.observacoes ? <em>{cliente.observacoes}</em> : null}
                  {marcacoesPorCliente.get(cliente.id) ? (
                    <span className="contagem">
                      {marcacoesPorCliente.get(cliente.id)}{" "}
                      {marcacoesPorCliente.get(cliente.id) === 1 ? "marcação" : "marcações"} esta
                      semana
                    </span>
                  ) : null}
                </div>
                <div className="acoes-registo">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => setModal({ cliente })}
                  >
                    Abrir ficha
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => setAApagar(cliente)}
                  >
                    Apagar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {modal ? (
        <ClienteModal
          cliente={modal.cliente}
          clientes={clientes}
          servicos={servicos}
          funcionarios={funcionarios}
          onFechar={() => setModal(null)}
          onGuardado={aoGuardar}
          onAbrirMarcacao={(agendamento) => {
            setModal(null);
            onAbrirMarcacao(agendamento);
          }}
        />
      ) : null}

      {aApagar ? (
        <ConfirmarModal
          titulo="Apagar esta ficha?"
          textoConfirmar="Sim, apagar"
          textoAProcessar="A apagar..."
          aProcessar={aProcessar}
          onConfirmar={apagar}
          onVoltar={() => setAApagar(null)}
        >
          <p>
            <strong>{aApagar.nome}</strong>
            {aApagar.telefone ? (
              <>
                <br />
                {aApagar.telefone}
              </>
            ) : null}
          </p>
          <p>
            As marcações que já passaram continuam a contar nas estatísticas, sem o nome. A
            ficha não pode ser recuperada.
          </p>
        </ConfirmarModal>
      ) : null}
    </section>
  );
}
