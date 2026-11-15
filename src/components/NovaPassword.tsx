import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import BotoesJanela, { dentroDoTauri } from "./BotoesJanela";

type Props = {
  /** A conta a que pertence o link do email. */
  email: string;
  onPronto: (mensagem: string) => void;
};

const MINIMO = 8;

const traduzirErro = (mensagem: string) => {
  const texto = mensagem.toLowerCase();
  if (texto.includes("different from the old")) {
    return "A palavra-passe nova tem de ser diferente da antiga.";
  }
  if (texto.includes("at least") || texto.includes("weak")) {
    return `A palavra-passe tem de ter pelo menos ${MINIMO} caracteres.`;
  }
  if (texto.includes("expired") || texto.includes("invalid")) {
    return "Este link já não serve (passou do tempo ou já foi usado). Pede outro no ecrã de entrada.";
  }
  if (texto.includes("failed to fetch") || texto.includes("network")) {
    return "Sem ligação à internet. Tenta outra vez.";
  }
  return mensagem;
};

/**
 * O ecrã que abre quando se segue o link do email de recuperação: escolher uma
 * palavra-passe nova. O link já deu entrada na conta, por isso só falta trocá-la.
 */
export default function NovaPassword({ email, onPronto }: Props) {
  const [nova, setNova] = useState("");
  const [repetida, setRepetida] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [erro, setErro] = useState("");
  const [aGuardar, setAGuardar] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  const tauri = dentroDoTauri();

  useEffect(() => {
    campo.current?.focus();
  }, []);

  const guardar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setErro("");

    if (nova.length < MINIMO) {
      setErro(`A palavra-passe tem de ter pelo menos ${MINIMO} caracteres.`);
      return;
    }
    if (nova !== repetida) {
      setErro("As duas palavras-passe não são iguais.");
      return;
    }
    if (!supabase) return;

    setAGuardar(true);
    const { error } = await supabase.auth.updateUser({ password: nova });
    setAGuardar(false);

    if (error) {
      setErro(traduzirErro(error.message));
      return;
    }

    onPronto("Palavra-passe mudada. Já estás dentro da agenda.");
  };

  return (
    <main className="login-shell">
      {tauri ? (
        <div className="login-barra" data-tauri-drag-region>
          <BotoesJanela />
        </div>
      ) : null}

      <svg className="login-petalas" viewBox="-200 -200 400 400" aria-hidden="true">
        {[-74, -37, 0, 37, 74].map((angulo) => (
          <path
            key={angulo}
            d="M0 0 C -46 -48 -46 -128 0 -172 C 46 -128 46 -48 0 0 Z"
            transform={`rotate(${angulo}) scale(${Math.abs(angulo) === 74 ? 0.78 : Math.abs(angulo) === 37 ? 0.92 : 1})`}
          />
        ))}
      </svg>

      <div className="login-card">
        <img className="login-logo" src="/icons/icone.svg" alt="" width={56} height={56} />
        <h1>Nova palavra-passe</h1>
        <p className="login-cumprimento">
          {email ? <>Para a conta {email}. </> : null}
          Escolhe uma palavra-passe nova, com pelo menos {MINIMO} caracteres.
        </p>

        <form onSubmit={guardar} className="login-form">
          <label>
            Palavra-passe nova
            <span className="campo-password">
              <input
                ref={campo}
                type={mostrar ? "text" : "password"}
                autoComplete="new-password"
                value={nova}
                onChange={(evento) => {
                  setNova(evento.target.value);
                  setErro("");
                }}
                required
              />
              <button
                type="button"
                className="mostrar-password"
                onClick={() => setMostrar((atual) => !atual)}
                aria-pressed={mostrar}
              >
                {mostrar ? "Esconder" : "Mostrar"}
              </button>
            </span>
          </label>

          <label>
            Repete a palavra-passe nova
            <span className="campo-password">
              <input
                type={mostrar ? "text" : "password"}
                autoComplete="new-password"
                value={repetida}
                onChange={(evento) => {
                  setRepetida(evento.target.value);
                  setErro("");
                }}
                required
              />
            </span>
          </label>

          {erro ? (
            <p className="login-error" role="alert">
              {erro}
            </p>
          ) : null}

          <button type="submit" className="primary-button wide-button" disabled={aGuardar}>
            {aGuardar ? "A guardar..." : "Guardar e entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}
