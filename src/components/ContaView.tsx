import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import ConfirmarModal from "./ConfirmarModal";

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
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  const [aSair, setASair] = useState(false);
  const [repetida, setRepetida] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [erro, setErro] = useState("");
  const [aGuardar, setAGuardar] = useState(false);

  /** Fecha a sessão em todo o lado (aparelho perdido, alguém que saiu da equipa). */
  const terminarTodasAsSessoes = async () => {
    if (!supabase) return;
    setASair(true);
    const { error } = await supabase.auth.signOut({ scope: "global" });
    if (error) {
      setASair(false);
      setConfirmarSaida(false);
      setErro(traduzirErro(error.message));
      return;
    }
    // A app volta sozinha ao ecrã de entrada assim que a sessão desaparece.
    onAviso("Sessão terminada em todos os aparelhos.");
  };

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
          <span className="campo-password">
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

      <section className="seccao-sessoes">
        <h3>Sessões</h3>
        <p className="dica">
          Fecha esta conta em todos os aparelhos onde esteja aberta: o computador do salão,
          telemóveis, um telemóvel perdido. Depois é preciso voltar a entrar em cada um.
        </p>
        <button type="button" className="danger-button" onClick={() => setConfirmarSaida(true)}>
          Terminar sessão em todos os aparelhos
        </button>
      </section>

      {confirmarSaida ? (
        <ConfirmarModal
          titulo="Terminar sessão em todos os aparelhos?"
          textoConfirmar="Sim, terminar"
          textoAProcessar="A terminar..."
          aProcessar={aSair}
          onConfirmar={terminarTodasAsSessoes}
          onVoltar={() => setConfirmarSaida(false)}
        >
          <p>
            <strong>{email}</strong>
          </p>
          <p>
            Esta conta sai de todos os aparelhos, incluindo este. Nada se perde: as marcações
            e os clientes ficam como estão.
          </p>
          <p>
            Se foi um telemóvel perdido, muda também a palavra-passe aqui antes de voltar a
            entrar noutro lado.
          </p>
        </ConfirmarModal>
      ) : null}
    </div>
  );
}
