import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface Props {
  titulo: ReactNode;
  /** Descrição curta (uma linha, quando ajuda). */
  subtitulo?: ReactNode;
  /** Ações da página (no máximo uma primária). */
  acoes?: ReactNode;
  /** Link de volta (telas de detalhe/edição). */
  voltar?: ReactNode;
  className?: string;
}

/** Cabeçalho padrão das páginas (PageHeader). */
export function CabecalhoPagina({ titulo, subtitulo, acoes, voltar, className }: Props) {
  return (
    <header className={cn('mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {voltar && <div className="mb-1 -ml-1">{voltar}</div>}
        <h1 className="text-title font-semibold text-balance text-fg">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-body text-fg-2">{subtitulo}</p>}
      </div>
      {acoes && <div className="flex shrink-0 flex-wrap gap-2">{acoes}</div>}
    </header>
  );
}
