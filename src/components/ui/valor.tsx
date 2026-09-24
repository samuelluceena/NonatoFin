import { formatarMoeda, type Centavos } from '@/lib/domain/dinheiro';
import { cn } from '@/lib/utils/cn';

/** Exibe um valor em reais com números tabulares. */
export function Valor({ centavos, className }: { centavos: Centavos; className?: string }) {
  return <span className={cn('numeros whitespace-nowrap', className)}>{formatarMoeda(centavos)}</span>;
}
