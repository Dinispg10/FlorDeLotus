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

/**
 * Fim do mundo à espera. Uma semana de agenda leva menos de um segundo numa rede
 * normal; 5 segundos dão folga para uma rede fraca sem deixar ninguém a olhar para o
 * ecrã sem saber o que se passa.
 */
export const LIMITE_MS = 5000;

/**
 * Uma rede má (Wi-Fi ligado mas sem internet) não dá erro: fica à espera para sempre.
 * Isto desiste ao fim de algum tempo, para a app poder mostrar o que tem guardado em
 * vez de ficar em "A carregar...".
 */
export const comTempoLimite = <T>(promessa: Promise<T>, limiteMs = LIMITE_MS): Promise<T> =>
  new Promise((resolver, rejeitar) => {
    const relogio = setTimeout(
      () => rejeitar(new Error("Sem ligação ao servidor. Verifica a internet e tenta outra vez.")),
      limiteMs,
    );
    promessa.then(
      (valor) => {
        clearTimeout(relogio);
        resolver(valor);
      },
      (erro) => {
        clearTimeout(relogio);
        rejeitar(erro);
      },
    );
  });

/** O que se mostra quando um dado secundário não veio por falta de rede. */
export const SEM_REDE = "Sem internet. Isto aparece assim que a ligação voltar.";

/**
 * A mensagem a mostrar a quem está ao balcão: se foi da rede, um aviso calmo; se foi
 * outra coisa (permissões, dados), o erro verdadeiro, que é o que ajuda a resolver.
 */
export const mensagemDeFalha = (causa: unknown, seNaoForRede: string) => {
  if (pareceFaltaDeRede(causa)) return SEM_REDE;
  return causa instanceof Error ? causa.message : seNaoForRede;
};
