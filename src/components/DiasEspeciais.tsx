import { useState, type FormEvent } from "react";
import * as api from "../lib/api";
import { abreviaturaDiaSemana, dataCompacta, hoje, minutosDesdeMeiaNoite } from "../lib/datas";
import type { DiaEspecial } from "../lib/types";

type Props = {
  diasEspeciais: DiaEspecial[];
  onGuardado: () => void;
  onErro: (mensagem: string) => void;
  onAviso: (mensagem: string) => void;
};

/**
 * Feriados e dias especiais, escolhidos à mão. Nesses dias manda o horário daqui em
 * vez do da semana (fechado, ou aberto a outras horas).
 */
export default function DiasEspeciais({ diasEspeciais, onGuardado, onErro, onAviso }: Props) {
  const [data, setData] = useState("");
  const [nome, setNome] = useState("");
  const [aberto, setAberto] = useState(false);
  const [inicio, setInicio] = useState("09:00");
  const [fim, setFim] = useState("13:00");
  const [aGuardar, setAGuardar] = useState(false);
  const [aApagar, setAApagar] = useState<string | null>(null);
  const [verPassados, setVerPassados] = useState(false);

  const hojeChave = hoje();
  const proximos = diasEspeciais.filter((dia) => dia.data >= hojeChave);
  const passados = diasEspeciais.filter((dia) => dia.data < hojeChave).reverse();

  const acrescentar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (!data) return onErro("Escolhe o dia.");
    if (!nome.trim()) return onErro("Dá um nome ao dia (ex.: Natal).");
    if (aberto && minutosDesdeMeiaNoite(fim) <= minutosDesdeMeiaNoite(inicio)) {
      return onErro("A hora de fecho tem de ser depois da de abertura.");
    }

    setAGuardar(true);
    try {
      await api.criarDiaEspecial({ data, nome, aberto, inicio, fim });
      onGuardado();
      onAviso(`${nome.trim()} acrescentado.`);
      setData("");
      setNome("");
    } catch (causa) {
      onErro(causa instanceof Error ? causa.message : "Não foi possível guardar o dia.");
    } finally {
      setAGuardar(false);
    }
  };

  const apagar = async (dia: DiaEspecial) => {
    setAApagar(dia.id);
    try {
      await api.apagarDiaEspecial(dia.id);
      onGuardado();
      onAviso(`${dia.nome} apagado. Nesse dia volta o horário normal.`);
    } catch (causa) {
      onErro(causa instanceof Error ? causa.message : "Não foi possível apagar o dia.");
    } finally {
      setAApagar(null);
    }
  };

  const linha = (dia: DiaEspecial) => (
    <li key={dia.id} className={dia.data < hojeChave ? "passado" : ""}>
      <span className="dia-especial-data">
        {abreviaturaDiaSemana(dia.data)}, {dataCompacta(dia.data)}
        <em>{dia.data.slice(0, 4)}</em>
      </span>
      <span className="dia-especial-nome">
        <strong>{dia.nome}</strong>
        <em className={dia.aberto ? "" : "fechado"}>
          {dia.aberto ? `Aberto das ${dia.inicio} às ${dia.fim}` : "Fechado"}
        </em>
      </span>
      <button
        type="button"
        className="ghost-button"
        onClick={() => apagar(dia)}
        disabled={aApagar === dia.id}
      >
        {aApagar === dia.id ? "A apagar..." : "Apagar"}
      </button>
    </li>
  );

  return (
    <section className="dias-especiais">
      <h3>Feriados e dias especiais</h3>
      <p className="dica">
        Nestes dias manda o horário daqui em vez do da semana: dá para fechar, ou abrir a
        outras horas (ex.: véspera de Natal até às 13:00).
      </p>

      <form className="form-dia-especial" onSubmit={acrescentar}>
        <label>
          Dia
          <input type="date" value={data} onChange={(evento) => setData(evento.target.value)} />
        </label>
        <label className="campo-nome-dia">
          Nome
          <input
            type="text"
            value={nome}
            onChange={(evento) => setNome(evento.target.value)}
            placeholder="Ex.: Natal"
          />
        </label>
        <label>
          Nesse dia
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
        <p className="dica">Ainda não há nenhum dia marcado daqui para a frente.</p>
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
