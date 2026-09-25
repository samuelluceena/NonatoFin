import { Check, Info, TriangleAlert } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Estrutura de formulários: um painel com seções separadas por linhas finas
 * (em vez de um bloco longo de campos), cada seção com título curto e, só
 * quando ajuda, uma descrição.
 */
export function PainelFormulario({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('rounded-lg border border-border bg-surface', className)} {...props} />;
}

export function SecaoFormulario({ titulo, descricao, children, className }: { titulo: string; descricao?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('flex flex-col gap-4 border-t border-border-subtle px-4 py-5 first:border-t-0 sm:px-6', className)}>
      <header>
        <h2 className="text-sm font-semibold text-fg">{titulo}</h2>
        {descricao && <p className="mt-0.5 text-meta text-fg-3">{descricao}</p>}
      </header>
      {children}
    </section>
  );
}

/**
 * Caixa de marcação com rótulo e descrição (o <input type="checkbox"> real
 * continua lá: teclado, formulários e leitores de tela funcionam igual).
 */
export function CampoMarcacao({
  rotulo,
  descricao,
  className,
  ...props
}: Omit<ComponentProps<'input'>, 'type'> & { rotulo: ReactNode; descricao?: ReactNode }) {
  return (
    <label className={cn('flex min-h-11 cursor-pointer items-start gap-3 text-body text-fg', className)}>
      <span className="relative mt-0.5 grid size-5 shrink-0 place-items-center">
        <input
          type="checkbox"
          className="peer size-5 cursor-pointer appearance-none rounded-sm border border-border-strong bg-input shadow-xs transition-colors checked:border-primary checked:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
          {...props}
        />
        <Check className="pointer-events-none absolute size-3.5 text-primary-fg opacity-0 peer-checked:opacity-100" strokeWidth={3} aria-hidden="true" />
      </span>
      <span>
        {rotulo}
        {descricao && <span className="block text-meta text-fg-3">{descricao}</span>}
      </span>
    </label>
  );
}

/** Aviso dentro de formulários e diálogos (informação ou atenção). */
export function Aviso({ tom = 'info', children, className, ...props }: ComponentProps<'div'> & { tom?: 'info' | 'aviso' }) {
  const Icone = tom === 'info' ? Info : TriangleAlert;
  return (
    <div
      className={cn(
        'flex gap-2 rounded-md border p-3 text-meta',
        tom === 'info' ? 'border-info-border bg-info-soft text-fg-2' : 'border-warning-border bg-warning-soft text-fg-2',
        className,
      )}
      {...props}
    >
      <Icone className={cn('mt-0.5 size-4 shrink-0', tom === 'info' ? 'text-info' : 'text-warning')} aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
