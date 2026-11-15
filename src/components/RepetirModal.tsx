import { useEffect, useMemo, useState } from "react";
import * as api from "../lib/api";
import { comSegundaTentativa, mensagemDeFalha } from "../lib/guardado";
import { datasDeRepeticao, problemaNoDia } from "../lib/agenda";
import { abreviaturaDiaSemana, dataCompacta, dataPorExtenso } from "../lib/datas";
import { novoId } from "../lib/ids";
import EcraEspera from "./EcraEspera";
import {
  type Agendamento,
  type Ausencia,
  type Configuracoes,
  type Funcionario,
  type Servico,
} from "../lib/types";

/** Um serviço da visita, já com as horas calculadas. */
export type ServicoDaVisita = {
  servicoId: string;
  funcionarioId: string;
  duracaoMinutos: number;
  inicio: string;
  fim: string;
};

export type VisitaARepetir = {
  clienteId: string;
  clienteNome: string;
  telefone: string;
  observacoes: string;
  data: string;
  inicio: string;
  servicos: ServicoDaVisita[];
};

type Props = {
  visita: VisitaARepetir;
  funcionarios: Funcionario[];
  servicos: Servico[];
  configuracoes: Configuracoes;
  onVoltar: () => void;
  onFeito: (resumo: string) => void;
};

/** Intervalos que fazem sentido num salão: de 15 em 15 dias, de mês a mês... */
const SEMANAS = [1, 2, 3, 4, 5, 6, 8, 10, 12];
const VEZES = [1, 2, 3, 4, 5, 6, 8, 10, 12];

type Proposta = {
  data: string;
  /** Porque é que este dia não dá. Null = pode marcar-se. */
  problema: string | null;
};

/**
 * Marcar as próximas vezes de uma visita que se repete (uma cor de quatro em quatro
 * semanas, por exemplo), de uma assentada e sem reescrever tudo.
 *
 * Cada vez fica uma visita independente: cancelar uma não mexe nas outras. Os dias
 * em que o salão está fechado, a funcionária está de folga ou a hora já está ocupada
 * aparecem assinalados e não se marcam.
 */
