import { useEffect, useState } from "react";

/** Largura abaixo da qual a app muda para o formato de telemóvel. */
export const LARGURA_TELEMOVEL = 700;

/** Diz se o ecrã é de telemóvel, e acompanha quando se roda ou redimensiona. */
export function useEcraPequeno() {
  const consulta = `(max-width: ${LARGURA_TELEMOVEL}px)`;
  const [pequeno, setPequeno] = useState(() => window.matchMedia(consulta).matches);

  useEffect(() => {
    const lista = window.matchMedia(consulta);
    const atualizar = () => setPequeno(lista.matches);
    atualizar();
    lista.addEventListener("change", atualizar);
    return () => lista.removeEventListener("change", atualizar);
  }, [consulta]);

  return pequeno;
}
