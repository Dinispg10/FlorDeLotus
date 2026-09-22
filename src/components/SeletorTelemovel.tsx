type Props = {
  /** A data (ou período) por extenso, em destaque. */
  titulo: string;
  /** Linha pequena por baixo: "Hoje · Aberto das 09:00 às 19:00", "Esta semana"... */
  subtitulo?: string;
  /** Dia de referência (AAAA-MM-DD): tocar no meio abre o calendário para o mudar. */
  dia: string;
  onEscolherDia: (dia: string) => void;
  onAnterior: () => void;
  onSeguinte: () => void;
  rotuloAnterior: string;
  rotuloSeguinte: string;
};

/**
 * O seletor de data do telemóvel: setas grandes dos lados e a data ao meio. É o mesmo
 * na agenda, nos lembretes e nas estatísticas.
 */
export default function SeletorTelemovel({
  titulo,
  subtitulo,
  dia,
  onEscolherDia,
  onAnterior,
  onSeguinte,
  rotuloAnterior,
  rotuloSeguinte,
}: Props) {
  return (
    <div className="cabecalho-dia-telemovel">
      <button type="button" className="seta" onClick={onAnterior} aria-label={rotuloAnterior}>
        ‹
      </button>

      {/* O campo de data fica invisível por cima do texto: tocar abre o calendário. */}
      <label className="data-telemovel">
        <strong>{titulo}</strong>
        {subtitulo ? <span>{subtitulo}</span> : null}
        <input
          type="date"
          value={dia}
          onChange={(evento) => {
            if (evento.target.value) onEscolherDia(evento.target.value);
          }}
          aria-label="Escolher data"
        />
      </label>

      <button type="button" className="seta" onClick={onSeguinte} aria-label={rotuloSeguinte}>
        ›
      </button>
    </div>
  );
}
