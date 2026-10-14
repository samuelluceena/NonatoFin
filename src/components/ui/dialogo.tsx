'use client';

import { AlertTriangle, Info, X } from 'lucide-react';
import { BotaoIcone } from './botao';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface PropsDialogo {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  descricao?: ReactNode;
  children?: ReactNode;
  rodape?: ReactNode;
  /** Largura máxima a partir de 640px (padrão: md = 448px). */
  tamanho?: 'sm' | 'md' | 'lg';
  /**
   * Confirmação (AlertDialog): `perigo` para ações destrutivas/irreversíveis,
   * `aviso` para impedimentos. Usa role="alertdialog" e um ícone no título.
   */
  alerta?: 'perigo' | 'aviso';
  /** Impede fechar (Esc, clique fora, X) — ex.: enquanto uma operação está em andamento. */
  bloqueado?: boolean;
  className?: string;
}

const LARGURAS = { sm: 'sm:max-w-sm', md: 'sm:max-w-md', lg: 'sm:max-w-lg' } as const;

/**
 * Modal acessível baseado no <dialog> nativo (foco preso, Esc fecha, clique
 * fora fecha). No celular é um "bottom sheet" (com alça e entrada de baixo);
 * a partir de 640px, centralizado. Superfície elevada do tema.
 */
export function Dialogo({ aberto, onFechar, titulo, descricao, children, rodape, tamanho = 'md', alerta, bloqueado = false, className }: PropsDialogo) {
  const ref = useRef<HTMLDialogElement>(null);
  const bloqueadoRef = useRef(bloqueado);
  const idTitulo = useId();
  const idDescricao = useId();

  useEffect(() => {
    bloqueadoRef.current = bloqueado;
  }, [bloqueado]);

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (aberto && !dialogo.open) dialogo.showModal();
    if (!aberto && dialogo.open) dialogo.close();
  }, [aberto]);

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    const aoCancelar = (e: Event) => {
      if (bloqueadoRef.current) e.preventDefault();
    };
    const aoFechar = () => {
      // Alguns navegadores fecham mesmo com o Esc cancelado: reabre enquanto bloqueado.
      if (bloqueadoRef.current) dialogo.showModal();
      else onFechar();
    };
    dialogo.addEventListener('cancel', aoCancelar);
    dialogo.addEventListener('close', aoFechar);
    return () => {
      dialogo.removeEventListener('cancel', aoCancelar);
      dialogo.removeEventListener('close', aoFechar);
    };
  }, [onFechar]);

  return (
    <dialog
      ref={ref}
      role={alerta ? 'alertdialog' : undefined}
      aria-labelledby={idTitulo}
      aria-describedby={descricao ? idDescricao : undefined}
      onClick={(e) => {
        // Clique no fundo (fora do conteúdo) fecha.
        if (e.target === e.currentTarget && !bloqueado) onFechar();
      }}
      className={cn(
        'fixed inset-x-0 top-auto bottom-0 m-0 w-full max-w-full rounded-t-xl border border-b-0 border-border bg-surface-elevated p-0 text-fg shadow-lg',
        'max-h-[92dvh] backdrop:animate-esmaecer',
        'max-sm:open:animate-subir sm:inset-0 sm:m-auto sm:h-fit sm:rounded-xl sm:border-b sm:open:animate-surgir',
        LARGURAS[tamanho],
        className,
      )}
    >
      {aberto && (
        <div className="flex max-h-[92dvh] flex-col">
          <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-border-strong sm:hidden" aria-hidden="true" />
          <div className="flex items-start justify-between gap-4 px-5 pt-3 sm:pt-5">
            <div className="flex min-w-0 gap-3">
              {alerta && (
                <span
                  className={cn(
                    'mt-0.5 grid size-9 shrink-0 place-items-center rounded-md border [&_svg]:size-4.5',
                    alerta === 'perigo' ? 'border-danger-border bg-danger-soft text-danger' : 'border-info-border bg-info-soft text-info',
                  )}
                  aria-hidden="true"
                >
                  {alerta === 'perigo' ? <AlertTriangle /> : <Info />}
                </span>
              )}
              <div className="min-w-0">
                <h2 id={idTitulo} className="text-lead font-semibold">
                  {titulo}
                </h2>
                {descricao && (
                  <div id={idDescricao} className="mt-1 text-sm text-fg-2">
                    {descricao}
                  </div>
                )}
              </div>
            </div>
            <BotaoIcone rotulo="Fechar" onClick={onFechar} disabled={bloqueado} className="-mt-2 -mr-2.5 text-fg-3">
              <X aria-hidden="true" />
            </BotaoIcone>
          </div>
          {children && <div className={cn('overflow-y-auto px-5 pt-4', !rodape && 'pb-[max(1.25rem,env(safe-area-inset-bottom))]')}>{children}</div>}
          {rodape && (
            <div className="mt-5 flex flex-col-reverse gap-2 border-t border-border-subtle px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">
              {rodape}
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}
