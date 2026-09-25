import { ausenciasDoDia, diaEspecialDe, horarioDoDia } from "../lib/agenda";
import { abreviaturaDiaSemana, hoje, numeroDoDia } from "../lib/datas";
import { minutosDisponiveis } from "../lib/estatisticas";
import {
  ROTULO_AUSENCIA,
  ROTULO_STATUS,
  type Agendamento,
  type Ausencia,
  type Configuracoes,
  type Funcionario,
  type Servico,
} from "../lib/types";

type Props = {
  dias: string[];
  funcionarios: Funcionario[];
  servicos: Servico[];
  agendamentos: Agendamento[];
  ausencias: Ausencia[];
  configuracoes: Configuracoes;
  onAbrirDia: (dia: string) => void;
  onAbrirExistente: (agendamento: Agendamento) => void;
};

const QUEBRA = String.fromCharCode(10);
/** A partir desta hora conta como tarde. */
const MEIO_DIA = "13:00";

/**
 * A semana toda em lista, um dia por coluna. Cada dia diz quantas marcações tem e
 * quanto do tempo está ocupado; a manhã e a tarde ficam separadas, e cada linha mostra
 * a funcionária pela inicial, na cor dela.
 */
export default function ListaSemana({
  dias,
  funcionarios,
  servicos,
  agendamentos,
  ausencias,
  configuracoes,
  onAbrirDia,
  onAbrirExistente,
}: Props) {
  const hojeChave = hoje();

  const linha = (marcacao: Agendamento) => {
    const servico = servicos.find((item) => item.id === marcacao.servicoId);
    const dona = funcionarios.find((item) => item.id === marcacao.funcionarioId);

    return (
      <button
        key={marcacao.id}
        type="button"
        className={`linha-marcacao estado-${marcacao.status}`}
        style={dona ? { borderLeftColor: dona.cor } : undefined}
        onClick={() => onAbrirExistente(marcacao)}
        title={[
          `${marcacao.inicio}-${marcacao.fim} · ${marcacao.cliente}`,
          servico?.nome ?? marcacao.servicoNome,
          dona?.nome ?? "",
          marcacao.telefone,
          ROTULO_STATUS[marcacao.status],
        ]
          .filter(Boolean)
          .join(QUEBRA)}
      >
        <span className="linha-hora-texto">{marcacao.inicio}</span>
        <span className="linha-cliente">{marcacao.cliente}</span>
        <span
          className="inicial-funcionaria"
          style={dona ? { background: dona.cor } : undefined}
          aria-hidden="true"
        >
          {dona?.nome.charAt(0) ?? "?"}
        </span>
      </button>
    );
  };

  return (
    <div className="grelha-lista">
      {dias.map((dia) => {
        const horario = horarioDoDia(configuracoes, dia);
        const especial = diaEspecialDe(configuracoes, dia);
        const doDia = agendamentos
          .filter((item) => item.data === dia)
          .sort((a, b) => a.inicioMs - b.inicioMs);
        const folgas = ausenciasDoDia(ausencias, null, dia);

        // Ocupação do dia: o tempo marcado contra as horas de toda a equipa.
        const ocupados = doDia.reduce((total, item) => total + item.duracaoMinutos, 0);
        const disponiveis = funcionarios.reduce(
          (total, pessoa) => total + minutosDisponiveis(pessoa.id, [dia], configuracoes, ausencias),
          0,
        );
        const ocupacao = disponiveis > 0 ? Math.round((ocupados / disponiveis) * 100) : null;

        const manha = doDia.filter((item) => item.inicio < MEIO_DIA);
        const tarde = doDia.filter((item) => item.inicio >= MEIO_DIA);

        return (
          <div key={dia} className={`coluna-dia ${dia === hojeChave ? "coluna-hoje" : ""}`}>
            <button
              type="button"
              className="cabecalho-coluna clicavel"
              onClick={() => onAbrirDia(dia)}
              title="Ver este dia hora a hora"
            >
              <h3>
                {abreviaturaDiaSemana(dia)} {numeroDoDia(dia)}
              </h3>
              <p>
                {!horario.aberto
                  ? especial
                    ? especial.nome
                    : "Fechado"
                  : `${doDia.length} ${doDia.length === 1 ? "marcação" : "marcações"}`}
              </p>
              <span className="barra-do-dia" aria-hidden="true">
                <i style={{ width: `${Math.min(100, ocupacao ?? 0)}%` }} />
              </span>
            </button>

            <div className="lista-dia">
              {!horario.aberto ? (
                <p className="dia-fechado-nota">
                  {especial ? `${especial.nome} · fechado` : "Fechado"}
                </p>
              ) : null}

              {folgas.map((ausencia) => {
                const dona = funcionarios.find((item) => item.id === ausencia.funcionarioId);
                return (
                  <p key={ausencia.id} className={`nota-folga ${ausencia.tipo}`}>
                    {dona?.nome ?? ""} · {ROTULO_AUSENCIA[ausencia.tipo].toLowerCase()}
                  </p>
                );
              })}

              {doDia.length === 0 && horario.aberto ? <p className="dia-sem-nada">—</p> : null}

              {manha.length > 0 ? <p className="parte-do-dia">Manhã</p> : null}
              {manha.map(linha)}
              {tarde.length > 0 ? <p className="parte-do-dia">Tarde</p> : null}
              {tarde.map(linha)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
