import { useState, type FormEvent } from "react";
import * as api from "../lib/api";
import type { Servico } from "../lib/types";
import CampoNumero from "./CampoNumero";
import Modal from "./Modal";

type Props = {
  servico: Servico | null;
  onFechar: () => void;
  onGuardado: (servico: Servico, criado: boolean) => void;
};

export default function ServicoModal({ servico, onFechar, onGuardado }: Props) {
  const [nome, setNome] = useState(servico?.nome ?? "");
  const [duracaoMinutos, setDuracaoMinutos] = useState(servico?.duracaoMinutos ?? 60);
  const [preco, setPreco] = useState(servico?.preco ?? 0);
  const [erro, setErro] = useState("");
  const [aGuardar, setAGuardar] = useState(false);

  const guardar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();

    if (!nome.trim()) {
      setErro("O nome do serviço é obrigatório.");
      return;
    }
    if (!Number.isFinite(duracaoMinutos) || duracaoMinutos < 5) {
      setErro("A duração tem de ser de pelo menos 5 minutos.");
      return;
    }
    if (!Number.isFinite(preco) || preco < 0) {
      setErro("O preço não pode ser negativo.");
      return;
    }

    setAGuardar(true);
    setErro("");

    try {
      const dados = { nome: nome.trim(), duracaoMinutos, preco };
      const guardado = servico
        ? await api.atualizarServico(servico.id, dados)
        : await api.criarServico({ ...dados, ativo: true });

      onGuardado(guardado, servico === null);
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : "Não foi possível guardar o serviço.");
      setAGuardar(false);
    }
  };

  return (
    <Modal
      titulo={servico ? servico.nome : "Novo serviço"}
      etiqueta="Serviços"
      onFechar={onFechar}
    >
      <form onSubmit={guardar} className="booking-form">
        <label>
          Nome
          <input
            type="text"
            value={nome}
            onChange={(evento) => {
              setNome(evento.target.value);
              setErro("");
            }}
            placeholder="Ex: Coloração"
            autoFocus={servico === null}
          />
        </label>

        <div className="inline-fields">
          <label>
            Duração (min)
            <CampoNumero value={duracaoMinutos} onChange={setDuracaoMinutos} />
          </label>

          <label>
            Preço (€)
            <CampoNumero value={preco} onChange={setPreco} decimal />
          </label>
        </div>

        <p className="dica">
          A duração preenche-se sozinha ao escolher este serviço numa marcação, mas pode ser
          alterada caso a caso.
        </p>

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
            {aGuardar ? "A guardar..." : servico ? "Guardar" : "Criar serviço"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
