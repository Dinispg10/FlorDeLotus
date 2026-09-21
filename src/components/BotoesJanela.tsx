import { useEffect, useMemo, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

/** Fora do Tauri (ex.: `npm run dev` no browser) não há janela para controlar. */
export const dentroDoTauri = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Minimizar, maximizar e fechar, já que a moldura do Windows está desligada. */
export default function BotoesJanela() {
  const janela = useMemo(() => (dentroDoTauri() ? getCurrentWindow() : null), []);
  const [maximizada, setMaximizada] = useState(false);

  useEffect(() => {
    if (!janela) return;

    const sincronizar = async () => {
      try {
        setMaximizada(await janela.isMaximized());
      } catch {
        // A janela pode não estar pronta; o próximo evento corrige.
      }
    };

    sincronizar();
    const porDesligar = janela.onResized(sincronizar);

    return () => {
      porDesligar.then((desligar) => desligar()).catch(() => {});
    };
  }, [janela]);

  if (!janela) return null;

  const alternarMaximizar = async () => {
    const estava = await janela.isMaximized();
    await (estava ? janela.unmaximize() : janela.maximize());
    setMaximizada(!estava);
  };

  return (
    <div className="janela-botoes">
      <button
        type="button"
        className="janela-botao"
        onClick={() => janela.minimize()}
        aria-label="Minimizar"
        title="Minimizar"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 12h12" />
        </svg>
      </button>

      <button
        type="button"
        className="janela-botao"
        onClick={alternarMaximizar}
        aria-label={maximizada ? "Restaurar" : "Maximizar"}
        title={maximizada ? "Restaurar" : "Maximizar"}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          {maximizada ? (
            <>
              <path d="M9 6h9v9" />
              <path d="M15 6v3h-6v9h9v-6h-3" />
            </>
          ) : (
            <path d="M7 7h10v10H7z" />
          )}
        </svg>
      </button>

      <button
        type="button"
        className="janela-botao fechar"
        onClick={() => janela.close()}
        aria-label="Fechar"
        title="Fechar"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 7l10 10M17 7L7 17" />
        </svg>
      </button>
    </div>
  );
}
