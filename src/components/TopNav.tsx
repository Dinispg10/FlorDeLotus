import BotaoAtualizar from "./BotaoAtualizar";
import BotoesJanela from "./BotoesJanela";

export type Separador = "agenda" | "clientes" | "lembretes" | "estatisticas" | "definicoes";

const SEPARADORES: { chave: Separador; rotulo: string }[] = [
  { chave: "agenda", rotulo: "Agenda" },
  { chave: "clientes", rotulo: "Clientes" },
  { chave: "lembretes", rotulo: "Lembretes" },
  { chave: "estatisticas", rotulo: "Estatísticas" },
  { chave: "definicoes", rotulo: "Definições" },
];

/** Separadores que só a gerente vê (a base de dados também só a deixa a ela mexer). */
const SO_GERENTE: Separador[] = ["estatisticas"];

export const separadoresPara = (eGerente: boolean) =>
  SEPARADORES.filter((item) => eGerente || !SO_GERENTE.includes(item.chave));

type Props = {
  separador: Separador;
  eGerente: boolean;
  onMudarSeparador: (separador: Separador) => void;
  onSair: () => void;
};

/**
 * Esta barra faz as vezes da moldura da janela (que está desligada no
 * tauri.conf.json). As zonas sem botões arrastam a janela; duplo clique maximiza.
 */
export default function TopNav({ separador, eGerente, onMudarSeparador, onSair }: Props) {
  return (
    <header className="topnav">
      <div className="marca" data-tauri-drag-region>
        <span className="flor" aria-hidden="true" data-tauri-drag-region>
          ❀
        </span>
        <span data-tauri-drag-region>Flor de Lotus</span>
      </div>

      <nav className="topnav-links">
        {separadoresPara(eGerente).map((item) => (
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

/**
 * No telemóvel a navegação vive no fundo do ecrã. É a última peça da app (não fica
 * "pregada" com position: fixed), para o teclado não a tirar do sítio.
 */
export function NavegacaoFundo({
  separador,
  eGerente,
  onMudarSeparador,
}: Pick<Props, "separador" | "eGerente" | "onMudarSeparador">) {
  const separadores = separadoresPara(eGerente);
  return (
    <nav
      className="navegacao-fundo"
      style={{ gridTemplateColumns: `repeat(${separadores.length}, 1fr)` }}
    >
      {separadores.map((item) => (
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
  );
}
