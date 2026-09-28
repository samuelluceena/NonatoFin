'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface Opcao<T extends string> {
  valor: T;
  rotulo: string;
  icone?: ReactNode;
}

interface PropsSegmentado<T extends string> {
  nome: string;
  rotulo: string;
  opcoes: readonly Opcao<T>[];
  valor: T;
  onChange: (valor: T) => void;
  className?: string;
  ocultarRotulo?: boolean;
}

/** Grupo de opções exclusivas (radio) com visual de controle segmentado. */
export function Segmentado<T extends string>({
  nome,
  rotulo,
  opcoes,
  valor,
  onChange,
  className,
  ocultarRotulo,
}: PropsSegmentado<T>) {
  return (
    <fieldset className={cn('min-w-0', className)}>
      <legend className={cn('mb-1.5 text-sm font-medium text-fg-2', ocultarRotulo && 'sr-only')}>{rotulo}</legend>
      <div className="grid auto-cols-fr grid-flow-col gap-0.5 rounded-md border border-border bg-surface-2 p-0.5">
        {opcoes.map((opcao) => {
          const ativo = opcao.valor === valor;
          return (
            <label
              key={opcao.valor}
              className={cn(
                'relative flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-sm px-2 text-sm font-medium transition-[background-color,color,box-shadow] duration-150 lg:min-h-9 [&_svg]:size-4',
                'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring',
                ativo ? 'bg-surface text-fg shadow-sm ring-1 ring-border dark:bg-surface-3' : 'text-fg-2 hover:text-fg',
              )}
            >
              <input
                type="radio"
                name={nome}
                value={opcao.valor}
                checked={ativo}
                onChange={() => onChange(opcao.valor)}
                className="sr-only"
              />
              {opcao.icone}
              <span className="truncate">{opcao.rotulo}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
