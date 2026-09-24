import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

const CLASSES_CONTROLE =
  'w-full rounded-md border bg-surface px-3.5 text-fg placeholder:text-fg-3 ' +
  'transition-colors focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/25 ' +
  'disabled:opacity-60 aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/25';

export const classeControle = (extra?: string) => cn(CLASSES_CONTROLE, 'border-border-strong', extra);

interface PropsCampo {
  id: string;
  rotulo: string;
  erro?: string;
  dica?: ReactNode;
  opcional?: boolean;
  children: ReactNode;
  className?: string;
}

/** Label + controle + dica + mensagem de erro, com acessibilidade ligada. */
export function Campo({ id, rotulo, erro, dica, opcional, children, className }: PropsCampo) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {rotulo}
        {opcional && <span className="font-normal text-fg-3"> (opcional)</span>}
      </label>
      {children}
      {dica && !erro && (
        <p id={`${id}-dica`} className="text-[13px] text-fg-3">
          {dica}
        </p>
      )}
      {erro && (
        <p id={`${id}-erro`} role="alert" className="text-[13px] font-medium text-danger">
          {erro}
        </p>
      )}
    </div>
  );
}

export function Entrada({ className, ...props }: ComponentProps<'input'>) {
  return <input className={classeControle(cn('h-12', className))} {...props} />;
}

export function AreaTexto({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={classeControle(cn('min-h-24 py-3', className))} {...props} />;
}

export function Seletor({ className, ...props }: ComponentProps<'select'>) {
  return <select className={classeControle(cn('h-12 pr-8', className))} {...props} />;
}

/** Atributos aria para ligar o controle à dica/erro do <Campo>. */
export function ariaCampo(id: string, erro?: string, temDica?: boolean) {
  return {
    id,
    'aria-invalid': erro ? true : undefined,
    'aria-describedby': erro ? `${id}-erro` : temDica ? `${id}-dica` : undefined,
  } as const;
}
