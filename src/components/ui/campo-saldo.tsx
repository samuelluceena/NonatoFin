'use client';

import { CampoMoeda } from './campo-moeda';
import { cn } from '@/lib/utils/cn';

interface Props {
  id: string;
  /** Valor com sinal, em centavos. */
  valor: number;
  onChange: (centavos: number) => void;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

/**
 * Valor que pode ser negativo (saldo no cheque especial). Digita-se o valor
 * como sempre e marca-se "Negativo" quando for o caso.
 */
export function CampoSaldo({ id, valor, onChange, ...aria }: Props) {
  const negativo = valor < 0;
  return (
    <div className="flex items-stretch gap-2">
      <div className="min-w-0 flex-1">
        <CampoMoeda id={id} valor={Math.abs(valor)} onValorChange={(v) => onChange(negativo ? -v : v)} {...aria} />
      </div>
      <label
        className={cn(
          'flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors lg:h-10',
          negativo ? 'border-danger-border bg-danger-soft text-danger' : 'border-border-strong bg-input text-fg-2 hover:bg-surface-2',
        )}
      >
        <input
          type="checkbox"
          checked={negativo}
          onChange={(e) => onChange(e.target.checked ? -Math.abs(valor) : Math.abs(valor))}
          className="size-4 accent-danger"
        />
        Negativo
      </label>
    </div>
  );
}
