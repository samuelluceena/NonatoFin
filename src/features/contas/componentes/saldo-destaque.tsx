import { formatarMoedaSaldo, type Centavos } from '@/lib/domain/dinheiro';
import { cn } from '@/lib/utils/cn';

interface Props {
  centavos: Centavos;
  /** Tamanho dos centavos (menores que o número inteiro). */
  classeCentavos: string;
  className?: string;
}

/**
 * Saldo em destaque com os centavos menores ("R$ 2.023.267,12"). Mesmo texto
 * de `Valor` (formatarMoedaSaldo): leitores de tela ouvem o número corrido.
 * Negativo em vermelho.
 */
export function SaldoDestaque({ centavos, classeCentavos, className }: Props) {
  const texto = formatarMoedaSaldo(centavos);
  const virgula = texto.lastIndexOf(',');
  return (
    <span className={cn('numeros whitespace-nowrap', centavos < 0 && 'text-danger', className)}>
      {texto.slice(0, virgula)}
      <span className={classeCentavos}>{texto.slice(virgula)}</span>
    </span>
  );
}
