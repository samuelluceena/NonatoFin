import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface Props {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  acoes?: ReactNode;
  voltar?: ReactNode;
  className?: string;
}

export function CabecalhoPagina({ titulo, subtitulo, acoes, voltar, className }: Props) {
  return (
    <header className={cn('mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {voltar && <div className="mb-2">{voltar}</div>}
        <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-[28px]">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-[15px] text-fg-2">{subtitulo}</p>}
      </div>
      {acoes && <div className="flex shrink-0 flex-wrap gap-2">{acoes}</div>}
    </header>
  );
}
