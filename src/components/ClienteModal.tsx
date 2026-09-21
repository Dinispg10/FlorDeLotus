import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import * as api from "../lib/api";
import { normalizarTelefone } from "../lib/agenda";
import { dataCurta, formatarPreco } from "../lib/datas";
import {
  ROTULO_STATUS,
  type Agendamento,
  type Cliente,
  type Funcionario,
  type Servico,
} from "../lib/types";
import Modal from "./Modal";

type Props = {
  cliente: Cliente | null;
  clientes: Cliente[];
  servicos: Servico[];
  funcionarios: Funcionario[];
  onFechar: () => void;
  onGuardado: (cliente: Cliente, criado: boolean) => void;
  onAbrirMarcacao: (agendamento: Agendamento) => void;
};

export default function ClienteModal({
  cliente,
  clientes,
  servicos,
  funcionarios,
  onFechar,
  onGuardado,
  onAbrirMarcacao,
}: Props) {
  const [nome, setNome] = useState(cliente?.nome ?? "");
  const [telefone, setTelefone] = useState(cliente?.telefone ?? "");
  const [observacoes, setObservacoes] = useState(cliente?.observacoes ?? "");
  const [erro, setErro] = useState("");
  const [aGuardar, setAGuardar] = useState(false);

  const [historico, setHistorico] = useState<Agendamento[]>([]);
  const [aCarregar, setACarregar] = useState(cliente !== null);
  const [erroHistorico, setErroHistorico] = useState("");

  const carregarHistorico = useCallback(async () => {
    if (!cliente) return;
    try {
      setHistorico(await api.listarAgendamentosDoCliente(cliente.id));
    } catch (causa) {
      setErroHistorico(
        causa instanceof Error ? causa.message : "Não foi possível carregar o histórico.",
      );
    } finally {
      setACarregar(false);
    }
  }, [cliente]);

  useEffect(() => {
    carregarHistorico();
  }, [carregarHistorico]);

  const resumo = useMemo(() => {
    const precoDe = (servicoId: string) =>
      servicos.find((servico) => servico.id === servicoId)?.preco ?? 0;

    // O histórico vem do mais recente para o mais antigo.
    const agora = Date.now();
    const passadas = historico.filter((item) => item.fimMs <= agora);
    const futuras = historico.filter((item) => item.fimMs > agora);

    return {
      // Uma visita é um dia: três serviços na mesma ida ao salão contam uma vez.
      visitas: new Set(passadas.map((item) => item.data)).size,
      gasto: passadas.reduce((total, item) => total + precoDe(item.servicoId), 0),
      ultima: passadas[0] ?? null,
      proxima: futuras[futuras.length - 1] ?? null,
    };
  }, [historico, servicos]);

  const guardar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();

    if (!nome.trim()) {
      setErro("O nome do cliente é obrigatório.");
      return;
    }

    const digitos = normalizarTelefone(telefone);
    const duplicado = clientes.find(
      (item) =>
        item.id !== cliente?.id &&
        digitos.length >= 9 &&
        normalizarTelefone(item.telefone) === digitos,
    );

    if (duplicado) {
      setErro(`Já existe um cliente com este telefone: ${duplicado.nome}.`);
      return;
    }

    setAGuardar(true);
    setErro("");

    try {
      const dados = {
        nome: nome.trim(),
        telefone: telefone.trim(),
        observacoes: observacoes.trim(),
      };

      const guardado = cliente
        ? await api.atualizarCliente(cliente.id, dados)
        : await api.criarCliente(dados);

      onGuardado(guardado, cliente === null);
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : "Não foi possível guardar o cliente.");
      setAGuardar(false);
    }
  };

  return (
    <Modal
      titulo={cliente ? cliente.nome : "Novo cliente"}
      etiqueta={cliente ? "Ficha do cliente" : "Clientes"}
      largura={cliente ? "larga" : "normal"}
      onFechar={onFechar}
    >
      {cliente ? (
        <div className="resumo-cliente">
          <div>
            <span>Visitas</span>
            <strong>{resumo.visitas}</strong>
          </div>
          <div>
            <span>Total em serviços</span>
            <strong>{formatarPreco(resumo.gasto)}</strong>
          </div>
          <div>
            <span>Última visita</span>
            <strong>{resumo.ultima ? dataCurta(resumo.ultima.data) : "—"}</strong>
          </div>
          <div>
            <span>Próxima visita</span>
            <strong>{resumo.proxima ? dataCurta(resumo.proxima.data) : "—"}</strong>
          </div>
        </div>
      ) : null}

      <form onSubmit={guardar} className="booking-form">
        <div className="inline-fields">
          <label>
            Nome
            <input
              type="text"
              value={nome}
              onChange={(evento) => {
                setNome(evento.target.value);
                setErro("");
              }}
              placeholder="Ex: Ana Lopes"
              autoFocus={cliente === null}
            />
          </label>

          <label>
            Telefone
            <input
              type="tel"
              value={telefone}
              onChange={(evento) => {
                setTelefone(evento.target.value);
                setErro("");
              }}
              placeholder="+351 912 345 678"
            />
          </label>
        </div>

        <label>
          Observações
          <textarea
            rows={2}
            value={observacoes}
            onChange={(evento) => setObservacoes(evento.target.value)}
          />
        </label>

        {erro ? (
          <p className="login-error" role="alert">
            {erro}
          </p>
        ) : null}

        <div className="modal-actions-direita">
          <button type="button" className="ghost-button" onClick={onFechar}>
            Cancelar
          </button>
          <button type="submit" className="primary-button" disabled={aGuardar}>
            {aGuardar ? "A guardar..." : cliente ? "Guardar" : "Criar cliente"}
          </button>
        </div>
      </form>

      {cliente ? (
        <section className="seccao-folgas">
          <h3>Marcações ({historico.length})</h3>

          {erroHistorico ? (
            <p className="login-error">{erroHistorico}</p>
          ) : aCarregar ? (
            <p className="dica">A carregar...</p>
          ) : historico.length === 0 ? (
            <p className="dica">Este cliente ainda não tem marcações.</p>
          ) : (
            <ul className="historico">
              {historico.map((marcacao) => {
                const servico = servicos.find((item) => item.id === marcacao.servicoId);
                const funcionaria = funcionarios.find(
                  (item) => item.id === marcacao.funcionarioId,
                );

                return (
                  <li key={marcacao.id}>
                    <button
                      type="button"
                      onClick={() => onAbrirMarcacao(marcacao)}
                      title="Abrir esta marcação na agenda"
                    >
                      <span className="historico-data">
                        {dataCurta(marcacao.data)}
                        <em>
                          {marcacao.inicio}-{marcacao.fim}
                        </em>
                      </span>

                      <span className="historico-servico">
                        <strong>{servico?.nome ?? "Serviço removido"}</strong>
                        {funcionaria ? (
                          <em>
                            <span
                              className="ponto-cor"
                              style={{ background: funcionaria.cor }}
                            />
                            {funcionaria.nome}
                          </em>
                        ) : null}
                      </span>

                      <span className={`estado-etiqueta ${marcacao.status}`}>
                        {ROTULO_STATUS[marcacao.status]}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}
    </Modal>
  );
}
