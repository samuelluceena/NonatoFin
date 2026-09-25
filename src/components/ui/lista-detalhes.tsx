import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

/** Lista "rótulo: valor" das telas de detalhe (empresa, status, pago em...). */
export function ListaDetalhes({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn('divide-y divide-border-subtle', className)}>{children}</dl>;
}

export function LinhaDetalhe({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="text-sm text-fg-3">{rotulo}</dt>
      <dd className="text-body text-fg sm:text-right">{children}</dd>
    </div>
  );
}
