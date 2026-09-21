import { useState } from "react";
import * as api from "../lib/api";
import { minutosDesdeMeiaNoite } from "../lib/datas";
import {
  DIAS_DA_SEMANA,
  type Configuracoes,
  type DiaDaSemana,
  type HorarioDia,
  type HorarioSemanal,
} from "../lib/types";

type Props = {
  configuracoes: Configuracoes;
  onGuardado: () => void;
  onErro: (mensagem: string) => void;
  onAviso: (mensagem: string) => void;
};

export default function HorarioView({ configuracoes, onGuardado, onErro, onAviso }: Props) {
  const [horario, setHorario] = useState<HorarioSemanal>(() => ({
    ...configuracoes.horarioSemanal,
  }));
  const [aGuardar, setAGuardar] = useState(false);

  const alterar = (dia: DiaDaSemana, mudanca: Partial<HorarioDia>) =>
    setHorario((anterior) => ({ ...anterior, [dia]: { ...anterior[dia], ...mudanca } }));

  /** Copia o horário de segunda para os outros dias que estão abertos. */
  const copiarDeSegunda = () => {
    const modelo = horario[1];
    setHorario((anterior) => {
      const novo = { ...anterior };
      DIAS_DA_SEMANA.forEach(({ dia }) => {
        if (dia === 1 || !novo[dia].aberto) return;
        novo[dia] = { ...novo[dia], inicio: modelo.inicio, fim: modelo.fim };
      });
      return novo;
    });
  };

  const guardar = async () => {
    const invalido = DIAS_DA_SEMANA.find(
      ({ dia }) =>
        horario[dia].aberto &&
        minutosDesdeMeiaNoite(horario[dia].fim) <= minutosDesdeMeiaNoite(horario[dia].inicio),
    );

    if (invalido) {
      onErro(`${invalido.nome}: a hora de fecho tem de ser depois da de abertura.`);
      return;
    }

    setAGuardar(true);
    try {
      await api.guardarHorarioSemanal(horario);
      onGuardado();
      onAviso("Horário guardado.");
    } catch (causa) {
      onErro(causa instanceof Error ? causa.message : "Não foi possível guardar o horário.");
    } finally {
      setAGuardar(false);
    }
  };

  return (
    <div className="cartao">
        <div className="cartao-topo">
          <div>
            <h2>Horário</h2>
          </div>
          <div className="acoes-registo">
            <button type="button" className="ghost-button" onClick={copiarDeSegunda}>
              Aplicar o horário de segunda aos outros dias
            </button>
            <button type="button" className="primary-button" onClick={guardar} disabled={aGuardar}>
              {aGuardar ? "A guardar..." : "Guardar horário"}
            </button>
          </div>
        </div>

        <ul className="lista-registos ampla">
          {DIAS_DA_SEMANA.map(({ dia, nome }) => (
            <li key={dia} className={horario[dia].aberto ? "" : "inativo"}>
              <div className="linha-horario">
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={horario[dia].aberto}
                    onChange={(evento) => alterar(dia, { aberto: evento.target.checked })}
                  />
                  <strong>{nome}</strong>
                </label>

                {horario[dia].aberto ? (
                  <div className="horas-do-dia">
                    <input
                      type="time"
                      step={900}
                      value={horario[dia].inicio}
                      onChange={(evento) => alterar(dia, { inicio: evento.target.value })}
                      aria-label={`Hora de abertura de ${nome}`}
                    />
                    <span>às</span>
                    <input
                      type="time"
                      step={900}
                      value={horario[dia].fim}
                      onChange={(evento) => alterar(dia, { fim: evento.target.value })}
                      aria-label={`Hora de fecho de ${nome}`}
                    />
                  </div>
                ) : (
                  <span className="dia-fechado">Fechado</span>
                )}
              </div>
            </li>
          ))}
        </ul>

        <p className="dica">
          As folgas e as férias de cada funcionária marcam-se na página Funcionárias — este
          horário é o do salão inteiro.
        </p>
    </div>
  );
}
