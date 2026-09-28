import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Tabela financeira densa (desktop). Padrão: cabeçalho discreto em `bg-subtle`,
 * linhas de ~52px com divisórias, hover suave, números à direita e tabulares.
 * No celular, prefira `ListaPainel` (listas em vez de tabelas).
 */
export function Tabela({ className, children, legenda, ...props }: ComponentProps<'table'> & { legenda: string }) {
  return (
    <div className={cn('overflow-hidden rounded-lg border border-border bg-surface', className)}>
      <table className="w-full table-fixed text-sm" {...props}>
        <caption className="sr-only">{legenda}</caption>
        {children}
      </table>
    </div>
  );
}

export function CabecalhoTabela({ className, ...props }: ComponentProps<'thead'>) {
  return <thead className={cn('border-b border-border bg-bg-subtle text-left text-caption font-medium text-fg-3', className)} {...props} />;
}

export function CorpoTabela({ className, ...props }: ComponentProps<'tbody'>) {
  return <tbody className={cn('divide-y divide-border-subtle', className)} {...props} />;
}

export function LinhaTabela({ className, ...props }: ComponentProps<'tr'>) {
  return <tr className={cn('transition-colors duration-150 hover:bg-surface-2/60', className)} {...props} />;
}

/** Célula de cabeçalho. `numerica` alinha à direita (valores). */
export function Th({ className, numerica, ...props }: ComponentProps<'th'> & { numerica?: boolean }) {
  return <th scope="col" className={cn('px-3 py-2.5 font-medium first:pl-4 last:pr-4', numerica && 'text-right', className)} {...props} />;
}

/** Célula. `numerica` alinha à direita com algarismos tabulares. */
export function Td({ className, numerica, ...props }: ComponentProps<'td'> & { numerica?: boolean }) {
  return <td className={cn('px-3 py-3 align-middle first:pl-4 last:pr-4', numerica && 'numeros text-right', className)} {...props} />;
}
