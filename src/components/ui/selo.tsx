import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils/cn';

export type TomSelo = 'neutro' | 'info' | 'sucesso' | 'aviso' | 'perigo';

const TONS: Record<TomSelo, string> = {
  neutro: 'border-border bg-surface-2 text-fg-2',
  info: 'border-info-border bg-info-soft text-info',
  sucesso: 'border-success-border bg-success-soft text-success',
  aviso: 'border-warning-border bg-warning-soft text-warning',
  perigo: 'border-danger-border bg-danger-soft text-danger',
};

/**
 * Selo (badge): status, "Em uso", contagens. Cor é reforço — sempre com
 * texto (e, para status, também com ícone).
 */
export function Selo({ tom = 'neutro', className, ...props }: ComponentProps<'span'> & { tom?: TomSelo }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm border px-1.5 py-px text-caption font-medium whitespace-nowrap [&_svg]:size-3.5 [&_svg]:shrink-0',
        TONS[tom],
        className,
      )}
      {...props}
    />
  );
}
