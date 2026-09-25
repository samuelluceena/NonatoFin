import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils/cn';

/** Bloco de carregamento (skeleton). Use dentro de um contêiner com role="status". */
export function Esqueleto({ className, ...props }: ComponentProps<'div'>) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-md bg-surface-3/70', className)} {...props} />;
}
