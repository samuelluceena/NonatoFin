'use client';

import type { ComponentProps } from 'react';
import { centavosDosDigitos, formatarNumeroMoeda } from '@/lib/domain/dinheiro';
import { classeControle } from './campo';
import { cn } from '@/lib/utils/cn';

interface Props extends Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type'> {
  valor: number;
  onValorChange: (centavos: number) => void;
}

/**
 * Campo de valor em reais com máscara "estilo banco": os dígitos preenchem da
 * direita (299500 -> 2.995,00). Teclado numérico no celular.
 */
export function CampoMoeda({ valor, onValorChange, className, ...props }: Props) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-fg-3" aria-hidden="true">
        R$
      </span>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={valor > 0 ? formatarNumeroMoeda(valor) : ''}
        placeholder="0,00"
        onChange={(e) => onValorChange(centavosDosDigitos(e.target.value))}
        className={classeControle(cn('numeros h-12 pl-11 text-[17px] font-medium', className))}
        {...props}
      />
    </div>
  );
}
