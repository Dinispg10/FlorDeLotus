import type { Configuracoes, Funcionario, Servico } from "../lib/types";
import HorarioView from "./HorarioView";
import FuncionariasView from "./FuncionariasView";
import ServicosView from "./ServicosView";
import ContaView from "./ContaView";

export type SeccaoDefinicoes = "horario" | "funcionarias" | "servicos" | "conta";

const SECCOES: { chave: SeccaoDefinicoes; rotulo: string }[] = [
  { chave: "horario", rotulo: "Horário" },
  { chave: "funcionarias", rotulo: "Funcionárias" },
  { chave: "servicos", rotulo: "Serviços" },
  { chave: "conta", rotulo: "Conta" },
];

type Props = {
  seccao: SeccaoDefinicoes;
  configuracoes: Configuracoes;
  funcionarios: Funcionario[];
  servicos: Servico[];
  onMudarSeccao: (seccao: SeccaoDefinicoes) => void;
  onHorarioGuardado: () => void;
  onFuncionariosAlterados: (funcionarios: Funcionario[]) => void;
  onServicosAlterados: (servicos: Servico[]) => void;
  onAusenciasAlteradas: () => void;
  onErro: (mensagem: string) => void;
  onAviso: (mensagem: string) => void;
  email: string;
  eGerente: boolean;
};

/** Tudo o que se configura no salão: horário, quem lá trabalha e o que se faz. */
export default function DefinicoesView({
  seccao,
  configuracoes,
  funcionarios,
  servicos,
  onMudarSeccao,
  onHorarioGuardado,
  onFuncionariosAlterados,
  onServicosAlterados,
  onAusenciasAlteradas,
  onErro,
  onAviso,
  email,
  eGerente,
}: Props) {
  // Horário, funcionárias (com as folgas) e serviços são só da gerente.
  const seccoes = eGerente ? SECCOES : SECCOES.filter((item) => item.chave === "conta");
  const atual = seccoes.some((item) => item.chave === seccao) ? seccao : "conta";

  return (
    <section className="pagina-lista">
      <nav className="sub-abas">
        {seccoes.map((item) => (
          <button
            key={item.chave}
            type="button"
            className={atual === item.chave ? "ativo" : ""}
            onClick={() => onMudarSeccao(item.chave)}
          >
            {item.rotulo}
          </button>
        ))}
      </nav>

      {atual === "horario" ? (
        <HorarioView
          configuracoes={configuracoes}
          onGuardado={onHorarioGuardado}
          onErro={onErro}
          onAviso={onAviso}
        />
      ) : atual === "funcionarias" ? (
        <FuncionariasView
          funcionarios={funcionarios}
          onFuncionariosAlterados={onFuncionariosAlterados}
          onAusenciasAlteradas={onAusenciasAlteradas}
          onErro={onErro}
          onAviso={onAviso}
        />
      ) : atual === "conta" ? (
        <ContaView email={email} onAviso={onAviso} />
      ) : (
        <ServicosView
          servicos={servicos}
          onServicosAlterados={onServicosAlterados}
          onErro={onErro}
          onAviso={onAviso}
        />
      )}
    </section>
  );
}
