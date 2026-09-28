import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface Props {
  icone?: ReactNode;
  titulo: string;
  descricao?: ReactNode;
  acao?: ReactNode;
  className?: string;
}

export function EstadoVazio({ icone, titulo, descricao, acao, className }: Props) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-6 py-10 text-center', className)}>
      {icone && (
        <div className="mb-2 grid size-10 place-items-center rounded-md border border-border bg-surface-2 text-fg-3 [&_svg]:size-5" aria-hidden="true">
          {icone}
        </div>
      )}
      <p className="text-body font-medium text-fg">{titulo}</p>
      {descricao && <p className="max-w-sm text-sm text-fg-2">{descricao}</p>}
      {acao && <div className="mt-3">{acao}</div>}
    </div>
  );
}
