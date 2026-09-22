import { useEffect, useMemo, useRef, useState } from "react";
import * as api from "../lib/api";
import { normalizarTelefone, normalizarTexto } from "../lib/agenda";
import { abreviaturaDiaSemana, dataCompacta, hoje } from "../lib/datas";
import type { Agendamento, Cliente, Funcionario, Servico } from "../lib/types";

type Props = {
  clientes: Cliente[];
  funcionarios: Funcionario[];
  servicos: Servico[];
  /** Ir para o dia da marcação e abri-la. */
  onEscolher: (marcacao: Agendamento) => void;
};

const MAX_CLIENTES = 8;
const MAX_MARCACOES = 3;

/** Clientes cujo nome (sem acentos) ou telefone batem com o que se escreveu. */
const procurarClientes = (clientes: Cliente[], texto: string) => {
  const procura = normalizarTexto(texto);
  const digitos = normalizarTelefone(texto);
  if (procura.length < 2 && digitos.length < 3) return [];

  return clientes
    .map((cliente) => {
      const nome = normalizarTexto(cliente.nome);
      const porTelefone = digitos.length >= 3 && normalizarTelefone(cliente.telefone).includes(digitos);
      // Quem começa pelo que se escreveu (no nome ou num apelido) aparece primeiro.
      const noInicio = nome.startsWith(procura) || nome.includes(` ${procura}`);
      const bate = porTelefone || (procura.length >= 2 && nome.includes(procura));
      return { cliente, bate, noInicio };
    })
    .filter((item) => item.bate)
    .sort(
      (a, b) =>
        Number(b.noInicio) - Number(a.noInicio) || a.cliente.nome.localeCompare(b.cliente.nome, "pt"),
    )
    .slice(0, MAX_CLIENTES)
    .map((item) => item.cliente);
};

/**
 * Procurar um cliente a partir da agenda e ver logo as próximas marcações dele,
 * sem ir à ficha. Abre também com Ctrl+F.
 */
export default function PesquisaMarcacoes({ clientes, funcionarios, servicos, onEscolher }: Props) {
  const [aberta, setAberta] = useState(false);
  const [texto, setTexto] = useState("");
  const [marcacoes, setMarcacoes] = useState<Agendamento[]>([]);
  const [aCarregar, setACarregar] = useState(false);
  const [erro, setErro] = useState("");
  const caixa = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);

  const encontrados = useMemo(() => procurarClientes(clientes, texto), [clientes, texto]);
  const ids = encontrados.map((cliente) => cliente.id).join(",");

  // Espera um instante depois da última tecla antes de perguntar à base de dados.
  useEffect(() => {
    if (!ids) {
      setMarcacoes([]);
      return;
    }
    let ativo = true;
    setACarregar(true);
    const temporizador = window.setTimeout(async () => {
      try {
        const lidas = await api.proximasMarcacoesDe(ids.split(","));
        if (ativo) {
          setMarcacoes(lidas);
          setErro("");
        }
      } catch (causa) {
        if (ativo) setErro(causa instanceof Error ? causa.message : "Não foi possível procurar.");
      } finally {
        if (ativo) setACarregar(false);
      }
    }, 250);
    return () => {
      ativo = false;
      window.clearTimeout(temporizador);
    };
  }, [ids]);

  // Ctrl+F abre; Escape e um clique fora fecham.
  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === "f") {
        evento.preventDefault();
        setAberta(true);
        window.setTimeout(() => campo.current?.select(), 0);
      } else if (evento.key === "Escape" && aberta) {
        setAberta(false);
      }
    };
    const aoClicar = (evento: MouseEvent) => {
      if (aberta && caixa.current && !caixa.current.contains(evento.target as Node)) {
        setAberta(false);
      }
    };
    window.addEventListener("keydown", aoTeclar);
    window.addEventListener("mousedown", aoClicar);
    return () => {
      window.removeEventListener("keydown", aoTeclar);
      window.removeEventListener("mousedown", aoClicar);
    };
  }, [aberta]);

  useEffect(() => {
    if (aberta) campo.current?.focus();
  }, [aberta]);

  const escolher = (marcacao: Agendamento) => {
    setAberta(false);
    onEscolher(marcacao);
  };

  const hojeChave = hoje();
  const procuraCurta = normalizarTexto(texto).length < 2 && normalizarTelefone(texto).length < 3;

  return (
    <div className="pesquisa-marcacoes" ref={caixa}>
      <button
        type="button"
        className={`botao-procurar ${aberta ? "ativo" : ""}`}
        onClick={() => setAberta((atual) => !atual)}
        aria-expanded={aberta}
        title="Procurar um cliente (Ctrl+F)"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16 16l4.5 4.5" />
        </svg>
        <span>Procurar</span>
      </button>

      {aberta ? (
        <div className="painel-pesquisa" role="dialog" aria-label="Procurar cliente">
          <input
            ref={campo}
            type="search"
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            placeholder="Nome ou telefone do cliente"
            aria-label="Nome ou telefone do cliente"
          />

          <div className="resultados-pesquisa">
            {procuraCurta ? (
              <p className="pesquisa-vazia">Escreve pelo menos duas letras do nome, ou três números.</p>
            ) : encontrados.length === 0 ? (
              <p className="pesquisa-vazia">Nenhum cliente com esse nome ou telefone.</p>
            ) : erro ? (
              <p className="pesquisa-vazia erro">{erro}</p>
            ) : (
              encontrados.map((cliente) => {
                const suas = marcacoes.filter((item) => item.clienteId === cliente.id);
                const mostradas = suas.slice(0, MAX_MARCACOES);

                return (
                  <section key={cliente.id} className="resultado-cliente">
                    <header>
                      <strong>{cliente.nome}</strong>
                      {cliente.telefone ? <span>{cliente.telefone}</span> : null}
                    </header>

                    {aCarregar && suas.length === 0 ? (
                      <p className="pesquisa-vazia">A procurar…</p>
                    ) : suas.length === 0 ? (
                      <p className="pesquisa-vazia">Sem marcações por acontecer.</p>
                    ) : (
                      <ul>
                        {mostradas.map((marcacao) => {
                          const funcionaria = funcionarios.find(
                            (pessoa) => pessoa.id === marcacao.funcionarioId,
                          );
                          const servico =
                            servicos.find((item) => item.id === marcacao.servicoId)?.nome ||
                            marcacao.servicoNome ||
                            "Serviço";
                          return (
                            <li key={marcacao.id}>
                              <button type="button" onClick={() => escolher(marcacao)}>
                                <span className="pesquisa-quando">
                                  {marcacao.data === hojeChave
                                    ? "Hoje"
                                    : `${abreviaturaDiaSemana(marcacao.data)}, ${dataCompacta(marcacao.data)}`}
                                  <em>{marcacao.inicio}</em>
                                </span>
                                <span className="pesquisa-o-que">
                                  {servico}
                                  {funcionaria ? (
                                    <em>
                                      <span
                                        className="ponto-cor"
                                        style={{ background: funcionaria.cor }}
                                      />
                                      {funcionaria.nome}
                                    </em>
                                  ) : null}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                        {suas.length > MAX_MARCACOES ? (
                          <li className="pesquisa-mais">
                            e mais {suas.length - MAX_MARCACOES}{" "}
                            {suas.length - MAX_MARCACOES === 1 ? "marcação" : "marcações"}
                          </li>
                        ) : null}
                      </ul>
                    )}
                  </section>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
