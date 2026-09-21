import { dataPorExtenso } from "./datas";
import type { Agendamento, Funcionario, Servico } from "./types";

/**
 * Põe um número português em formato internacional só com dígitos, como o
 * WhatsApp exige (351912345678). Devolve null se não der para aproveitar.
 */
export const telefoneInternacional = (telefone: string): string | null => {
  const digitos = telefone.replace(/\D/g, "");
  if (!digitos) return null;

  if (digitos.startsWith("351")) return digitos.length === 12 ? digitos : null;
  if (digitos.startsWith("00351")) return digitos.slice(2);
  // Número nacional de 9 dígitos: assume-se Portugal.
  if (digitos.length === 9) return `351${digitos}`;

  return digitos.length >= 11 ? digitos : null;
};

export const linkWhatsApp = (telefone: string, mensagem: string) => {
  const numero = telefoneInternacional(telefone);
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
};

const eIPhone = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/** Abre as Mensagens do telemóvel com o texto escrito (vai pelo tarifário do telemóvel). */
export const linkSms = (telefone: string, mensagem: string) => {
  const numero = telefoneInternacional(telefone);
  if (!numero) return null;
  // O iPhone quer "&body=", o Android "?body=".
  const separador = eIPhone() ? "&" : "?";
  return `sms:+${numero}${separador}body=${encodeURIComponent(mensagem)}`;
};

/**
 * Uma visita: tudo o que um cliente tem marcado num dia. Quem faz corte e madeixas
 * tem duas marcações seguidas, mas deve receber um só lembrete.
 */
export type Visita = {
  chave: string;
  cliente: string;
  telefone: string;
  data: string;
  /** Hora da primeira marcação do dia */
  inicio: string;
  marcacoes: Agendamento[];
  /** Só conta como avisada quando todas as marcações da visita estão avisadas. */
  avisada: boolean;
};

export const agruparEmVisitas = (marcacoes: Agendamento[]): Visita[] => {
  const porChave = new Map<string, Agendamento[]>();
  const ordenadas = [...marcacoes].sort((a, b) => a.inicioMs - b.inicioMs);

  for (const marcacao of ordenadas) {
    const quem = marcacao.clienteId ?? `${marcacao.cliente}|${marcacao.telefone}`;
    const chave = `${marcacao.data}|${quem}`;
    porChave.set(chave, [...(porChave.get(chave) ?? []), marcacao]);
  }

  return [...porChave.entries()].map(([chave, doCliente]) => ({
    chave,
    cliente: doCliente[0].cliente,
    telefone: doCliente.find((item) => item.telefone)?.telefone ?? "",
    data: doCliente[0].data,
    inicio: doCliente[0].inicio,
    marcacoes: doCliente,
    avisada: doCliente.every((item) => item.lembreteEnviado),
  }));
};

/** "Corte", "Corte e Madeixas", "Corte, Madeixas e Brushing". */
const juntar = (nomes: string[]) => {
  const unicos = [...new Set(nomes)];
  if (unicos.length <= 1) return unicos[0] ?? "";
  return `${unicos.slice(0, -1).join(", ")} e ${unicos[unicos.length - 1]}`;
};

export const nomesDosServicos = (visita: Visita, servicos: Servico[]) =>
  juntar(
    visita.marcacoes.map(
      (item) => servicos.find((servico) => servico.id === item.servicoId)?.nome ?? "serviço",
    ),
  );

/** Substitui os campos entre chavetas pelos dados da visita. */
export const escreverMensagem = (
  modelo: string,
  visita: Visita,
  servicos: Servico[],
  funcionarios: Funcionario[],
) => {
  const funcionarias = juntar(
    visita.marcacoes
      .map((item) => funcionarios.find((pessoa) => pessoa.id === item.funcionarioId)?.nome)
      .filter((nome): nome is string => Boolean(nome)),
  );

  const valores: Record<string, string> = {
    cliente: visita.cliente.split(" ")[0] ?? visita.cliente,
    nome: visita.cliente,
    // "terça-feira, 23 de setembro": a meio da frase, sem maiúscula.
    dia: dataPorExtenso(visita.data).replace(/^./, (letra) => letra.toLowerCase()),
    data: visita.data.split("-").reverse().join("/"),
    hora: visita.inicio,
    servico: nomesDosServicos(visita, servicos) || "serviço",
    funcionaria: funcionarias || "a nossa equipa",
  };

  return modelo.replace(/\{(\w+)\}/g, (original, campo: string) =>
    campo in valores ? valores[campo] : original,
  );
};
