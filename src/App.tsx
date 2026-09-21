import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import "./App.css";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import * as api from "./lib/api";
import { dataPorExtenso, hoje } from "./lib/datas";
import type { Agendamento, Cliente } from "./lib/types";
import { useSalao } from "./hooks/useSalao";
import { useEcraPequeno } from "./hooks/useEcraPequeno";
import Login from "./components/Login";
import TopNav, { NavegacaoFundo, type Separador } from "./components/TopNav";
import AgendaView, { type Vista } from "./components/AgendaView";
import AgendaTelemovel from "./components/AgendaTelemovel";
import AgendamentoModal, { type PreDefinicao } from "./components/AgendamentoModal";
import ConfirmarModal from "./components/ConfirmarModal";
import ClientesView from "./components/ClientesView";
import DefinicoesView, { type SeccaoDefinicoes } from "./components/DefinicoesView";
import EstatisticasView from "./components/EstatisticasView";
import LembretesView from "./components/LembretesView";

type EstadoModal = {
  agendamento: Agendamento | null;
  preDefinicao: PreDefinicao;
};

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [sessaoVerificada, setSessaoVerificada] = useState(false);
  const [separador, setSeparador] = useState<Separador>("agenda");
  const [funcionariaSelecionada, setFuncionariaSelecionada] = useState<string | null>(null);
  const [vista, setVista] = useState<Vista>("dia");
  const [seccaoDefinicoes, setSeccaoDefinicoes] = useState<SeccaoDefinicoes>("horario");
  const [dia, setDia] = useState(hoje());
  const [modal, setModal] = useState<EstadoModal | null>(null);
  const [aviso, setAviso] = useState("");
  const [aCancelar, setACancelar] = useState<Agendamento | null>(null);
  const [aCancelarProcessar, setACancelarProcessar] = useState(false);

  const salao = useSalao(Boolean(session), dia);
  const telemovel = useEcraPequeno();

  useEffect(() => {
    if (!supabase) {
      setSessaoVerificada(true);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessaoVerificada(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_evento, proximaSessao) => {
      setSession(proximaSessao);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!aviso) return;
    const temporizador = window.setTimeout(() => setAviso(""), 3500);
    return () => window.clearTimeout(temporizador);
  }, [aviso]);

  const abrirNovo = useCallback(
    (pre: PreDefinicao) => setModal({ agendamento: null, preDefinicao: pre }),
    [],
  );

  const abrirExistente = useCallback(
    (agendamento: Agendamento) =>
      setModal({ agendamento, preDefinicao: { data: agendamento.data } }),
    [],
  );

  /** Filtrar por funcionária não mexe na vista: quem escolheu dia ou semana fica nela. */
  const escolherFuncionaria = useCallback((funcionariaId: string | null) => {
    setFuncionariaSelecionada(funcionariaId);
  }, []);

  const abrirMarcacaoDoCliente = useCallback(
    (agendamento: Agendamento) => {
      setDia(agendamento.data);
      setSeparador("agenda");
      abrirExistente(agendamento);
    },
    [abrirExistente],
  );

  const aoGuardar = useCallback(
    (agendamentos: Agendamento[], clienteNovo: Cliente | null) => {
      agendamentos.forEach(salao.guardarNaLista);

      if (clienteNovo) {
        salao.setClientes((anteriores) =>
          [...anteriores, clienteNovo].sort((a, b) => a.nome.localeCompare(b.nome, "pt-PT")),
        );
      }

      if (agendamentos[0]) setDia(agendamentos[0].data);
      setModal(null);
      setAviso(
        agendamentos.length > 1
          ? `${agendamentos.length} marcações guardadas.`
          : "Marcação guardada.",
      );
    },
    [salao],
  );

  const aoApagar = useCallback(
    (id: string) => {
      salao.removerDaLista(id);
      setModal(null);
      setAviso("Marcação cancelada.");
    },
    [salao],
  );

  /** Cancelar a partir do ✕ de um bloco: pergunta primeiro, depois tira da agenda. */
  const confirmarCancelamento = useCallback(async () => {
    if (!aCancelar) return;
    setACancelarProcessar(true);
    try {
      await api.apagarAgendamento(aCancelar.id);
      salao.removerDaLista(aCancelar.id);
      setAviso("Marcação cancelada.");
      setACancelar(null);
    } catch (causa) {
      salao.setErro(
        causa instanceof Error ? causa.message : "Não foi possível cancelar a marcação.",
      );
      setACancelar(null);
    } finally {
      setACancelarProcessar(false);
    }
  }, [aCancelar, salao]);

  const sair = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
  };

  if (!isSupabaseConfigured) {
    return (
      <main className="login-shell">
        <div className="login-card">
          <p className="eyebrow">Configuração</p>
          <h1>Supabase não configurado</h1>
          <p className="login-note">
            Copia o ficheiro <code>.env.example</code> para <code>.env</code> e preenche
            VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.
          </p>
        </div>
      </main>
    );
  }

  if (!sessaoVerificada) {
    return (
      <main className="login-shell">
        <div className="login-card">
          <p className="login-note">A ligar ao salão...</p>
        </div>
      </main>
    );
  }

  if (!session) return <Login />;

  // Sem funcionárias ou serviços ativos não há como preencher uma marcação.
  const semFuncionarias = salao.funcionarios.length === 0;
  const semServicos = salao.servicos.filter((item) => item.ativo).length === 0;
  const faltaCatalogo = semFuncionarias || semServicos;

  const motivoBloqueio = semFuncionarias
    ? semServicos
      ? "Para marcar, cria primeiro as funcionárias e os serviços."
      : "Para marcar, cria primeiro as funcionárias."
    : "Para marcar, cria primeiro os serviços.";

  const irParaCatalogo = () => {
    setSeccaoDefinicoes(semFuncionarias ? "funcionarias" : "servicos");
    setSeparador("definicoes");
  };

  return (
    <div className="app-layout">
      <TopNav separador={separador} onMudarSeparador={setSeparador} onSair={sair} />

      <main className={`conteudo ${separador === "agenda" ? "conteudo-agenda" : ""}`}>
        {faltaCatalogo && !salao.aCarregar ? (
          <div className="barra-info">
            <span>{motivoBloqueio}</span>
            <button type="button" onClick={irParaCatalogo}>
              {semFuncionarias ? "Criar funcionárias" : "Criar serviços"}
            </button>
          </div>
        ) : null}

        {salao.aCarregar ? (
          <div className="estado-vazio">A carregar a agenda...</div>
        ) : separador === "agenda" && telemovel ? (
          <AgendaTelemovel
            dia={dia}
            funcionariaSelecionada={funcionariaSelecionada}
            agendamentosDaSemana={salao.agendamentos}
            ausencias={salao.ausencias}
            funcionarios={salao.funcionarios}
            servicos={salao.servicos}
            configuracoes={salao.configuracoes}
            bloqueado={faltaCatalogo}
            motivoBloqueio={motivoBloqueio}
            onMudarDia={setDia}
            onEscolherFuncionaria={escolherFuncionaria}
            onAbrirNovo={abrirNovo}
            onAbrirExistente={abrirExistente}
          />
        ) : separador === "agenda" ? (
          <AgendaView
            dia={dia}
            vista={vista}
            funcionariaSelecionada={funcionariaSelecionada}
            agendamentosDaSemana={salao.agendamentos}
            ausencias={salao.ausencias}
            funcionarios={salao.funcionarios}
            servicos={salao.servicos}
            configuracoes={salao.configuracoes}
            bloqueado={faltaCatalogo}
            motivoBloqueio={motivoBloqueio}
            onMudarDia={setDia}
            onMudarVista={setVista}
            onEscolherFuncionaria={escolherFuncionaria}
            onAbrirNovo={abrirNovo}
            onAbrirExistente={abrirExistente}
            onPedirCancelamento={setACancelar}
          />
        ) : separador === "lembretes" ? (
          <LembretesView
            configuracoes={salao.configuracoes}
            funcionarios={salao.funcionarios}
            servicos={salao.servicos}
            onConfiguracoesAlteradas={salao.recarregarBase}
            onErro={salao.setErro}
            onAviso={setAviso}
          />
        ) : separador === "estatisticas" ? (
          <EstatisticasView
            configuracoes={salao.configuracoes}
            funcionarios={salao.funcionarios}
            servicos={salao.servicos}
            onErro={salao.setErro}
          />
        ) : separador === "clientes" ? (
          <ClientesView
            clientes={salao.clientes}
            agendamentos={salao.agendamentos}
            servicos={salao.servicos}
            funcionarios={salao.funcionarios}
            onClientesAlterados={salao.setClientes}
            onAbrirMarcacao={abrirMarcacaoDoCliente}
            onErro={salao.setErro}
            onAviso={setAviso}
          />
        ) : (
          <DefinicoesView
            seccao={seccaoDefinicoes}
            configuracoes={salao.configuracoes}
            funcionarios={salao.funcionarios}
            servicos={salao.servicos}
            onMudarSeccao={setSeccaoDefinicoes}
            onHorarioGuardado={salao.recarregarBase}
            onFuncionariosAlterados={salao.setFuncionarios}
            onServicosAlterados={salao.setServicos}
            onAusenciasAlteradas={salao.recarregarAgenda}
            onErro={salao.setErro}
            onAviso={setAviso}
          />
        )}
      </main>

      {telemovel ? (
        <NavegacaoFundo separador={separador} onMudarSeparador={setSeparador} />
      ) : null}

      {modal ? (
        <AgendamentoModal
          agendamento={modal.agendamento}
          preDefinicao={modal.preDefinicao}
          funcionarios={salao.funcionarios}
          servicos={salao.servicos}
          clientes={salao.clientes}
          agendamentosDaSemana={salao.agendamentos}
          ausencias={salao.ausencias}
          configuracoes={salao.configuracoes}
          onFechar={() => setModal(null)}
          onGuardado={aoGuardar}
          onApagado={aoApagar}
        />
      ) : null}

      <div className="notificacoes">
        {salao.erro ? (
          <div className="notificacao erro" role="alert">
            <span className="notificacao-icone" aria-hidden="true">!</span>
            <span className="notificacao-texto">{salao.erro}</span>
            {/* Só faz sentido repetir quando o que falhou foi carregar dados. */}
            {/carregar|Sem ligação/.test(salao.erro) ? (
              <button type="button" onClick={() => salao.recarregarAgenda()}>
                Tentar outra vez
              </button>
            ) : null}
            <button type="button" onClick={() => salao.setErro("")} aria-label="Fechar">
              ×
            </button>
          </div>
        ) : null}

        {aviso ? (
          <div className="notificacao sucesso" role="status" key={aviso}>
            <span className="notificacao-icone" aria-hidden="true">✓</span>
            <span className="notificacao-texto">{aviso}</span>
          </div>
        ) : null}
      </div>

      {aCancelar ? (
        <ConfirmarModal
          titulo="Cancelar esta marcação?"
          textoConfirmar="Sim, cancelar"
            textoAProcessar="A cancelar..."
          aProcessar={aCancelarProcessar}
          onConfirmar={confirmarCancelamento}
          onVoltar={() => setACancelar(null)}
        >
          <p>
            <strong>{aCancelar.cliente}</strong>
            <br />
            {dataPorExtenso(aCancelar.data)} às {aCancelar.inicio}
          </p>
          <p>A marcação será removida da agenda e não poderá ser recuperada.</p>
        </ConfirmarModal>
      ) : null}
    </div>
  );
}

export default App;
