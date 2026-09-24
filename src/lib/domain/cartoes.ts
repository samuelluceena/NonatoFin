/**
 * Regras de cartão de crédito: faturas e compras parceladas.
 * Documentação: docs/REGRAS-DE-NEGOCIO.md (seção Cartões de crédito).
 *
 *  - A fatura de um mês (competência "AAAA-MM") vence no dia de vencimento do
 *    cartão naquele mês (ou no último dia, se o mês for mais curto).
 *  - O fechamento acontece no mesmo mês do vencimento quando o dia de
 *    fechamento é menor que o de vencimento; senão, no mês anterior.
 *  - Compra feita ANTES do fechamento entra naquela fatura; compra NO DIA do
 *    fechamento ou depois vai para a fatura seguinte.
 *  - O valor total é dividido pelas parcelas; a sobra de centavos vai para a
 *    1ª parcela (R$ 100,00 em 3x = 33,34 + 33,33 + 33,33).
 *  - A mesma divisão é feita no banco (função registrar_compra_cartao) —
 *    equivalência verificada no teste de integração.
 */
import { LIMITES } from '@/lib/config';
import {
  adicionarMesesNaChave,
  chaveDoMes,
  diasNoMes,
  formatarMes,
  montarData,
  type ChaveMes,
  type DataISO,
} from './datas';
import { formatarMoeda, type Centavos } from './dinheiro';

export interface DiasCartao {
  diaFechamento: number;
  diaVencimento: number;
}

export function ehDiaValido(dia: number): boolean {
  return Number.isInteger(dia) && dia >= 1 && dia <= 31;
}

function dataNoMes(mes: ChaveMes, dia: number): DataISO {
  const [ano, m] = mes.split('-').map(Number);
  return montarData(ano, m, Math.min(dia, diasNoMes(ano, m)));
}

/** Vencimento da fatura da competência informada. */
export function vencimentoDaFatura(mes: ChaveMes, diaVencimento: number): DataISO {
  return dataNoMes(mes, diaVencimento);
}

/** Data de fechamento da fatura da competência informada. */
export function fechamentoDaFatura(mes: ChaveMes, dias: DiasCartao): DataISO {
  const mesFechamento = dias.diaFechamento < dias.diaVencimento ? mes : adicionarMesesNaChave(mes, -1);
  return dataNoMes(mesFechamento, dias.diaFechamento);
}

/** Primeira fatura em que entra uma compra feita na data informada. */
export function faturaDaCompra(dataCompra: DataISO, dias: DiasCartao): ChaveMes {
  let mes = adicionarMesesNaChave(chaveDoMes(dataCompra), -1);
  for (let i = 0; i < 4; i++) {
    if (fechamentoDaFatura(mes, dias) > dataCompra) return mes;
    mes = adicionarMesesNaChave(mes, 1);
  }
  return mes;
}

export function validarParcelas(quantidade: number): boolean {
  return Number.isInteger(quantidade) && quantidade >= 1 && quantidade <= LIMITES.parcelasCartaoMax;
}

/** Divide o total em parcelas inteiras; a sobra de centavos vai para a 1ª. */
export function dividirEmParcelas(total: Centavos, quantidade: number): Centavos[] {
  if (!validarParcelas(quantidade)) throw new Error('Quantidade de parcelas inválida.');
  if (!Number.isSafeInteger(total) || total < quantidade) throw new Error('Valor total insuficiente para as parcelas.');
  const base = Math.floor(total / quantidade);
  const sobra = total - base * quantidade;
  return Array.from({ length: quantidade }, (_, i) => (i === 0 ? base + sobra : base));
}

export interface ParcelaPlanejada {
  numero: number;
  total: number;
  valorCentavos: Centavos;
  faturaMes: ChaveMes;
}

export function planejarParcelas(total: Centavos, quantidade: number, primeiraFatura: ChaveMes): ParcelaPlanejada[] {
  return dividirEmParcelas(total, quantidade).map((valor, i) => ({
    numero: i + 1,
    total: quantidade,
    valorCentavos: valor,
    faturaMes: adicionarMesesNaChave(primeiraFatura, i),
  }));
}

/** "3x: 1ª de R$ 33,34 e 2 de R$ 33,33" */
export function resumoParcelas(total: Centavos, quantidade: number): string {
  const valores = dividirEmParcelas(total, quantidade);
  if (quantidade === 1) return `À vista: ${formatarMoeda(total)}`;
  if (valores[0] === valores[1]) return `${quantidade}x de ${formatarMoeda(valores[1])}`;
  return `${quantidade}x: 1ª de ${formatarMoeda(valores[0])} e ${quantidade - 1} de ${formatarMoeda(valores[1])}`;
}

/** Descrição da fatura como lançamento a pagar. */
export function descricaoFatura(nomeCartao: string, mes: ChaveMes): string {
  return `Fatura ${nomeCartao} — ${formatarMes(mes)}`;
}

/** Próximas N competências a partir de uma (para escolher a 1ª fatura). */
export function proximasCompetencias(inicio: ChaveMes, quantidade: number): ChaveMes[] {
  return Array.from({ length: quantidade }, (_, i) => adicionarMesesNaChave(inicio, i));
}
