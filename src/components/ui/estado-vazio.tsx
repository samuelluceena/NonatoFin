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
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong px-6 py-10 text-center',
        className,
      )}
    >
      {icone && <div className="mb-1 text-fg-3 [&_svg]:size-8">{icone}</div>}
      <p className="font-semibold text-fg">{titulo}</p>
      {descricao && <p className="max-w-sm text-sm text-fg-2">{descricao}</p>}
      {acao && <div className="mt-3">{acao}</div>}
    </div>
  );
}
