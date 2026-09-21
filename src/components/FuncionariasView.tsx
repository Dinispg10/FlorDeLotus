import { useState } from "react";
import * as api from "../lib/api";
import type { Funcionario } from "../lib/types";
import FuncionariaModal from "./FuncionariaModal";

type Props = {
  funcionarios: Funcionario[];
  onFuncionariosAlterados: (funcionarios: Funcionario[]) => void;
  onAusenciasAlteradas: () => void;
  onErro: (mensagem: string) => void;
  onAviso: (mensagem: string) => void;
};

export default function FuncionariasView({
  funcionarios,
  onFuncionariosAlterados,
  onAusenciasAlteradas,
  onErro,
  onAviso,
}: Props) {
  const [modal, setModal] = useState<{ item: Funcionario | null } | null>(null);
  const [mostrarInativas, setMostrarInativas] = useState(false);

  const visiveis = funcionarios.filter((item) => item.ativo || mostrarInativas);

  const aoGuardar = (funcionaria: Funcionario, criada: boolean) => {
    onFuncionariosAlterados(
      criada
        ? [...funcionarios, funcionaria]
        : funcionarios.map((item) => (item.id === funcionaria.id ? funcionaria : item)),
    );
    // Ao criar, a ficha fica aberta para se poderem marcar logo as folgas.
    setModal(criada ? { item: funcionaria } : null);
    onAviso(criada ? "Funcionária criada." : "Funcionária atualizada.");
  };

  const alternarAtivo = async (funcionaria: Funcionario) => {
    try {
      const atualizada = await api.atualizarFuncionario(funcionaria.id, {
        ativo: !funcionaria.ativo,
      });
      onFuncionariosAlterados(
        funcionarios.map((item) => (item.id === atualizada.id ? atualizada : item)),
      );
    } catch (causa) {
      onErro(causa instanceof Error ? causa.message : "Não foi possível alterar a funcionária.");
    }
  };

  return (
    <>
      <div className="cartao">
        <div className="cartao-topo">
          <div>
            <h2>Funcionárias ({visiveis.length})</h2>
            <p className="subtitulo">
              Cada uma tem uma coluna na agenda. As folgas e as férias marcam-se na ficha.
            </p>
          </div>
          <div className="acoes-registo">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={mostrarInativas}
                onChange={(evento) => setMostrarInativas(evento.target.checked)}
              />
              Mostrar inativas
            </label>
            <button type="button" className="primary-button" onClick={() => setModal({ item: null })}>
              + Nova funcionária
            </button>
          </div>
        </div>

        {visiveis.length === 0 ? (
          <div className="estado-vazio">
            Ainda não há funcionárias. Adiciona a equipa para a agenda ganhar colunas.
          </div>
        ) : (
          <ul className="lista-registos ampla">
            {visiveis.map((funcionaria) => (
              <li key={funcionaria.id} className={funcionaria.ativo ? "" : "inativo"}>
                <div>
                  <strong>
                    <span className="ponto-cor" style={{ background: funcionaria.cor }} />
                    {funcionaria.nome}
                  </strong>
                  <span>{funcionaria.ativo ? "Ativa" : "Inativa"}</span>
                </div>
                <div className="acoes-registo">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => setModal({ item: funcionaria })}
                  >
                    Abrir ficha
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => alternarAtivo(funcionaria)}
                  >
                    {funcionaria.ativo ? "Desativar" : "Reativar"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {modal ? (
        <FuncionariaModal
          funcionaria={modal.item}
          onFechar={() => setModal(null)}
          onGuardado={aoGuardar}
          onAusenciasAlteradas={onAusenciasAlteradas}
        />
      ) : null}
    </>
  );
}
