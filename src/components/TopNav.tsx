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
  /** Quem está com a sessão aberta neste aparelho. */
  email: string;
  onMudarSeparador: (separador: Separador) => void;
  onSair: () => void;
};

/**
 * Esta barra faz as vezes da moldura da janela (que está desligada no
 * tauri.conf.json). As zonas sem botões arrastam a janela; duplo clique maximiza.
 */
export default function TopNav({ separador, eGerente, email, onMudarSeparador, onSair }: Props) {
  // "maria.silva@..." → "maria.silva"; é o que chega para saber quem está a usar.
  const quem = email.split("@")[0] || email;

  return (
    <header className="topnav">
      <div className="marca" data-tauri-drag-region>
        <svg className="flor" viewBox="-200 -200 400 400" aria-hidden="true">
          {[-74, -37, 0, 37, 74].map((angulo) => (
            <path
              key={angulo}
              d="M0 0 C -46 -48 -46 -128 0 -172 C 46 -128 46 -48 0 0 Z"
              transform={`rotate(${angulo}) scale(${
                Math.abs(angulo) === 74 ? 0.78 : Math.abs(angulo) === 37 ? 0.92 : 1
              })`}
            />
          ))}
        </svg>
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

      <div className="quem-entrou" title={`Sessão aberta como ${email}`}>
        <span className="inicial-conta" aria-hidden="true">
          {quem.charAt(0).toUpperCase()}
        </span>
        <span className="nome-conta">{quem}</span>
      </div>

      <button type="button" className="botao-sair" onClick={onSair}>
        Sair
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
