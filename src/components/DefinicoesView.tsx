import type { Configuracoes, Funcionario, Servico } from "../lib/types";
import HorarioView from "./HorarioView";
import FuncionariasView from "./FuncionariasView";
import ServicosView from "./ServicosView";

export type SeccaoDefinicoes = "horario" | "funcionarias" | "servicos";

const SECCOES: { chave: SeccaoDefinicoes; rotulo: string }[] = [
  { chave: "horario", rotulo: "Horário" },
  { chave: "funcionarias", rotulo: "Funcionárias" },
  { chave: "servicos", rotulo: "Serviços" },
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
}: Props) {
  return (
    <section className="pagina-lista">
      <nav className="sub-abas">
        {SECCOES.map((item) => (
          <button
            key={item.chave}
            type="button"
            className={seccao === item.chave ? "ativo" : ""}
            onClick={() => onMudarSeccao(item.chave)}
          >
            {item.rotulo}
          </button>
        ))}
      </nav>

      {seccao === "horario" ? (
        <HorarioView
          configuracoes={configuracoes}
          onGuardado={onHorarioGuardado}
          onErro={onErro}
          onAviso={onAviso}
        />
      ) : seccao === "funcionarias" ? (
        <FuncionariasView
          funcionarios={funcionarios}
          onFuncionariosAlterados={onFuncionariosAlterados}
          onAusenciasAlteradas={onAusenciasAlteradas}
          onErro={onErro}
          onAviso={onAviso}
        />
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
