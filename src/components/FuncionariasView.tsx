import { useState } from "react";
import * as api from "../lib/api";
import type { Funcionario } from "../lib/types";
import ConfirmarModal from "./ConfirmarModal";
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
  const [aApagar, setAApagar] = useState<Funcionario | null>(null);
  const [aProcessar, setAProcessar] = useState(false);

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

  const apagar = async () => {
    if (!aApagar) return;
    setAProcessar(true);
    try {
      await api.apagarFuncionario(aApagar);
      onFuncionariosAlterados(funcionarios.filter((item) => item.id !== aApagar.id));
      onAusenciasAlteradas();
      onAviso(`${aApagar.nome} saiu da equipa.`);
    } catch (causa) {
      onErro(causa instanceof Error ? causa.message : "Não foi possível apagar a funcionária.");
    } finally {
      setAProcessar(false);
      setAApagar(null);
    }
  };

  return (
    <>
      <div className="cartao">
        <div className="cartao-topo">
          <div>
            <h2>Funcionárias</h2>
            <p className="subtitulo">
              Cada uma tem uma coluna na agenda. As folgas e as férias marcam-se na ficha.
            </p>
          </div>
          <div className="acoes-registo">
            <button type="button" className="primary-button" onClick={() => setModal({ item: null })}>
              + Nova funcionária
            </button>
          </div>
        </div>

        {funcionarios.length === 0 ? (
          <div className="estado-vazio">
            Ainda não há funcionárias. Adiciona a equipa para a agenda ganhar colunas.
          </div>
        ) : (
          <ul className="lista-registos ampla">
            {funcionarios.map((funcionaria) => (
              <li key={funcionaria.id}>
                <div>
                  <strong>
                    <span className="ponto-cor" style={{ background: funcionaria.cor }} />
                    {funcionaria.nome}
                  </strong>
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
                    className="danger-button"
                    onClick={() => setAApagar(funcionaria)}
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
        <FuncionariaModal
          funcionaria={modal.item}
          onFechar={() => setModal(null)}
          onGuardado={aoGuardar}
          onAusenciasAlteradas={onAusenciasAlteradas}
        />
      ) : null}

      {aApagar ? (
        <ConfirmarModal
          titulo={`Apagar ${aApagar.nome}?`}
          textoConfirmar="Sim, apagar"
          textoAProcessar="A apagar..."
          aProcessar={aProcessar}
          onConfirmar={apagar}
          onVoltar={() => setAApagar(null)}
        >
          <p>
            Deixa de ter coluna na agenda e as folgas dela são apagadas. As marcações que já
            passaram continuam a contar nas estatísticas, sem o nome.
          </p>
          <p>Não pode ser recuperada.</p>
        </ConfirmarModal>
      ) : null}
    </>
  );
}
