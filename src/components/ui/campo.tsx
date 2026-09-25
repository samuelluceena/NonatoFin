import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

/** Campos: fundo `input`, borda forte, foco com anel azul, erro em vermelho. Altura 44px (40px no desktop). */
const CLASSES_CONTROLE =
  'rounded-md border px-3 shadow-xs placeholder:text-fg-3 ' +
  'transition-[border-color,box-shadow] duration-150 hover:border-fg-3/50 ' +
  'focus:outline-none focus:border-ring focus:ring-3 focus:ring-ring/20 ' +
  'disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/20';

/**
 * Classes do controle. Largura total por padrão (`w-auto` em `extra` troca);
 * `destaque` = filtro aplicado (fundo azul suave). Sem classes conflitantes.
 */
export const classeControle = (extra?: string, destaque = false) =>
  cn(
    CLASSES_CONTROLE,
    destaque ? 'border-info-border bg-primary-soft text-primary-soft-fg' : 'border-border-strong bg-input text-fg',
    !extra?.split(' ').includes('w-auto') && 'w-full',
    extra,
  );

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
      <label htmlFor={id} className="text-sm font-medium text-fg-2">
        {rotulo}
        {opcional && <span className="font-normal text-fg-3"> (opcional)</span>}
      </label>
      {children}
      {dica && !erro && (
        <p id={`${id}-dica`} className="text-meta text-fg-3">
          {dica}
        </p>
      )}
      {erro && (
        <p id={`${id}-erro`} role="alert" className="text-meta font-medium text-danger">
          {erro}
        </p>
      )}
    </div>
  );
}

export function Entrada({ className, ...props }: ComponentProps<'input'>) {
  return <input className={classeControle(cn('h-11 lg:h-10', className))} {...props} />;
}

export function AreaTexto({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={classeControle(cn('min-h-24 py-2.5', className))} {...props} />;
}

export function Seletor({ className, ...props }: ComponentProps<'select'>) {
  return <select className={classeControle(cn('h-11 pr-8 lg:h-10', className))} {...props} />;
}

/** Atributos aria para ligar o controle à dica/erro do <Campo>. */
export function ariaCampo(id: string, erro?: string, temDica?: boolean) {
  return {
    id,
    'aria-invalid': erro ? true : undefined,
    'aria-describedby': erro ? `${id}-erro` : temDica ? `${id}-dica` : undefined,
  } as const;
}
