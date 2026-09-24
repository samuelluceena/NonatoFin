'use client';

import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface PropsDialogo {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  descricao?: ReactNode;
  children?: ReactNode;
  rodape?: ReactNode;
  className?: string;
}

/**
 * Modal acessível baseado no <dialog> nativo (foco preso, Esc fecha).
 * No celular aparece como "bottom sheet"; a partir de 640px, centralizado.
 */
export function Dialogo({ aberto, onFechar, titulo, descricao, children, rodape, className }: PropsDialogo) {
  const ref = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();
  const idDescricao = useId();

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (aberto && !dialogo.open) dialogo.showModal();
    if (!aberto && dialogo.open) dialogo.close();
  }, [aberto]);

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    const aoFechar = () => onFechar();
    dialogo.addEventListener('close', aoFechar);
    return () => dialogo.removeEventListener('close', aoFechar);
  }, [onFechar]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={idTitulo}
      aria-describedby={descricao ? idDescricao : undefined}
      onClick={(e) => {
        // Clique no fundo (fora do conteúdo) fecha.
        if (e.target === e.currentTarget) onFechar();
      }}
      className={cn(
        'fixed inset-x-0 top-auto bottom-0 m-0 w-full max-w-full rounded-t-xl border border-border bg-surface p-0 text-fg shadow-lg',
        'max-h-[92dvh] backdrop:backdrop-blur-[2px]',
        'sm:inset-0 sm:m-auto sm:h-fit sm:max-w-md sm:rounded-xl',
        className,
      )}
    >
      {aberto && (
        <div className="flex max-h-[92dvh] flex-col">
          <div className="flex items-start justify-between gap-4 px-5 pt-5">
            <div className="min-w-0">
              <h2 id={idTitulo} className="text-lg font-semibold leading-tight">
                {titulo}
              </h2>
              {descricao && (
                <div id={idDescricao} className="mt-1.5 text-sm text-fg-2">
                  {descricao}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onFechar}
              className="-mr-2 -mt-1 grid size-10 shrink-0 place-items-center rounded-md text-fg-3 hover:bg-surface-2 hover:text-fg"
              aria-label="Fechar"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          {children && <div className="overflow-y-auto px-5 pt-4">{children}</div>}
          {rodape && (
            <div className="flex flex-col-reverse gap-2 px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">
              {rodape}
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}
