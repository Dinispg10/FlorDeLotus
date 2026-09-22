import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";

type Props = {
  email: string;
  onAviso: (mensagem: string) => void;
};

const MINIMO = 8;

const traduzirErro = (mensagem: string) => {
  const texto = mensagem.toLowerCase();
  if (texto.includes("different from the old")) {
    return "A palavra-passe nova tem de ser diferente da atual.";
  }
  if (texto.includes("at least") || texto.includes("weak")) {
    return `A palavra-passe tem de ter pelo menos ${MINIMO} caracteres.`;
  }
  if (texto.includes("failed to fetch") || texto.includes("network")) {
    return "Sem ligação à internet. Tenta outra vez.";
  }
  if (texto.includes("reauthentication") || texto.includes("session")) {
    return "A sessão expirou. Sai, volta a entrar e muda a palavra-passe logo a seguir.";
  }
  return mensagem;
};

/**
 * Cada pessoa muda a sua palavra-passe. A conta é criada no Supabase com uma
 * palavra-passe provisória; aqui troca-se por uma que só a própria pessoa sabe.
 */
export default function ContaView({ email, onAviso }: Props) {
  const [nova, setNova] = useState("");
  const [repetida, setRepetida] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [erro, setErro] = useState("");
  const [aGuardar, setAGuardar] = useState(false);

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

    setNova("");
    setRepetida("");
    onAviso("Palavra-passe mudada. Da próxima vez entra com a nova.");
  };

  return (
    <div className="cartao cartao-conta">
      <div className="cartao-topo">
        <div>
          <h2>A minha conta</h2>
          <p className="subtitulo">Entraste como {email}</p>
        </div>
      </div>

      <form onSubmit={guardar} className="booking-form form-conta">
        <h3>Mudar a palavra-passe</h3>

        <label>
          Palavra-passe nova
          <input
            type={mostrar ? "text" : "password"}
            autoComplete="new-password"
            value={nova}
            onChange={(evento) => {
              setNova(evento.target.value);
              setErro("");
            }}
            required
          />
        </label>

        <label>
          Repete a palavra-passe nova
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
        </label>

        <label className="checkbox">
          <input type="checkbox" checked={mostrar} onChange={(evento) => setMostrar(evento.target.checked)} />
          Mostrar o que estou a escrever
        </label>

        {erro ? (
          <p className="login-error" role="alert">
            {erro}
          </p>
        ) : null}

        <div className="modal-actions-direita">
          <button type="submit" className="primary-button" disabled={aGuardar}>
            {aGuardar ? "A guardar..." : "Mudar palavra-passe"}
          </button>
        </div>
      </form>
    </div>
  );
}
