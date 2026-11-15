/**
 * O que vinha no endereço quando a app abriu, por causa de um link do email.
 *
 * O link de "esqueci-me da palavra-passe" traz a conta no próprio endereço, com uma
 * marca a dizer ao que vem (`type=recovery`); quando já não serve, traz o motivo.
 * Tem de se ler isto **antes** de o Supabase arrancar: assim que ele trata do link,
 * limpa o endereço, e depois não há como saber donde se veio.
 */
export type MarcaDoLink = {
  /** Veio-se escolher uma palavra-passe nova. */
  recuperacao: boolean;
  /** O link não serviu; o que dizer a quem está à espera. "" quando correu bem. */
  problema: string;
};

export const SEM_MARCA: MarcaDoLink = { recuperacao: false, problema: "" };

export const lerMarcaDoLink = (hash: string, procura: string): MarcaDoLink => {
  const endereco = `${hash}${procura}`;

  if (/type=recovery/.test(endereco)) return { recuperacao: true, problema: "" };
  if (!/error/.test(endereco)) return SEM_MARCA;

  return {
    recuperacao: false,
    problema: /expired|invalid/.test(endereco)
      ? "Esse link já não serve (passou do tempo ou já foi usado). Pede outro aqui em baixo."
      : "Não foi possível abrir esse link. Pede outro aqui em baixo.",
  };
};
