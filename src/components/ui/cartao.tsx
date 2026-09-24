import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils/cn';

export function Cartao({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('rounded-lg border border-border bg-surface shadow-sm', className)}
      {...props}
    />
  );
}

export function TituloSecao({ className, ...props }: ComponentProps<'h2'>) {
  return (
    <h2
      className={cn('text-[13px] font-semibold uppercase tracking-wide text-fg-3', className)}
      {...props}
    />
  );
}
