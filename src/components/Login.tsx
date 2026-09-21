import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";

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

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erro, setErro] = useState("");
  const [aEntrar, setAEntrar] = useState(false);

  const entrar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (!supabase) {
      setErro("Supabase não configurado.");
      return;
    }

    setAEntrar(true);
    setErro("");

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) setErro(traduzirErro(error.message));
    setAEntrar(false);
  };

  return (
    <main className="login-shell">
      <div className="login-card">
        <p className="eyebrow">Acesso ao salão</p>
        <h1>Flor de Lotus</h1>
        <form onSubmit={entrar} className="login-form">
          <label>
            Email
            <input
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
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(evento) => {
                setPassword(evento.target.value);
                setErro("");
              }}
              placeholder="••••••••"
              required
            />
          </label>

          {erro ? (
            <p className="login-error" role="alert">
              {erro}
            </p>
          ) : null}

          <button type="submit" className="primary-button wide-button" disabled={aEntrar}>
            {aEntrar ? "A entrar..." : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}
