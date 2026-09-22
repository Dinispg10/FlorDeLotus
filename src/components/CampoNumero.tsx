import { useEffect, useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number;
  onChange: (valor: number) => void;
  /** Preços: aceita vírgula (12,50) e mostra o teclado com casas decimais. */
  decimal?: boolean;
};

const paraTexto = (valor: number) => (Number.isFinite(valor) ? String(valor) : "");

/**
 * Campo de número que se deixa apagar: enquanto se escreve pode ficar vazio (sem
 * saltar para 0 e acabar em "0200"). Só avisa quando o que lá está é um número; ao
 * sair vazio, volta ao último valor válido.
 */
export default function CampoNumero({ value, onChange, decimal = false, onBlur, ...resto }: Props) {
  const [texto, setTexto] = useState(() => paraTexto(value));

  // Quando o valor muda por fora (ex.: escolher outro serviço muda a duração).
  useEffect(() => {
    setTexto((atual) => (Number(atual.replace(",", ".")) === value ? atual : paraTexto(value)));
  }, [value]);

  return (
    <input
      {...resto}
      type="text"
      inputMode={decimal ? "decimal" : "numeric"}
      value={texto}
      onChange={(evento) => {
        const novo = evento.target.value.replace(decimal ? /[^\d.,]/g : /\D/g, "");
        setTexto(novo);
        const numero = Number(novo.replace(",", "."));
        if (novo !== "" && Number.isFinite(numero)) onChange(numero);
      }}
      onBlur={(evento) => {
        if (texto.trim() === "") setTexto(paraTexto(value));
        onBlur?.(evento);
      }}
    />
  );
}
