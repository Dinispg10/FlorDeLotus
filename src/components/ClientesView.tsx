import { useMemo, useState } from "react";
import * as api from "../lib/api";
import { normalizarTelefone, normalizarTexto } from "../lib/agenda";
import type { Agendamento, Cliente, Funcionario, Servico } from "../lib/types";
import ClienteModal from "./ClienteModal";

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
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [modal, setModal] = useState<EstadoModal | null>(null);

  const visiveis = useMemo(() => {
    const texto = normalizarTexto(procura);
    const digitos = normalizarTelefone(procura);

    return clientes.filter((cliente) => {
      if (!cliente.ativo && !mostrarInativos) return false;
      if (!texto) return true;
      const porNome = normalizarTexto(cliente.nome).includes(texto);
      const porTelefone =
        digitos.length >= 3 && normalizarTelefone(cliente.telefone).includes(digitos);
      return porNome || porTelefone;
    });
  }, [clientes, mostrarInativos, procura]);

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

  const alternarAtivo = async (cliente: Cliente) => {
    try {
      const atualizado = await api.atualizarCliente(cliente.id, { ativo: !cliente.ativo });
      onClientesAlterados(clientes.map((item) => (item.id === atualizado.id ? atualizado : item)));
    } catch (causa) {
      onErro(causa instanceof Error ? causa.message : "Não foi possível alterar o cliente.");
    }
  };

  return (
    <section className="pagina-lista">
      <div className="cartao">
        <div className="cartao-topo">
          <div>
            <h2>Clientes ({visiveis.length})</h2>
            <p className="subtitulo">
              As fichas também são criadas sozinhas ao marcar, se o nome ainda não existir.
            </p>
          </div>
          <div className="acoes-registo">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={mostrarInativos}
                onChange={(evento) => setMostrarInativos(evento.target.checked)}
              />
              Mostrar inativos
            </label>
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
              ? "Ainda não há clientes. Também são criados sozinhos ao marcar."
              : "Nenhum cliente encontrado."}
          </div>
        ) : (
          <ul className="lista-registos ampla">
            {visiveis.map((cliente) => (
              <li key={cliente.id} className={cliente.ativo ? "" : "inativo"}>
                <div>
                  <strong>{cliente.nome}</strong>
                  <span>{cliente.telefone || "sem telefone"}</span>
                  {cliente.observacoes ? <em>{cliente.observacoes}</em> : null}
                  {marcacoesPorCliente.get(cliente.id) ? (
                    <span className="contagem">
                      {marcacoesPorCliente.get(cliente.id)} esta semana
                    </span>
                  ) : null}
                </div>
                <div className="acoes-registo">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => setModal({ cliente })}
                  >
                    Abrir
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => alternarAtivo(cliente)}
                  >
                    {cliente.ativo ? "Desativar" : "Reativar"}
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
    </section>
  );
}
