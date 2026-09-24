/**
 * Geração de lançamentos em série (vários meses).
 *
 * Regras:
 *  - O valor informado é o valor de CADA lançamento (não é dividido).
 *  - Os vencimentos são calculados SEMPRE a partir do primeiro vencimento
 *    (data-âncora), preservando o dia escolhido: 31/01 -> 28/02 -> 31/03 -> 30/04.
 *  - Por padrão só o 1º lançamento recebe o código de barras (o código
 *    costuma mudar a cada mês). Opcionalmente, todos recebem o mesmo código.
 */
import { LIMITES } from '@/lib/config';
import { adicionarMeses, type DataISO } from './datas';
import { formatarMoeda, multiplicarCentavos, type Centavos } from './dinheiro';

export interface EntradaSerie {
  primeiroVencimento: DataISO;
  quantidade: number;
  valorCentavos: Centavos;
  codigoBarras: string | null;
  mesmoCodigoEmTodos: boolean;
}

export interface LancamentoGerado {
  parcela: number;
  totalParcelas: number;
  vencimento: DataISO;
  valorCentavos: Centavos;
  codigoBarras: string | null;
}

export function validarQuantidadeParcelas(quantidade: number): boolean {
  return (
    Number.isInteger(quantidade) &&
    quantidade >= LIMITES.parcelasMin &&
    quantidade <= LIMITES.parcelasMax
  );
}

/** Lista de vencimentos mensais a partir do primeiro. */
export function gerarVencimentosMensais(primeiro: DataISO, quantidade: number): DataISO[] {
  return Array.from({ length: quantidade }, (_, i) => adicionarMeses(primeiro, i));
}

export function gerarLancamentosSerie(entrada: EntradaSerie): LancamentoGerado[] {
  if (!validarQuantidadeParcelas(entrada.quantidade)) {
    throw new Error(
      `A quantidade deve ser entre ${LIMITES.parcelasMin} e ${LIMITES.parcelasMax}.`,
    );
  }
  return gerarVencimentosMensais(entrada.primeiroVencimento, entrada.quantidade).map(
    (vencimento, i) => ({
      parcela: i + 1,
      totalParcelas: entrada.quantidade,
      vencimento,
      valorCentavos: entrada.valorCentavos,
      codigoBarras: i === 0 || entrada.mesmoCodigoEmTodos ? entrada.codigoBarras : null,
    }),
  );
}

export function totalDaSerie(valorCentavos: Centavos, quantidade: number): Centavos {
  return multiplicarCentavos(valorCentavos, quantidade);
}

/** "Serão criados 5 lançamentos de R$ 2.995,00, totalizando R$ 14.975,00." */
export function mensagemResumoSerie(valorCentavos: Centavos, quantidade: number): string {
  const total = totalDaSerie(valorCentavos, quantidade);
  return `Serão criados ${quantidade} lançamentos de ${formatarMoeda(valorCentavos)}, totalizando ${formatarMoeda(total)}.`;
}
