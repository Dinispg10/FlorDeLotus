import BotaoAtualizar from "./BotaoAtualizar";
import BotoesJanela from "./BotoesJanela";

export type Separador = "agenda" | "clientes" | "estatisticas" | "definicoes";

const SEPARADORES: { chave: Separador; rotulo: string }[] = [
  { chave: "agenda", rotulo: "Agenda" },
  { chave: "clientes", rotulo: "Clientes" },
  { chave: "estatisticas", rotulo: "Estatísticas" },
  { chave: "definicoes", rotulo: "Definições" },
];

type Props = {
  separador: Separador;
  onMudarSeparador: (separador: Separador) => void;
  onSair: () => void;
};

/**
 * Esta barra faz as vezes da moldura da janela (que está desligada no
 * tauri.conf.json). As zonas sem botões arrastam a janela; duplo clique maximiza.
 */
export default function TopNav({ separador, onMudarSeparador, onSair }: Props) {
  return (
    <header className="topnav">
      <div className="marca" data-tauri-drag-region>
        <span className="flor" aria-hidden="true" data-tauri-drag-region>
          ❀
        </span>
        <span data-tauri-drag-region>Flor de Lotus</span>
      </div>

      <nav className="topnav-links">
        {SEPARADORES.map((item) => (
          <button
            key={item.chave}
            type="button"
            className={separador === item.chave ? "ativo" : ""}
            onClick={() => onMudarSeparador(item.chave)}
          >
            {item.rotulo}
          </button>
        ))}
      </nav>

      {/* Espaço livre no meio: é por aqui que se pega na janela. */}
      <div className="zona-arrasto" data-tauri-drag-region />

      <BotaoAtualizar />

      <button type="button" className="botao-sair" onClick={onSair}>
        Logout
      </button>

      <BotoesJanela />
    </header>
  );
}
