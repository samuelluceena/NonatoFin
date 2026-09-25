import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Tooltip visual em CSS (hover e foco do teclado). O elemento envolvido
 * precisa ter seu próprio nome acessível (a dica é só visual: aria-hidden).
 */
export function Dica({ texto, children, lado = 'direita', ativa = true }: { texto: string; children: ReactNode; lado?: 'direita' | 'cima'; ativa?: boolean }) {
  if (!ativa) return <>{children}</>;
  return (
    <span className="group/dica relative flex">
      {children}
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute z-50 rounded-sm border border-border bg-surface-elevated px-2 py-1 text-caption font-medium whitespace-nowrap text-fg shadow-md',
          'opacity-0 transition-opacity duration-150 group-focus-within/dica:opacity-100 group-hover/dica:opacity-100',
          lado === 'direita' ? 'top-1/2 left-full ml-2 -translate-y-1/2' : 'bottom-full left-1/2 mb-2 -translate-x-1/2',
        )}
      >
        {texto}
      </span>
    </span>
  );
}
