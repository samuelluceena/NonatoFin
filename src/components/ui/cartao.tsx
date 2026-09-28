import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils/cn';

/** Superfície padrão (cards, listas, painéis): fundo `surface` + borda, sem sombra. */
export function Cartao({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('rounded-lg border border-border bg-surface', className)} {...props} />;
}

/** Título de seção (sentence case, discreto): "Aparência", "Próximos vencimentos"... */
export function TituloSecao({ className, ...props }: ComponentProps<'h2'>) {
  return <h2 className={cn('text-sm font-medium text-fg-2', className)} {...props} />;
}
