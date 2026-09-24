/**
 * Utilidades de DATA (sem hora) no formato ISO "AAAA-MM-DD".
 *
 * Regra de ouro: vencimento é uma DATA, não um instante. Nunca converta uma
 * DataISO para `new Date(...)` local — isso causa o erro clássico de o dia 15
 * virar dia 14 por causa do fuso. Toda aritmética aqui usa Date.UTC, que não
 * sofre fuso nem horário de verão.
 */
import { APP } from '@/lib/config';

/** Data no formato "AAAA-MM-DD". */
export type DataISO = string;

const REGEX_DATA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export const NOMES_MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const;

export const NOMES_DIAS_SEMANA = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
] as const;

interface PartesData {
  ano: number;
  mes: number; // 1-12
  dia: number; // 1-31
}

const doisDigitos = (n: number) => String(n).padStart(2, '0');

export function diasNoMes(ano: number, mes: number): number {
  // Dia 0 do mês seguinte = último dia do mês informado.
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

export function ehDataISOValida(valor: unknown): valor is DataISO {
  if (typeof valor !== 'string') return false;
  const m = REGEX_DATA_ISO.exec(valor);
  if (!m) return false;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  return mes >= 1 && mes <= 12 && dia >= 1 && dia <= diasNoMes(ano, mes);
}

export function partesDaData(data: DataISO): PartesData {
  if (!ehDataISOValida(data)) throw new Error(`Data inválida: ${String(data)}`);
  const [ano, mes, dia] = data.split('-').map(Number);
  return { ano, mes, dia };
}

export function montarData(ano: number, mes: number, dia: number): DataISO {
  return `${String(ano).padStart(4, '0')}-${doisDigitos(mes)}-${doisDigitos(dia)}`;
}

function paraUTC(data: DataISO): number {
  const { ano, mes, dia } = partesDaData(data);
  return Date.UTC(ano, mes - 1, dia);
}

function deUTC(ms: number): DataISO {
  const d = new Date(ms);
  return montarData(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

const MS_POR_DIA = 86_400_000;

/** Data de "hoje" no fuso do NonatoFin (padrão: America/Sao_Paulo). */
export function hojeISO(fuso: string = APP.fusoHorario, agora: Date = new Date()): DataISO {
  return dataNoFuso(agora, fuso);
}

/** Converte um instante (ex.: pago_em) para a data correspondente no fuso. */
export function dataNoFuso(instante: Date | string, fuso: string = APP.fusoHorario): DataISO {
  const d = typeof instante === 'string' ? new Date(instante) : instante;
  // en-CA formata como AAAA-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: fuso,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * Instante (ISO com offset) do início do dia no fuso informado.
 * Usado para filtrar timestamps (pago_em) por data local.
 *   instanteInicioDoDia('2026-09-23') -> '2026-09-23T00:00:00-03:00'
 */
export function instanteInicioDoDia(data: DataISO, fuso: string = APP.fusoHorario): string {
  partesDaData(data); // valida
  const meioDia = new Date(`${data}T12:00:00Z`);
  const nome =
    new Intl.DateTimeFormat('en-US', { timeZone: fuso, timeZoneName: 'longOffset' })
      .formatToParts(meioDia)
      .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  const offset = nome === 'GMT' ? '+00:00' : nome.replace('GMT', '');
  return `${data}T00:00:00${offset}`;
}

/** "2026-08-15" -> "15/08/2026" */
export function formatarData(data: DataISO): string {
  const { ano, mes, dia } = partesDaData(data);
  return `${doisDigitos(dia)}/${doisDigitos(mes)}/${ano}`;
}

/** "2026-08-15" -> "15/08" */
export function formatarDataCurta(data: DataISO): string {
  const { mes, dia } = partesDaData(data);
  return `${doisDigitos(dia)}/${doisDigitos(mes)}`;
}

/** Instante ISO (timestamptz) -> "15/08/2026 às 14:32" no fuso do app. */
export function formatarDataHora(instante: string, fuso: string = APP.fusoHorario): string {
  const d = new Date(instante);
  const data = formatarData(dataNoFuso(d, fuso));
  const hora = new Intl.DateTimeFormat('pt-BR', {
    timeZone: fuso,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
  return `${data} às ${hora}`;
}

/** "15/08/2026" -> "2026-08-15" (ou null se inválida). */
export function converterDataBR(texto: string): DataISO | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim());
  if (!m) return null;
  const iso = montarData(Number(m[3]), Number(m[2]), Number(m[1]));
  return ehDataISOValida(iso) ? iso : null;
}

export function adicionarDias(data: DataISO, dias: number): DataISO {
  return deUTC(paraUTC(data) + dias * MS_POR_DIA);
}

/** Diferença em dias corridos: (b - a). */
export function diferencaEmDias(a: DataISO, b: DataISO): number {
  return Math.round((paraUTC(b) - paraUTC(a)) / MS_POR_DIA);
}

/** 0 = domingo ... 6 = sábado */
export function diaDaSemana(data: DataISO): number {
  return new Date(paraUTC(data)).getUTCDay();
}

export function nomeDiaDaSemana(data: DataISO): string {
  return NOMES_DIAS_SEMANA[diaDaSemana(data)];
}

/** Semana de segunda a domingo (padrão brasileiro/ISO). */
export function inicioDaSemana(data: DataISO): DataISO {
  const dow = diaDaSemana(data);
  const deslocamento = dow === 0 ? -6 : 1 - dow;
  return adicionarDias(data, deslocamento);
}

export function fimDaSemana(data: DataISO): DataISO {
  return adicionarDias(inicioDaSemana(data), 6);
}

export function inicioDoMes(data: DataISO): DataISO {
  const { ano, mes } = partesDaData(data);
  return montarData(ano, mes, 1);
}

export function fimDoMes(data: DataISO): DataISO {
  const { ano, mes } = partesDaData(data);
  return montarData(ano, mes, diasNoMes(ano, mes));
}

/**
 * Soma meses preservando o dia a partir de uma data-âncora.
 * Se o dia não existir no mês de destino, usa o último dia desse mês.
 *   31/01/2027 + 1 -> 28/02/2027
 *   31/01/2027 + 2 -> 31/03/2027  (o dia 31 NÃO se perde)
 * Aceita meses negativos.
 */
export function adicionarMeses(data: DataISO, meses: number): DataISO {
  if (!Number.isInteger(meses)) throw new Error('Quantidade de meses deve ser inteira.');
  const { ano, mes, dia } = partesDaData(data);
  const indiceMes = ano * 12 + (mes - 1) + meses;
  const novoAno = Math.floor(indiceMes / 12);
  const novoMes = (indiceMes % 12) + 1;
  const novoDia = Math.min(dia, diasNoMes(novoAno, novoMes));
  return montarData(novoAno, novoMes, novoDia);
}

// ------------------------------------------------------------------ meses ---

/** Chave de mês "AAAA-MM". */
export type ChaveMes = string;

const REGEX_CHAVE_MES = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function ehChaveMesValida(valor: unknown): valor is ChaveMes {
  return typeof valor === 'string' && REGEX_CHAVE_MES.test(valor);
}

export function chaveDoMes(data: DataISO): ChaveMes {
  return data.slice(0, 7);
}

export function primeiroDiaDaChave(chave: ChaveMes): DataISO {
  return `${chave}-01`;
}

export function ultimoDiaDaChave(chave: ChaveMes): DataISO {
  return fimDoMes(primeiroDiaDaChave(chave));
}

export function adicionarMesesNaChave(chave: ChaveMes, meses: number): ChaveMes {
  return chaveDoMes(adicionarMeses(primeiroDiaDaChave(chave), meses));
}

/** "2026-10" -> "Outubro/2026" */
export function formatarMes(chave: ChaveMes): string {
  const [ano, mes] = chave.split('-').map(Number);
  return `${NOMES_MESES[mes - 1]}/${ano}`;
}

/** "2026-10" -> "Out/26" (para eixos de gráficos) */
export function formatarMesCurto(chave: ChaveMes): string {
  const [ano, mes] = chave.split('-').map(Number);
  return `${NOMES_MESES[mes - 1].slice(0, 3)}/${String(ano).slice(2)}`;
}
