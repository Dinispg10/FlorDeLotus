import { useCallback, useEffect, useState, type FormEvent } from "react";
import * as api from "../lib/api";
import EcraEspera from "./EcraEspera";
import { dataCurta, hoje } from "../lib/datas";
import {
  ROTULO_AUSENCIA,
  type Ausencia,
  type Funcionario,
  type TipoAusencia,
} from "../lib/types";
import Modal from "./Modal";

export const CORES = ["#7C3AED", "#A855F7", "#EC4899", "#059669", "#10B981", "#14B8A6", "#F59E0B", "#3B82F6"];

type Props = {
  funcionaria: Funcionario | null;
  onFechar: () => void;
  onGuardado: (funcionaria: Funcionario, criada: boolean) => void;
  onAusenciasAlteradas: () => void;
};

const periodoPorExtenso = (ausencia: Ausencia) => {
  const dias =
    ausencia.dataInicio === ausencia.dataFim
      ? dataCurta(ausencia.dataInicio)
      : `${dataCurta(ausencia.dataInicio)} a ${dataCurta(ausencia.dataFim)}`;

  return ausencia.horaInicio && ausencia.horaFim
    ? `${dias} · ${ausencia.horaInicio}-${ausencia.horaFim}`
    : `${dias} · dia inteiro`;
};