export default function RepetirModal({
  visita,
  funcionarios,
  servicos,
  configuracoes,
  onVoltar,
  onFeito,
}: Props) {
  const [semanas, setSemanas] = useState(4);
  const [vezes, setVezes] = useState(3);
  const [ocupado, setOcupado] = useState<Agendamento[]>([]);
  const [ausencias, setAusencias] = useState<Ausencia[]>([]);
  const [aVer, setAVer] = useState(true);
  const [aMarcar, setAMarcar] = useState(false);
  const [erro, setErro] = useState("");
  const [postas, setPostas] = useState<Set<string>>(new Set());
  const [tocadas, setTocadas] = useState(false);

  const datas = useMemo(
    () => datasDeRepeticao(visita.data, semanas, vezes),
    [semanas, vezes, visita.data],
  );
  // Só interessa o que há entre a primeira e a última data proposta.
  const primeira = datas[0] ?? visita.data;
  const ultima = datas[datas.length - 1] ?? visita.data;

  // O que já está marcado (e as folgas) daqui até à última data proposta.
  useEffect(() => {
    let ativo = true;
    setAVer(true);
    comSegundaTentativa(() =>
      Promise.all([
        api.listarAgendamentos(primeira, ultima),
        api.listarAusencias(primeira, ultima),
      ]),
    )
      .then(([marcacoes, folgas]) => {
        if (!ativo) return;
        setOcupado(marcacoes);
        setAusencias(folgas);
        setErro("");
      })
      .catch((causa) => {
        if (ativo) setErro(mensagemDeFalha(causa, "Não foi possível ver os dias seguintes."));
      })
      .finally(() => {
        if (ativo) setAVer(false);
      });
    return () => {
      ativo = false;
    };
  }, [primeira, ultima]);

  const propostas = useMemo<Proposta[]>(
    () =>
      datas.map((data) => ({
        data,
        problema: problemaNoDia({
          dia: data,
          clienteNome: visita.clienteNome,
          servicos: visita.servicos,
          configuracoes,
          ausencias,
          ocupado,
          nomeDe: (id) => funcionarios.find((pessoa) => pessoa.id === id)?.nome ?? "A funcionária",
        }),
      })),
    [ausencias, configuracoes, datas, funcionarios, ocupado, visita.clienteNome, visita.servicos],
  );

  // Por omissão vão os dias que dão. Depois de se mexer nas caixas, manda quem mexeu.
  useEffect(() => {
    if (tocadas) return;
    setPostas(new Set(propostas.filter((p) => !p.problema).map((p) => p.data)));
  }, [propostas, tocadas]);

  // Mudar o intervalo ou o número de vezes volta a propor os dias que dão.
  useEffect(() => {
    setTocadas(false);
  }, [semanas, vezes]);

  const trocar = (data: string) => {
    setTocadas(true);
    setPostas((anteriores) => {
      const novas = new Set(anteriores);
      if (novas.has(data)) novas.delete(data);
      else novas.add(data);
      return novas;
    });
  };

  const escolhidas = propostas.filter((p) => postas.has(p.data));

  const marcar = async () => {
    setAMarcar(true);
    setErro("");

    const feitas: string[] = [];
    const falhadas: string[] = [];

    for (const proposta of escolhidas) {
      try {
        await api.guardarVisita({
          visitaId: novoId(),
          apagar: [],
          marcacoes: visita.servicos.map((servico) => ({
            clienteId: visita.clienteId,
            funcionarioId: servico.funcionarioId,
            servicoId: servico.servicoId,
            data: proposta.data,
            inicio: servico.inicio,
            duracaoMinutos: servico.duracaoMinutos,
            status: "confirmado" as const,
            telefone: visita.telefone,
            observacoes: visita.observacoes,
          })),
        });
        feitas.push(proposta.data);
      } catch {
        falhadas.push(proposta.data);
      }
    }

    if (feitas.length === 0) {
      setAMarcar(false);
      setErro(
        falhadas.length > 0
          ? "Não foi possível marcar nenhuma das datas. Verifica se entretanto ficaram ocupadas."
          : "Escolhe pelo menos uma data.",
      );
      return;
    }

    const lista = feitas.map((data) => dataCompacta(data)).join(", ");
    const quantas = feitas.length === 1 ? "1 visita marcada" : `${feitas.length} visitas marcadas`;
    onFeito(
      falhadas.length === 0
        ? `${quantas}: ${lista}.`
        : `${quantas}: ${lista}. ${falhadas.length === 1 ? "1 data ficou por marcar" : `${falhadas.length} datas ficaram por marcar`} (entretanto ocupadas).`,
    );
  };

  const nomeServico = (id: string) => servicos.find((item) => item.id === id)?.nome ?? "Serviço";
  const fim = visita.servicos.reduce((tarde, item) => (item.fim > tarde ? item.fim : tarde), visita.inicio);

  return (
    <div
      className="confirmar-fundo"
      onMouseDown={(evento) => {
        evento.stopPropagation();
        if (!aMarcar) onVoltar();
      }}
    >
      <div
        className="confirmar-caixa caixa-repetir"
        role="dialog"
        aria-modal="true"
        aria-label="Repetir esta marcação"
        onMouseDown={(evento) => evento.stopPropagation()}
      >
        <h2>Repetir esta marcação</h2>

        <p className="repetir-resumo">
          <strong>{visita.clienteNome}</strong>
          <span>
            {visita.inicio}-{fim} ·{" "}
            {visita.servicos.map((servico) => nomeServico(servico.servicoId)).join(" + ")}
          </span>
          <span>A partir de {dataPorExtenso(visita.data)}</span>
        </p>

        <div className="repetir-escolhas">
          <label>
            De quantas em quantas semanas
            <select value={semanas} onChange={(evento) => setSemanas(Number(evento.target.value))}>
              {SEMANAS.map((valor) => (
                <option key={valor} value={valor}>
                  {valor === 1 ? "Todas as semanas" : `${valor} semanas`}
                </option>
              ))}
            </select>
          </label>

          <label>
            Quantas vezes
            <select value={vezes} onChange={(evento) => setVezes(Number(evento.target.value))}>
              {VEZES.map((valor) => (
                <option key={valor} value={valor}>
                  {valor === 1 ? "1 vez" : `${valor} vezes`}
                </option>
              ))}
            </select>
          </label>
        </div>

        {erro ? (
          <p className="login-error" role="alert">
            {erro}
          </p>
        ) : null}

        {aVer ? (
          <EcraEspera pequeno texto="A ver os dias seguintes..." />
        ) : (
          <ul className="repetir-datas">
            {propostas.map((proposta) => (
              <li key={proposta.data} className={proposta.problema ? "com-problema" : ""}>
                <label>
                  <input
                    type="checkbox"
                    checked={postas.has(proposta.data)}
                    onChange={() => trocar(proposta.data)}
                  />
                  <span className="repetir-dia">
                    {abreviaturaDiaSemana(proposta.data)}, {dataPorExtenso(proposta.data)}
                  </span>
                </label>
                {proposta.problema ? <em>{proposta.problema}</em> : null}
              </li>
            ))}
          </ul>
        )}

        <div className="confirmar-botoes">
          <button type="button" className="ghost-button" onClick={onVoltar} disabled={aMarcar}>
            Voltar
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={marcar}
            disabled={aMarcar || aVer || escolhidas.length === 0}
          >
            {aMarcar
              ? "A marcar..."
              : escolhidas.length === 1
                ? "Marcar 1 visita"
                : `Marcar ${escolhidas.length} visitas`}
          </button>
        </div>
      </div>
    </div>
  );
}
