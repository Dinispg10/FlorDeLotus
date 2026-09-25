import { useState } from "react";
import * as api from "../lib/api";
import EstadoVazio from "./EstadoVazio";
import { formatarPreco } from "../lib/datas";
import type { Servico } from "../lib/types";
import ServicoModal from "./ServicoModal";

type Props = {
  servicos: Servico[];
  onServicosAlterados: (servicos: Servico[]) => void;
  onErro: (mensagem: string) => void;
  onAviso: (mensagem: string) => void;
};

export default function ServicosView({
  servicos,
  onServicosAlterados,
  onErro,
  onAviso,
}: Props) {
  const [modal, setModal] = useState<{ item: Servico | null } | null>(null);
  const [mostrarInativos, setMostrarInativos] = useState(false);

  const visiveis = servicos.filter((item) => item.ativo || mostrarInativos);

  const aoGuardar = (servico: Servico, criado: boolean) => {
    onServicosAlterados(
      criado
        ? [...servicos, servico]
        : servicos.map((item) => (item.id === servico.id ? servico : item)),
    );
    setModal(null);
    onAviso(criado ? "Serviço criado." : "Serviço atualizado.");
  };

  const alternarAtivo = async (servico: Servico) => {
    try {
      const atualizado = await api.atualizarServico(servico.id, { ativo: !servico.ativo });
      onServicosAlterados(servicos.map((item) => (item.id === atualizado.id ? atualizado : item)));
      onAviso(
        atualizado.ativo
          ? `${atualizado.nome} reativado: volta a aparecer nas marcações.`
          : `${atualizado.nome} desativado: deixa de aparecer nas marcações novas.`,
      );
    } catch (causa) {
      onErro(causa instanceof Error ? causa.message : "Não foi possível alterar o serviço.");
    }
  };

  return (
    <>
      <div className="cartao">
        <div className="cartao-topo">
          <div>
            <h2>Serviços</h2>
            <p className="subtitulo">
              A duração e o preço daqui preenchem sozinhos as marcações, podendo ser alterados dependendo da marcação.
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
            <button type="button" className="primary-button" onClick={() => setModal({ item: null })}>
              + Novo serviço
            </button>
          </div>
        </div>

        {visiveis.length === 0 ? (
          <EstadoVazio
            titulo="Ainda não há serviços"
            ajuda="A duração e o preço de cada serviço preenchem sozinhos as marcações."
            acao={
              <button type="button" className="primary-button" onClick={() => setModal({ item: null })}>
                + Novo serviço
              </button>
            }
          />
        ) : (
          <ul className="lista-registos ampla">
            {visiveis.map((servico) => (
              <li key={servico.id} className={servico.ativo ? "" : "inativo"}>
                <div>
                  <strong>{servico.nome}</strong>
                  <span>
                    {servico.duracaoMinutos} min · {formatarPreco(servico.preco)}
                  </span>
                </div>
                <div className="acoes-registo">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => setModal({ item: servico })}
                  >
                    Abrir
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => alternarAtivo(servico)}
                  >
                    {servico.ativo ? "Desativar" : "Reativar"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {modal ? (
        <ServicoModal
          servico={modal.item}
          onFechar={() => setModal(null)}
          onGuardado={aoGuardar}
        />
      ) : null}
    </>
  );
}