export default function FuncionariaModal({
  funcionaria,
  onFechar,
  onGuardado,
  onAusenciasAlteradas,
}: Props) {
  const [nome, setNome] = useState(funcionaria?.nome ?? "");
  const [cor, setCor] = useState(funcionaria?.cor ?? CORES[0]);
  const [erro, setErro] = useState("");
  const [aGuardar, setAGuardar] = useState(false);

  const [ausencias, setAusencias] = useState<Ausencia[]>([]);
  const [aCarregarAusencias, setACarregarAusencias] = useState(funcionaria !== null);
  const [tipo, setTipo] = useState<TipoAusencia>("folga");
  const [dataInicio, setDataInicio] = useState(hoje());
  const [dataFim, setDataFim] = useState(hoje());
  const [diaInteiro, setDiaInteiro] = useState(true);
  const [horaInicio, setHoraInicio] = useState("09:00");
  const [horaFim, setHoraFim] = useState("13:00");
  const [erroAusencia, setErroAusencia] = useState("");
  const [avisoMarcacoes, setAvisoMarcacoes] = useState("");
  const [aGuardarAusencia, setAGuardarAusencia] = useState(false);

  const carregarAusencias = useCallback(async () => {
    if (!funcionaria) return;
    try {
      setAusencias(await api.listarAusenciasDaFuncionaria(funcionaria.id));
    } catch (causa) {
      setErroAusencia(
        causa instanceof Error ? causa.message : "Não foi possível carregar as folgas.",
      );
    } finally {
      setACarregarAusencias(false);
    }
  }, [funcionaria]);

  useEffect(() => {
    carregarAusencias();
  }, [carregarAusencias]);

  const guardarFuncionaria = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();

    if (!nome.trim()) {
      setErro("O nome é obrigatório.");
      return;
    }

    setAGuardar(true);
    setErro("");

    try {
      const guardada = funcionaria
        ? await api.atualizarFuncionario(funcionaria.id, { nome: nome.trim(), cor })
        : await api.criarFuncionario({ nome: nome.trim(), cor });

      onGuardado(guardada, funcionaria === null);
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : "Não foi possível guardar a funcionária.");
      setAGuardar(false);
    }
  };

  const adicionarAusencia = async () => {
    if (!funcionaria) return;

    if (dataFim < dataInicio) {
      setErroAusencia("A data de fim não pode ser anterior à de início.");
      return;
    }
    if (!diaInteiro && dataInicio !== dataFim) {
      setErroAusencia("Uma ausência de algumas horas tem de ser num só dia.");
      return;
    }
    if (!diaInteiro && horaFim <= horaInicio) {
      setErroAusencia("A hora de fim tem de ser depois da de início.");
      return;
    }

    setAGuardarAusencia(true);
    setErroAusencia("");

    try {
      // Avisar se já houver marcações no período — a folga não as apaga.
      if (!avisoMarcacoes) {
        const marcacoes = await api.listarAgendamentos(dataInicio, dataFim);
        const afetadas = marcacoes.filter((item) => item.funcionarioId === funcionaria.id);

        if (afetadas.length > 0) {
          setAvisoMarcacoes(
            `${funcionaria.nome} tem ${afetadas.length} ${
              afetadas.length === 1 ? "marcação" : "marcações"
            } nesse período. A folga não as cancela: carrega outra vez para a criar mesmo assim e depois reagenda essas marcações.`,
          );
          setAGuardarAusencia(false);
          return;
        }
      }

      await api.criarAusencia({
        funcionarioId: funcionaria.id,
        tipo,
        dataInicio,
        dataFim,
        horaInicio: diaInteiro ? null : horaInicio,
        horaFim: diaInteiro ? null : horaFim,
        observacoes: "",
      });

      setAvisoMarcacoes("");
      await carregarAusencias();
      onAusenciasAlteradas();
    } catch (causa) {
      setErroAusencia(
        causa instanceof Error ? causa.message : "Não foi possível guardar a folga.",
      );
    } finally {
      setAGuardarAusencia(false);
    }
  };

  const apagarAusencia = async (id: string) => {
    try {
      await api.apagarAusencia(id);
      setAusencias((anteriores) => anteriores.filter((item) => item.id !== id));
      onAusenciasAlteradas();
    } catch (causa) {
      setErroAusencia(
        causa instanceof Error ? causa.message : "Não foi possível apagar a folga.",
      );
    }
  };

  const futuras = ausencias.filter((item) => item.dataFim >= hoje());
  const passadas = ausencias.length - futuras.length;

  return (
    <Modal
      titulo={funcionaria ? funcionaria.nome : "Nova funcionária"}
      etiqueta={funcionaria ? "Ficha da funcionária" : "Nova funcionária"}
      largura="larga"
      onFechar={onFechar}
    >
      <form onSubmit={guardarFuncionaria} className="booking-form">
        <label>
          Nome
          <input
            type="text"
            value={nome}
            onChange={(evento) => {
              setNome(evento.target.value);
              setErro("");
            }}
            placeholder="Ex: Maria"
            autoFocus={funcionaria === null}
          />
        </label>

        <div className="escolha-cor">
          <span>Cor na agenda</span>
          <div>
            {CORES.map((opcao) => (
              <button
                key={opcao}
                type="button"
                className={`amostra-cor ${cor === opcao ? "ativa" : ""}`}
                style={{ background: opcao }}
                onClick={() => setCor(opcao)}
                aria-label={`Escolher cor ${opcao}`}
              />
            ))}
          </div>
        </div>

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
            {aGuardar ? "A guardar..." : funcionaria ? "Guardar" : "Criar funcionária"}
          </button>
        </div>
      </form>

      <section className="seccao-folgas">
        <h3>Folgas e férias</h3>

        {!funcionaria ? (
          <p className="dica">Cria a funcionária primeiro para lhe marcares folgas.</p>
        ) : (
          <>
            {aCarregarAusencias ? (
              <EcraEspera pequeno />
            ) : futuras.length === 0 ? (
              <p className="dica">
                Sem folgas marcadas de hoje em diante
                {passadas > 0 ? ` (${passadas} já passaram)` : ""}.
              </p>
            ) : (
              <ul className="lista-registos">
                {futuras.map((ausencia) => (
                  <li key={ausencia.id}>
                    <div>
                      <strong>
                        <span className={`etiqueta-ausencia ${ausencia.tipo}`}>
                          {ROTULO_AUSENCIA[ausencia.tipo]}
                        </span>
                      </strong>
                      <span>{periodoPorExtenso(ausencia)}</span>
                    </div>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => apagarAusencia(ausencia.id)}
                    >
                      Apagar
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="booking-form formulario-compacto">
              <div className="inline-fields">
                <label>
                  Tipo
                  <select
                    value={tipo}
                    onChange={(evento) => setTipo(evento.target.value as TipoAusencia)}
                  >
                    <option value="folga">Folga</option>
                    <option value="ferias">Férias</option>
                  </select>
                </label>

                <label className="checkbox-campo">
                  <span>Duração</span>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={diaInteiro}
                      onChange={(evento) => {
                        setDiaInteiro(evento.target.checked);
                        setErroAusencia("");
                      }}
                    />
                    Dia(s) inteiro(s)
                  </label>
                </label>
              </div>

              <div className="inline-fields">
                <label>
                  De
                  <input
                    type="date"
                    value={dataInicio}
                    onChange={(evento) => {
                      setDataInicio(evento.target.value);
                      if (evento.target.value > dataFim) setDataFim(evento.target.value);
                      setErroAusencia("");
                      setAvisoMarcacoes("");
                    }}
                  />
                </label>
                <label>
                  Até
                  <input
                    type="date"
                    value={dataFim}
                    min={dataInicio}
                    onChange={(evento) => {
                      setDataFim(evento.target.value);
                      setErroAusencia("");
                      setAvisoMarcacoes("");
                    }}
                  />
                </label>
              </div>

              {!diaInteiro ? (
                <div className="inline-fields">
                  <label>
                    Das
                    <input
                      type="time"
                      step={300}
                      value={horaInicio}
                      onChange={(evento) => setHoraInicio(evento.target.value)}
                    />
                  </label>
                  <label>
                    Às
                    <input
                      type="time"
                      step={300}
                      value={horaFim}
                      onChange={(evento) => setHoraFim(evento.target.value)}
                    />
                  </label>
                </div>
              ) : null}

              {avisoMarcacoes ? (
                <p className="aviso-conflito" role="alert">
                  ⚠ {avisoMarcacoes}
                </p>
              ) : null}

              {erroAusencia ? (
                <p className="login-error" role="alert">
                  {erroAusencia}
                </p>
              ) : null}

              <div className="modal-actions-direita">
                <button
                  type="button"
                  className={avisoMarcacoes ? "danger-button" : "primary-button"}
                  onClick={adicionarAusencia}
                  disabled={aGuardarAusencia}
                >
                  {aGuardarAusencia
                    ? "A guardar..."
                    : avisoMarcacoes
                      ? "Criar mesmo assim"
                      : "Marcar ausência"}
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* No fim da janela: depois das folgas/histórico, para não ser preciso voltar ao topo. */}
      <div className="rodape-modal">
        <button type="button" className="ghost-button" onClick={onFechar}>
          Fechar
        </button>
      </div>
    </Modal>
  );
}
