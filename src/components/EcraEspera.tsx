type Props = {
  /** O que se está a fazer, em linguagem de quem está ao balcão. */
  texto?: string;
  /** Dentro de um cartão ou de uma janela, em vez de ocupar o ecrã todo. */
  pequeno?: boolean;
};

/**
 * Ecrã de espera, igual em toda a app: a flor a rodar devagar e uma frase. Usa-se ao
 * entrar, ao carregar a agenda, as estatísticas, os lembretes e as fichas.
 */
export default function EcraEspera({ texto = "A carregar...", pequeno = false }: Props) {
  return (
    <div className={pequeno ? "espera pequena" : "espera"} role="status" aria-live="polite">
      <svg className="espera-flor" viewBox="-200 -200 400 400" aria-hidden="true">
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
      <p>{texto}</p>
    </div>
  );
}
