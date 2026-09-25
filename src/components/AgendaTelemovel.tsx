import { useMemo, useRef } from "react";
import { ausenciasDoDia, descreverDiaEspecial, diaEspecialDe, horarioDoDia } from "../lib/agenda";
import { dataPorExtenso, hoje, somarDias } from "../lib/datas";
import {
  ROTULO_AUSENCIA,
  type Agendamento,
  type Cliente,
  type Ausencia,
  type Configuracoes,
  type Funcionario,
  type Servico,
} from "../lib/types";
import type { PreDefinicao } from "./AgendamentoModal";
import PesquisaMarcacoes from "./PesquisaMarcacoes";
import SeletorTelemovel from "./SeletorTelemovel";
import EstadoVazio from "./EstadoVazio";

/** Distância mínima, em pixels, para um deslizar do dedo mudar de dia. */
const DESLIZE_MINIMO = 70;

type Props = {
  dia: string;
  funcionariaSelecionada: string | null;
  agendamentosDaSemana: Agendamento[];
  ausencias: Ausencia[];
  funcionarios: Funcionario[];
  servicos: Servico[];
  configuracoes: Configuracoes;
  bloqueado: boolean;
  motivoBloqueio: string;
  onMudarDia: (dia: string) => void;
  onEscolherFuncionaria: (funcionariaId: string | null) => void;
  onAbrirNovo: (pre: PreDefinicao) => void;
  onAbrirExistente: (agendamento: Agendamento) => void;
  clientes: Cliente[];
};

/**
 * A agenda num telemóvel: um dia de cada vez, em lista por hora, em vez das colunas
 * lado a lado do computador. Desliza-se para o lado para mudar de dia.
 */
export default function AgendaTelemovel({
  dia,
  funcionariaSelecionada,
  agendamentosDaSemana,
  ausencias,
  funcionarios,
  servicos,
  configuracoes,
  bloqueado,
  motivoBloqueio,
  onMudarDia,
  onEscolherFuncionaria,
  onAbrirNovo,
  onAbrirExistente,
  clientes,
}: Props) {
  const inicioDoToque = useRef<{ x: number; y: number } | null>(null);

  const doDia = useMemo(
    () =>
      agendamentosDaSemana
        .filter(
          (item) =>
            item.data === dia &&
            (funcionariaSelecionada === null || item.funcionarioId === funcionariaSelecionada),
        )
        .sort((a, b) => a.inicioMs - b.inicioMs),
    [agendamentosDaSemana, dia, funcionariaSelecionada],
  );

  const horario = horarioDoDia(configuracoes, dia);
  const folgas = ausenciasDoDia(ausencias, funcionariaSelecionada, dia);

  return (
    <section className="agenda-telemovel">
      <SeletorTelemovel
        titulo={dataPorExtenso(dia)}
        subtitulo={`${dia === hoje() ? "Hoje · " : ""}${
          diaEspecialDe(configuracoes, dia)
            ? descreverDiaEspecial(diaEspecialDe(configuracoes, dia)!)
            : horario.aberto
              ? `Aberto das ${horario.inicio} às ${horario.fim}`
              : "Salão fechado"
        }`}
        dia={dia}
        onEscolherDia={onMudarDia}
        onAnterior={() => onMudarDia(somarDias(dia, -1))}
        onSeguinte={() => onMudarDia(somarDias(dia, 1))}
        rotuloAnterior="Dia anterior"
        rotuloSeguinte="Dia seguinte"
      />

      <div className="linha-chips-telemovel">
      <PesquisaMarcacoes
        clientes={clientes}
        funcionarios={funcionarios}
        servicos={servicos}
        onEscolher={(marcacao) => {
          onMudarDia(marcacao.data);
          onAbrirExistente(marcacao);
        }}
      />
      <div className="chips chips-deslizar">
        <button
          type="button"
          className={`chip ${funcionariaSelecionada === null ? "ativo" : ""}`}
          onClick={() => onEscolherFuncionaria(null)}
        >
          Todas
        </button>
        {funcionarios.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`chip ${funcionariaSelecionada === item.id ? "ativo" : ""}`}
            onClick={() => onEscolherFuncionaria(item.id)}
          >
            <span className="ponto-cor" style={{ background: item.cor }} />
            {item.nome}
          </button>
        ))}
      </div>
      </div>

      <div
        className="lista-dia-telemovel"
        onTouchStart={(evento) => {
          const toque = evento.touches[0];
          inicioDoToque.current = { x: toque.clientX, y: toque.clientY };
        }}
        onTouchEnd={(evento) => {
          const inicio = inicioDoToque.current;
          inicioDoToque.current = null;
          if (!inicio) return;
          const toque = evento.changedTouches[0];
          const dx = toque.clientX - inicio.x;
          const dy = toque.clientY - inicio.y;
          // Só conta como deslizar se for claramente na horizontal (não estraga o scroll).
          if (Math.abs(dx) < DESLIZE_MINIMO || Math.abs(dx) < Math.abs(dy) * 1.5) return;
          onMudarDia(somarDias(dia, dx < 0 ? 1 : -1));
        }}
      >
        {folgas.map((ausencia) => {
          const dona = funcionarios.find((item) => item.id === ausencia.funcionarioId);
          return (
            <p key={ausencia.id} className={`nota-folga ${ausencia.tipo}`}>
              {dona?.nome ?? ""} · {ROTULO_AUSENCIA[ausencia.tipo].toLowerCase()}
              {ausencia.horaInicio ? ` das ${ausencia.horaInicio} às ${ausencia.horaFim}` : ""}
            </p>
          );
        })}

        {doDia.length === 0 ? (
          <EstadoVazio
            titulo={horario.aberto ? "Dia livre" : "Salão fechado"}
            ajuda={horario.aberto ? "Carrega no + para marcar." : "Nenhuma marcação é possível neste dia."}
          />
        ) : (
          doDia.map((marcacao) => {
            const servico = servicos.find((item) => item.id === marcacao.servicoId);
            const dona = funcionarios.find((item) => item.id === marcacao.funcionarioId);

            return (
              <button
                key={marcacao.id}
                type="button"
                className={`cartao-marcacao estado-${marcacao.status}`}
                style={dona ? { borderLeftColor: dona.cor } : undefined}
                onClick={() => onAbrirExistente(marcacao)}
              >
                <span className="cartao-horas">
                  <strong>{marcacao.inicio}</strong>
                  <span>{marcacao.fim}</span>
                </span>
                <span className="cartao-corpo">
                  <strong>{marcacao.cliente}</strong>
                  <span>
                    {servico?.nome ?? "Serviço"}
                    {funcionariaSelecionada === null && dona ? ` · ${dona.nome}` : ""}
                  </span>
                </span>
                {marcacao.status === "pendente" ? (
                  <span className="estado-etiqueta pendente">Pendente</span>
                ) : null}
              </button>
            );
          })
        )}
      </div>

      <button
        type="button"
        className="botao-flutuante"
        onClick={() =>
          onAbrirNovo({ data: dia, funcionarioId: funcionariaSelecionada ?? undefined })
        }
        disabled={bloqueado}
        aria-label="Nova marcação"
        title={bloqueado ? motivoBloqueio : "Nova marcação"}
      >
        +
      </button>
    </section>
  );
}
