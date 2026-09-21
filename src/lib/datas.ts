/** Helpers de data/hora. Tudo o que o utilizador vê está em hora local do salão. */

const pad = (valor: number) => String(valor).padStart(2, "0");

/** Data local no formato AAAA-MM-DD (nunca usar toISOString: isso converte para UTC). */
export const chaveData = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const horaLocal = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

export const hoje = () => chaveData(new Date());

/** Combina "2026-09-21" + "14:30" numa Date em hora local. */
export const combinarDataHora = (data: string, hora: string) => {
  const [ano, mes, dia] = data.split("-").map(Number);
  const [h, m] = hora.split(":").map(Number);
  return new Date(ano, mes - 1, dia, h, m, 0, 0);
};

export const somarDias = (data: string, dias: number) => {
  const [ano, mes, dia] = data.split("-").map(Number);
  const date = new Date(ano, mes - 1, dia);
  date.setDate(date.getDate() + dias);
  return chaveData(date);
};

/** Segunda-feira da semana a que a data pertence. */
export const inicioDaSemana = (data: string) => {
  const [ano, mes, dia] = data.split("-").map(Number);
  const date = new Date(ano, mes - 1, dia);
  const diaSemana = (date.getDay() + 6) % 7; // 0 = segunda
  date.setDate(date.getDate() - diaSemana);
  return chaveData(date);
};

/** 1 = segunda, ... 7 = domingo. */
export const diaDaSemanaISO = (data: string) => {
  const [ano, mes, dia] = data.split("-").map(Number);
  const indice = new Date(ano, mes - 1, dia).getDay();
  return (indice === 0 ? 7 : indice) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
};

export const somarMinutos = (hora: string, minutos: number) => {
  const [h, m] = hora.split(":").map(Number);
  const total = h * 60 + m + minutos;
  const totalNormalizado = ((total % 1440) + 1440) % 1440;
  return `${pad(Math.floor(totalNormalizado / 60))}:${pad(totalNormalizado % 60)}`;
};

export const minutosDesdeMeiaNoite = (hora: string) => {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
};

const formatadorExtenso = new Intl.DateTimeFormat("pt-PT", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

export const dataPorExtenso = (data: string) => {
  const [ano, mes, dia] = data.split("-").map(Number);
  const texto = formatadorExtenso.format(new Date(ano, mes - 1, dia));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

const formatadorCurto = new Intl.DateTimeFormat("pt-PT", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
});

export const dataCurta = (data: string) => {
  const [ano, mes, dia] = data.split("-").map(Number);
  return formatadorCurto.format(new Date(ano, mes - 1, dia));
};

const formatadorMes = new Intl.DateTimeFormat("pt-PT", { month: "short" });

const paraDate = (data: string) => {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
};

const ABREVIATURAS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

/**
 * "SEG", "TER", ... Em português de Portugal a abreviatura oficial é o nome sem
 * "-feira" ("segunda"), comprida demais para cabeçalhos; daí a lista fixa.
 */
export const abreviaturaDiaSemana = (data: string) => ABREVIATURAS[paraDate(data).getDay()];

export const numeroDoDia = (data: string) => String(Number(data.slice(8, 10)));

/** "21 SET." para o cabeçalho da agenda. */
export const dataCompacta = (data: string) =>
  `${numeroDoDia(data)} ${formatadorMes.format(paraDate(data)).replace(".", "").toUpperCase()}`;

/** Primeiro dia do mês da data, "2026-09-01". */
export const inicioDoMes = (data: string) => `${data.slice(0, 7)}-01`;

/** Último dia do mês da data, "2026-09-30". */
export const fimDoMes = (data: string) => {
  const [ano, mes] = data.split("-").map(Number);
  return chaveData(new Date(ano, mes, 0));
};

/** Dia 1 do mês a `meses` de distância (negativo para trás). */
export const somarMeses = (data: string, meses: number) => {
  const [ano, mes] = data.split("-").map(Number);
  return chaveData(new Date(ano, mes - 1 + meses, 1));
};

const formatadorMesAno = new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric" });

/** "Setembro de 2026". */
export const mesPorExtenso = (data: string) => {
  const texto = formatadorMesAno.format(paraDate(data));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

export const formatarPreco = (valor: number) =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(valor);

/** Lista de horas cheias entre o início e o fim do dia, ex. ["09:00", "10:00", ...]. */
export const gerarHoras = (inicio: string, fim: string) => {
  const primeira = Math.floor(minutosDesdeMeiaNoite(inicio) / 60);
  const ultima = Math.ceil(minutosDesdeMeiaNoite(fim) / 60);
  const horas: string[] = [];
  for (let h = primeira; h < Math.max(ultima, primeira + 1); h += 1) {
    horas.push(`${pad(h)}:00`);
  }
  return horas;
};
