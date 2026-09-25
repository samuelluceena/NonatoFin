'use client';

import type { ComponentProps } from 'react';
import { centavosDosDigitos, formatarNumeroMoeda } from '@/lib/domain/dinheiro';
import { classeControle } from './campo';
import { cn } from '@/lib/utils/cn';

interface Props extends Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type'> {
  valor: number;
  onValorChange: (centavos: number) => void;
  /**
   * `padrao`: altura dos demais campos. `destaque`: o valor é a informação
   * principal do formulário (campo alto, número grande). Só muda o visual.
   */
  tamanho?: 'padrao' | 'destaque';
}

const TAMANHOS = {
  padrao: { prefixo: 'left-3 text-fg-3', campo: 'h-11 pl-10 text-lead font-medium lg:h-10' },
  destaque: { prefixo: 'left-4 text-xl font-medium text-fg-3', campo: 'h-16 pl-14 text-3xl font-semibold tracking-tight' },
} as const;

/**
 * Campo de valor em reais com máscara "estilo banco": os dígitos preenchem da
 * direita (299500 -> 2.995,00). Teclado numérico no celular.
 */
export function CampoMoeda({ valor, onValorChange, tamanho = 'padrao', className, ...props }: Props) {
  const t = TAMANHOS[tamanho];
  return (
    <div className="relative">
      <span className={cn('pointer-events-none absolute top-1/2 -translate-y-1/2', t.prefixo)} aria-hidden="true">
        R$
      </span>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={valor > 0 ? formatarNumeroMoeda(valor) : ''}
        placeholder="0,00"
        onChange={(e) => onValorChange(centavosDosDigitos(e.target.value))}
        className={classeControle(cn('numeros', t.campo, className))}
        {...props}
      />
    </div>
  );
}
