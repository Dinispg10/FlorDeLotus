/**
 * Um identificador novo, do lado da app, para a visita que se vai guardar.
 *
 * `crypto.randomUUID` só existe em páginas seguras (https); no telemóvel, quando se
 * abre a app por http para testar, não há. Aí faz-se um à mão, com a mesma forma.
 */
export const novoId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
        (Number(c) ^ (Math.floor(Math.random() * 16) >> (Number(c) / 4))).toString(16),
      );
