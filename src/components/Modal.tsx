import { useEffect, type ReactNode } from "react";

type Props = {
  titulo: string;
  etiqueta?: string;
  largura?: "normal" | "larga";
  onFechar: () => void;
  children: ReactNode;
};

/** Casca dos modais: fundo escurecido, fecho com Escape ou clique fora. */
export default function Modal({
  titulo,
  etiqueta,
  largura = "normal",
  onFechar,
  children,
}: Props) {
  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") onFechar();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  return (
    <div className="modal-overlay" onMouseDown={onFechar}>
      <div
        className={`modal-card ${largura === "larga" ? "modal-larga" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onMouseDown={(evento) => evento.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            {etiqueta ? <p className="eyebrow">{etiqueta}</p> : null}
            <h2>{titulo}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onFechar} aria-label="Fechar">
            ×
          </button>
        </header>

        {children}
      </div>
    </div>
  );
}
