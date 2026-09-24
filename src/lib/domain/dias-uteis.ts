/**
 * Dias úteis bancários: segunda a sexta, exceto feriados.
 * Regras: docs/REGRAS-DE-NEGOCIO.md (seção "Fechar o dia").
 *
 * Feriados nacionais sem expediente bancário (calendário FEBRABAN):
 *  - fixos: 01/01, 21/04, 01/05, 07/09, 12/10, 02/11, 15/11, 20/11, 25/12;
 *  - móveis (pela Páscoa): Carnaval (segunda e terça), Sexta-feira Santa e
 *    Corpus Christi.
 * Feriados da cidade/estado: FERIADOS_LOCAIS em lib/config.ts.
 */
import { FERIADOS_LOCAIS } from '@/lib/config';
import { adicionarDias, diaDaSemana, montarData, partesDaData, type DataISO } from './datas';

const FIXOS_NACIONAIS: Record<string, string> = {
  '01-01': 'Confraternização Universal',
  '04-21': 'Tiradentes',
  '05-01': 'Dia do Trabalho',
  '09-07': 'Independência',
  '10-12': 'Nossa Senhora Aparecida',
  '11-02': 'Finados',
  '11-15': 'Proclamação da República',
  '11-20': 'Consciência Negra',
  '12-25': 'Natal',
};

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano). */
export function pascoa(ano: number): DataISO {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return montarData(ano, mes, dia);
}

/** Feriados nacionais móveis do ano: data → nome. */
function moveis(ano: number): Map<DataISO, string> {
  const p = pascoa(ano);
  return new Map([
    [adicionarDias(p, -48), 'Carnaval'],
    [adicionarDias(p, -47), 'Carnaval'],
    [adicionarDias(p, -2), 'Sexta-feira Santa'],
    [adicionarDias(p, 60), 'Corpus Christi'],
  ]);
}

/** Nome do feriado (nacional ou local) na data, ou null. */
export function feriadoEm(data: DataISO, locais: readonly string[] = FERIADOS_LOCAIS): string | null {
  const mesDia = data.slice(5);
  if (FIXOS_NACIONAIS[mesDia]) return FIXOS_NACIONAIS[mesDia];
  const movel = moveis(partesDaData(data).ano).get(data);
  if (movel) return movel;
  if (locais.includes(mesDia) || locais.includes(data)) return 'Feriado local';
  return null;
}

export function ehFimDeSemana(data: DataISO): boolean {
  const d = diaDaSemana(data);
  return d === 0 || d === 6;
}

export function ehDiaUtil(data: DataISO, locais: readonly string[] = FERIADOS_LOCAIS): boolean {
  return !ehFimDeSemana(data) && feriadoEm(data, locais) === null;
}

/** Primeiro dia útil DEPOIS de `data`. */
export function proximoDiaUtil(data: DataISO, locais: readonly string[] = FERIADOS_LOCAIS): DataISO {
  let d = adicionarDias(data, 1);
  // Nunca há mais que alguns dias seguidos sem expediente; o limite só evita laço infinito.
  for (let i = 0; i < 30 && !ehDiaUtil(d, locais); i++) d = adicionarDias(d, 1);
  return d;
}
