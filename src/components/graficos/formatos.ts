import type { Centavos } from '@/lib/domain/dinheiro';

const compacto = new Intl.NumberFormat('pt-BR', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** 1497500 -> "R$ 15 mil" (rótulos curtos de gráficos). */
export function moedaCompacta(centavos: Centavos): string {
  return `R$ ${compacto.format(centavos / 100)}`;
}
