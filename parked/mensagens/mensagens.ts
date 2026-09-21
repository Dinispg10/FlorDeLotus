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

/** Substitui os campos entre chavetas pelos dados da marcação. */
export const escreverMensagem = (
  modelo: string,
  marcacao: Agendamento,
  servico: Servico | undefined,
  funcionaria: Funcionario | undefined,
) => {
  const valores: Record<string, string> = {
    cliente: marcacao.cliente.split(" ")[0] ?? marcacao.cliente,
    nome: marcacao.cliente,
    dia: dataPorExtenso(marcacao.data),
    data: marcacao.data.split("-").reverse().join("/"),
    hora: marcacao.inicio,
    servico: servico?.nome ?? "serviço",
    funcionaria: funcionaria?.nome ?? "a nossa equipa",
  };

  return modelo.replace(/\{(\w+)\}/g, (original, campo: string) =>
    campo in valores ? valores[campo] : original,
  );
};

/**
 * Uma SMS só leva 160 caracteres enquanto não tiver acentos; com eles, passa a
 * 70 por mensagem. Serve para avisar quem escreve o texto.
 */
export const contarCaracteres = (mensagem: string) => {
  const temAcentos = /[^\x00-\x7F]/.test(mensagem);
  const limite = temAcentos ? 70 : 160;
  return {
    total: mensagem.length,
    temAcentos,
    limite,
    partes: Math.max(1, Math.ceil(mensagem.length / limite)),
  };
};
