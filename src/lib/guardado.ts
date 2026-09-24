/**
 * Uma cópia dos dados do salão no próprio aparelho, para a app continuar a mostrar a
 * agenda quando a internet cai. Só serve para ver: guardar continua a precisar de rede.
 *
 * Fica no armazenamento do navegador (localStorage), que é por aparelho e por conta do
 * sistema. Se não der para escrever (janela anónima, espaço cheio), a app funciona na
 * mesma, só fica sem esta rede de segurança.
 */

const PREFIXO = "flordelotus.guardado.";

type Envelope<T> = { quando: string; dados: T };

export const guardar = <T>(chave: string, dados: T) => {
  try {
    const envelope: Envelope<T> = { quando: new Date().toISOString(), dados };
    localStorage.setItem(PREFIXO + chave, JSON.stringify(envelope));
  } catch {
    // Sem espaço ou sem permissão: a app continua, apenas sem cópia local.
  }
};

export const ler = <T>(chave: string): Envelope<T> | null => {
  try {
    const texto = localStorage.getItem(PREFIXO + chave);
    if (!texto) return null;
    const envelope = JSON.parse(texto) as Envelope<T>;
    return envelope?.dados === undefined ? null : envelope;
  } catch {
    return null;
  }
};

/** Ao sair da conta, não deixar os dados do salão no aparelho. */
export const esquecerTudo = () => {
  try {
    const nossas: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const chave = localStorage.key(i);
      if (chave?.startsWith(PREFIXO)) nossas.push(chave);
    }
    nossas.forEach((chave) => localStorage.removeItem(chave));
  } catch {
    // paciência
  }
};

/** É uma falha de rede (e não um erro do servidor ou das regras de acesso)? */
export const pareceFaltaDeRede = (erro: unknown) => {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const mensagem = erro instanceof Error ? erro.message.toLowerCase() : "";
  return (
    mensagem.includes("sem ligação") ||
    mensagem.includes("failed to fetch") ||
    mensagem.includes("networkerror") ||
    mensagem.includes("load failed")
  );
};
