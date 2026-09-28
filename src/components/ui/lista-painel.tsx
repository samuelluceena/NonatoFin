import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

/** Lista em painel (uma superfície, linhas divididas) — padrão de listas no celular e de listas simples. */
export function ListaPainel({ className, ...props }: ComponentProps<'ul'>) {
  return <ul className={cn('divide-y divide-border-subtle overflow-hidden rounded-lg border border-border bg-surface', className)} {...props} />;
}

interface PropsLinha {
  /** Principal (fornecedor, nome da conta...). */
  titulo: ReactNode;
  /** Linha secundária (descrição, metadados). */
  descricao?: ReactNode;
  /** À esquerda (ícone em caixa). */
  inicio?: ReactNode;
  /** À direita (valor, selo). */
  fim?: ReactNode;
  /** Linha inteira clicável. */
  href?: string;
  className?: string;
  testId?: string;
}

/** Linha de lista: ícone · título/descrição · valor. Mínimo 56px (toque). */
export function LinhaLista({ titulo, descricao, inicio, fim, href, className, testId }: PropsLinha) {
  const conteudo = (
    <>
      {inicio}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-medium text-fg">{titulo}</span>
        {descricao && <span className="mt-0.5 block truncate text-meta text-fg-3">{descricao}</span>}
      </span>
      {fim && <span className="flex shrink-0 flex-col items-end gap-0.5 text-right">{fim}</span>}
    </>
  );
  const classes = cn('flex min-h-14 items-center gap-3 px-4 py-3', className);
  return (
    <li>
      {href ? (
        <Link href={href} className={cn(classes, 'transition-colors duration-150 hover:bg-surface-2/60 focus-visible:-outline-offset-2')} data-testid={testId}>
          {conteudo}
        </Link>
      ) : (
        <div className={classes} data-testid={testId}>
          {conteudo}
        </div>
      )}
    </li>
  );
}

/** Caixa de ícone das listas (32px, neutra). */
export function IconeLista({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('grid size-8 shrink-0 place-items-center rounded-md border border-border bg-surface-2 text-fg-2 [&_svg]:size-4', className)} aria-hidden="true">
      {children}
    </span>
  );
}
