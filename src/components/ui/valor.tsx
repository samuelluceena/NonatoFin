import { formatarMoeda, formatarMoedaComSinal, formatarMoedaSaldo, type Centavos } from '@/lib/domain/dinheiro';
import { cn } from '@/lib/utils/cn';

interface Props {
  centavos: Centavos;
  /**
   * `saldo` (padrão): negativo com "−", positivo sem sinal.
   * `sempre`: "+ R$" / "− R$" (movimentos, ajustes).
   * `nunca`: valor absoluto, sem sinal (o contexto já diz a direção).
   */
  sinal?: 'saldo' | 'sempre' | 'nunca';
  /** `semantico`: verde se positivo, vermelho se negativo. Padrão: herda a cor. */
  tom?: 'herdar' | 'semantico' | 'negativo-perigo';
  className?: string;
}

/**
 * Exibe um valor em reais (MoneyDisplay) com algarismos tabulares.
 * Único lugar que decide como o dinheiro aparece na tela.
 */
export function Valor({ centavos, sinal = 'saldo', tom = 'herdar', className }: Props) {
  const texto =
    sinal === 'sempre' ? formatarMoedaComSinal(centavos) : sinal === 'nunca' ? formatarMoeda(Math.abs(centavos)) : formatarMoedaSaldo(centavos);
  const cor =
    tom === 'semantico'
      ? centavos > 0
        ? 'text-success'
        : centavos < 0
          ? 'text-danger'
          : undefined
      : tom === 'negativo-perigo' && centavos < 0
        ? 'text-danger'
        : undefined;
  return <span className={cn('numeros whitespace-nowrap', cor, className)}>{texto}</span>;
}
