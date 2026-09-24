import { useState, type FormEvent } from "react";
import * as api from "../lib/api";
import { abreviaturaDiaSemana, dataCompacta, hoje, minutosDesdeMeiaNoite } from "../lib/datas";
import { agruparEmPeriodos, diasEntre, type Periodo } from "../lib/agenda";
import type { DiaEspecial } from "../lib/types";

type Props = {
  diasEspeciais: DiaEspecial[];
  onGuardado: () => void;
  onErro: (mensagem: string) => void;
  onAviso: (mensagem: string) => void;
};

/**
 * Feriados e férias, escolhidos à mão. Nesses dias manda o horário daqui em vez do da
 * semana (fechado, ou aberto a outras horas).
 */
export default function DiasEspeciais({ diasEspeciais, onGuardado, onErro, onAviso }: Props) {
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [nome, setNome] = useState("");
  const [aberto, setAberto] = useState(false);
  const [inicio, setInicio] = useState("09:00");
  const [fim, setFim] = useState("13:00");
  const [aGuardar, setAGuardar] = useState(false);
  const [aApagar, setAApagar] = useState<string | null>(null);
  const [verPassados, setVerPassados] = useState(false);

  const hojeChave = hoje();
  const periodos = agruparEmPeriodos(diasEspeciais);
  const proximos = periodos.filter((periodo) => periodo.fim >= hojeChave);
  const passados = periodos.filter((periodo) => periodo.fim < hojeChave).reverse();

  const acrescentar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const ultimo = ate || de;

    if (!de) return onErro("Escolhe o dia (ou o primeiro dia das férias).");
    if (ultimo < de) return onErro('O "até" tem de ser depois do "de".');
    if (!nome.trim()) return onErro("Dá um nome (ex.: Natal, Férias de agosto).");
    if (aberto && minutosDesdeMeiaNoite(fim) <= minutosDesdeMeiaNoite(inicio)) {
      return onErro("A hora de fecho tem de ser depois da de abertura.");
    }

    const dias = diasEntre(de, ultimo);
    setAGuardar(true);
    try {
      await api.criarDiasEspeciais(dias.map((data) => ({ data, nome, aberto, inicio, fim })));
      onGuardado();
      onAviso(
        dias.length === 1
          ? `${nome.trim()} acrescentado.`
          : `${nome.trim()}: ${dias.length} dias acrescentados.`,
      );
      setDe("");
      setAte("");
      setNome("");
    } catch (causa) {
      onErro(causa instanceof Error ? causa.message : "Não foi possível guardar.");
    } finally {
      setAGuardar(false);
    }
  };

  const apagar = async (periodo: Periodo) => {
    setAApagar(periodo.ids[0]);
    try {
      await api.apagarDiasEspeciais(periodo.ids);
      onGuardado();
      onAviso(`${periodo.nome} apagado. Nesses dias volta o horário normal.`);
    } catch (causa) {
      onErro(causa instanceof Error ? causa.message : "Não foi possível apagar.");
    } finally {
      setAApagar(null);
    }
  };

  const quando = (periodo: Periodo) =>
    periodo.inicio === periodo.fim
      ? `${abreviaturaDiaSemana(periodo.inicio)}, ${dataCompacta(periodo.inicio)}`
      : `${dataCompacta(periodo.inicio)} – ${dataCompacta(periodo.fim)}`;

  const linha = (periodo: Periodo) => (
    <li key={periodo.ids[0]} className={periodo.fim < hojeChave ? "passado" : ""}>
      <span className="dia-especial-data">
        {quando(periodo)}
        <em>
          {periodo.inicio.slice(0, 4)}
          {periodo.ids.length > 1 ? ` · ${periodo.ids.length} dias` : ""}
        </em>
      </span>
      <span className="dia-especial-nome">
        <strong>{periodo.nome}</strong>
        <em className={periodo.aberto ? "" : "fechado"}>
          {periodo.aberto ? `Aberto das ${periodo.horaInicio} às ${periodo.horaFim}` : "Fechado"}
        </em>
      </span>
      <button
        type="button"
        className="ghost-button"
        onClick={() => apagar(periodo)}
        disabled={aApagar === periodo.ids[0]}
      >
        {aApagar === periodo.ids[0] ? "A apagar..." : "Apagar"}
      </button>
    </li>
  );

  return (
    <section className="dias-especiais">
      <h3>Feriados e férias</h3>
      <p className="dica">
        Nestes dias manda o horário daqui em vez do da semana: dá para fechar (um feriado,
        uma semana de férias) ou abrir a outras horas, como a véspera de Natal até às 13:00.
      </p>

      <form className="form-dia-especial" onSubmit={acrescentar}>
        <label>
          De
          <input
            type="date"
            value={de}
            onChange={(evento) => {
              setDe(evento.target.value);
              limparAteSeForAntes(evento.target.value, ate, setAte);
            }}
          />
        </label>
        <label>
          Até
          <input
            type="date"
            value={ate}
            min={de || undefined}
            onChange={(evento) => setAte(evento.target.value)}
          />
        </label>
        <label className="campo-nome-dia">
          Nome
          <input
            type="text"
            value={nome}
            onChange={(evento) => setNome(evento.target.value)}
            placeholder="Ex.: Natal, Férias de agosto"
          />
        </label>
        <label>
          Nesses dias
          <select
            value={aberto ? "aberto" : "fechado"}
            onChange={(evento) => setAberto(evento.target.value === "aberto")}
          >
            <option value="fechado">Fechado</option>
            <option value="aberto">Aberto</option>
          </select>
        </label>
        {aberto ? (
          <>
            <label>
              Abre
              <input
                type="time"
                step={900}
                value={inicio}
                onChange={(evento) => setInicio(evento.target.value)}
              />
            </label>
            <label>
              Fecha
              <input
                type="time"
                step={900}
                value={fim}
                onChange={(evento) => setFim(evento.target.value)}
              />
            </label>
          </>
        ) : null}
        <button type="submit" className="primary-button" disabled={aGuardar}>
          {aGuardar ? "A guardar..." : "Acrescentar"}
        </button>
      </form>

      {proximos.length === 0 ? (
        <p className="dica">Ainda não há nada marcado daqui para a frente.</p>
      ) : (
        <ul className="lista-dias-especiais">{proximos.map(linha)}</ul>
      )}

      {passados.length > 0 ? (
        <>
          <button
            type="button"
            className="botao-texto"
            onClick={() => setVerPassados((atual) => !atual)}
          >
            {verPassados
              ? "Esconder os que já passaram"
              : `Ver os que já passaram (${passados.length})`}
          </button>
          {verPassados ? <ul className="lista-dias-especiais">{passados.map(linha)}</ul> : null}
        </>
      ) : null}
    </section>
  );
}

/** Ao escolher um "de" depois do "até", o "até" deixa de fazer sentido: limpa-se. */
function limparAteSeForAntes(de: string, ate: string, setAte: (valor: string) => void) {
  if (ate && de && ate < de) setAte("");
}
