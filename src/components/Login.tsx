import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { supabase } from "../lib/supabase";
import BotoesJanela, { dentroDoTauri } from "./BotoesJanela";

/** As mensagens do Supabase vêm em inglês; mostramos algo útil a quem está ao balcão. */
const traduzirErro = (mensagem: string) => {
  const texto = mensagem.toLowerCase();
  if (texto.includes("invalid login credentials")) {
    return "Email ou palavra-passe incorretos.";
  }
  if (texto.includes("email not confirmed")) {
    return "Esta conta ainda não confirmou o email.";
  }
  if (texto.includes("failed to fetch") || texto.includes("network")) {
    return "Sem ligação à internet. A agenda precisa de rede para sincronizar.";
  }
  if (texto.includes("rate limit") || texto.includes("too many")) {
    return "Demasiadas tentativas. Espera um minuto e tenta outra vez.";
  }
  return mensagem;
};

// Só o email fica guardado neste aparelho, nunca a palavra-passe.
const CHAVE_EMAIL = "flordelotus.ultimoEmail";

const lerEmailGuardado = () => {
  try {
    return localStorage.getItem(CHAVE_EMAIL) ?? "";
  } catch {
    return "";
  }
};

const cumprimento = () => {
  const hora = new Date().getHours();
  if (hora >= 6 && hora < 13) return "Bom dia!";
  if (hora >= 13 && hora < 20) return "Boa tarde!";
  return "Boa noite!";
};

export default function Login() {
  const [email, setEmail] = useState(lerEmailGuardado);
  const [password, setPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [erro, setErro] = useState("");
  const [aEntrar, setAEntrar] = useState(false);
  const [versao, setVersao] = useState("");
  const campoEmail = useRef<HTMLInputElement>(null);
  const campoPassword = useRef<HTMLInputElement>(null);
  const tauri = dentroDoTauri();

  useEffect(() => {
    // Quem já entrou neste aparelho só tem de escrever a palavra-passe.
    (email ? campoPassword : campoEmail).current?.focus();
    // Só ao abrir: não mudar o foco enquanto se escreve.
  }, []);

  useEffect(() => {
    if (!tauri) return;
    getVersion()
      .then(setVersao)
      .catch(() => {});
  }, [tauri]);

  const verCapsLock = (evento: KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(evento.getModifierState("CapsLock"));
  };

  const entrar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (!supabase) {
      setErro("Supabase não configurado.");
      return;
    }

    setAEntrar(true);
    setErro("");

    const emailLimpo = email.trim();
    const { error } = await supabase.auth.signInWithPassword({
      email: emailLimpo,
      password,
    });

    if (error) {
      setErro(traduzirErro(error.message));
      setAEntrar(false);
      campoPassword.current?.select();
      return;
    }

    try {
      localStorage.setItem(CHAVE_EMAIL, emailLimpo);
    } catch {
      // sem problema: da próxima vez escreve-se o email outra vez
    }
    setAEntrar(false);
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
        <p className="eyebrow">Agenda</p>
        <h1>Flor de Lotus</h1>
        <p className="login-cumprimento">{cumprimento()} Entra para ver a agenda do salão.</p>

        <form onSubmit={entrar} className="login-form">
          <label>
            Email
            <input
              ref={campoEmail}
              type="email"
              autoComplete="username"
              value={email}
              onChange={(evento) => {
                setEmail(evento.target.value);
                setErro("");
              }}
              placeholder="salao@flordelotus.pt"
              required
            />
          </label>

          <label>
            Palavra-passe
            <span className="campo-password">
              <input
                ref={campoPassword}
                type={mostrarPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(evento) => {
                  setPassword(evento.target.value);
                  setErro("");
                }}
                onKeyDown={verCapsLock}
                onKeyUp={verCapsLock}
                onBlur={() => setCapsLock(false)}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                className="mostrar-password"
                onClick={() => setMostrarPassword((atual) => !atual)}
                aria-pressed={mostrarPassword}
              >
                {mostrarPassword ? "Esconder" : "Mostrar"}
              </button>
            </span>
          </label>

          {capsLock ? <p className="login-aviso">O Caps Lock está ligado.</p> : null}

          {erro ? (
            <p className="login-error" role="alert">
              {erro}
            </p>
          ) : null}

          <button type="submit" className="primary-button wide-button" disabled={aEntrar}>
            {aEntrar ? "A entrar..." : "Entrar"}
          </button>
        </form>

        <p className="login-ajuda">Esqueceste-te da palavra-passe? Pede à gerência para a mudar.</p>
      </div>

      {versao ? <p className="login-versao">Versão {versao}</p> : null}
    </main>
  );
}
