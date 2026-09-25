import type { ReactNode } from "react";

type Props = {
  /** A frase principal, curta. */
  titulo: string;
  /** O que fazer a seguir, se houver alguma coisa a fazer. */
  ajuda?: string;
  /** Um botão para a ação óbvia (criar o primeiro serviço, por exemplo). */
  acao?: ReactNode;
};

/**
 * O que se mostra quando uma lista está vazia. Em vez de um traço ou de uma frase
 * seca, a flor da casa e uma indicação do que fazer a seguir.
 */
export default function EstadoVazio({ titulo, ajuda, acao }: Props) {
  return (
    <div className="estado-vazio">
      <svg className="flor-vazia" viewBox="-200 -200 400 400" aria-hidden="true">
        {[-74, -37, 0, 37, 74].map((angulo) => (
          <path
            key={angulo}
            d="M0 0 C -46 -48 -46 -128 0 -172 C 46 -128 46 -48 0 0 Z"
            transform={`rotate(${angulo}) scale(${
              Math.abs(angulo) === 74 ? 0.78 : Math.abs(angulo) === 37 ? 0.92 : 1
            })`}
          />
        ))}
      </svg>
      <strong>{titulo}</strong>
      {ajuda ? <span>{ajuda}</span> : null}
      {acao}
    </div>
  );
}
