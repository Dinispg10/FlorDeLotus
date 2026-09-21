import { useEffect, useRef, type ReactNode } from "react";

type Props = {
  titulo: string;
  children?: ReactNode;
  textoConfirmar: string;
  textoVoltar?: string;
  /** O que o botão diz enquanto a ação decorre: "A cancelar...", "A apagar...". */
  textoAProcessar?: string;
  aProcessar?: boolean;
  onConfirmar: () => void;
  onVoltar: () => void;
};

/**
 * Pergunta antes de uma ação sem volta. Abre por cima de tudo, incluindo de
 * outra janela, e o Escape só a fecha a ela.
 */
export default function ConfirmarModal({
  titulo,
  children,
  textoConfirmar,
  textoVoltar = "Voltar",
  textoAProcessar = "Um momento...",
  aProcessar = false,
  onConfirmar,
  onVoltar,
}: Props) {
  const botaoVoltar = useRef<HTMLButtonElement>(null);

  // O foco começa em "Voltar": um Enter distraído não apaga nada.
  useEffect(() => {
    botaoVoltar.current?.focus();
  }, []);

  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key !== "Escape") return;
      // Não deixa o Escape chegar à janela de baixo e fechá-la também.
      evento.stopImmediatePropagation();
      onVoltar();
    };
    window.addEventListener("keydown", aoTeclar, { capture: true });
    return () => window.removeEventListener("keydown", aoTeclar, { capture: true });
  }, [onVoltar]);

  return (
    <div
      className="confirmar-fundo"
      onMouseDown={(evento) => {
        evento.stopPropagation();
        if (!aProcessar) onVoltar();
      }}
    >
      <div
        className="confirmar-caixa"
        role="alertdialog"
        aria-modal="true"
        aria-label={titulo}
        onMouseDown={(evento) => evento.stopPropagation()}
      >
        <div className="confirmar-icone" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
            <path d="M10.3 3.9 2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
          </svg>
        </div>

        <h2>{titulo}</h2>
        {children ? <div className="confirmar-texto">{children}</div> : null}

        <div className="confirmar-botoes">
          <button
            ref={botaoVoltar}
            type="button"
            className="ghost-button"
            onClick={onVoltar}
            disabled={aProcessar}
          >
            {textoVoltar}
          </button>
          <button
            type="button"
            className="botao-perigo"
            onClick={onConfirmar}
            disabled={aProcessar}
          >
            {aProcessar ? textoAProcessar : textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
