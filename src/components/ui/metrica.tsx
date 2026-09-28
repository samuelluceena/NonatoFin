import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { Valor } from './valor';

/**
 * Métricas (MetricCard) em PAINEL: uma superfície dividida em células, em vez
 * de vários cards iguais soltos. Três níveis de importância:
 *  - `destaque`: a informação principal da tela (valor grande);
 *  - `padrao`: indicadores de apoio;
 *  - `compacta`: números secundários (contagens).
 */
export function PainelMetricas({
  rotulo,
  children,
  className,
}: {
  /** Nome acessível da região. */
  rotulo: string;
  children: ReactNode;
  /** Colunas por breakpoint (ex.: 'grid-cols-2 lg:grid-cols-4'). */
  className?: string;
}) {
  return (
    <section aria-label={rotulo} className={cn('grid gap-px overflow-hidden rounded-lg border border-border bg-border', className)}>
      {children}
    </section>
  );
}

interface PropsMetrica {
  rotulo: string;
  /** Centavos (moeda) ou quantidade (contagem). */
  valor: number;
  tipo?: 'moeda' | 'contagem';
  nivel?: 'destaque' | 'padrao' | 'compacta';
  /**
   * `perigo`: valor em vermelho quando > 0 (atrasados);
   * `saldo`: vermelho quando negativo.
   */
  tom?: 'neutro' | 'perigo' | 'saldo';
  /** Linha de contexto (quantidade, período). */
  detalhe?: ReactNode;
  /** Ícone discreto antes do rótulo. */
  icone?: ReactNode;
  /** Elemento extra abaixo (ex.: selo "Cobre"). */
  extra?: ReactNode;
  href?: string;
  /** data-testid no valor (os testes leem o número exibido). */
  testId?: string;
  className?: string;
}

const TAMANHO_VALOR = {
  destaque: 'text-2xl sm:text-display',
  padrao: 'text-xl leading-7',
  compacta: 'text-lg leading-6',
} as const;

export function Metrica({ rotulo, valor, tipo = 'moeda', nivel = 'padrao', tom = 'neutro', detalhe, icone, extra, href, testId, className }: PropsMetrica) {
  const perigo = (tom === 'perigo' && valor > 0) || (tom === 'saldo' && valor < 0);
  const conteudo = (
    <>
      <p className="flex items-center gap-1.5 text-meta font-medium text-fg-3 [&_svg]:size-3.5 [&_svg]:shrink-0">
        {icone}
        {rotulo}
      </p>
      <p className={cn('mt-1.5 font-semibold tracking-tight', TAMANHO_VALOR[nivel], perigo ? 'text-danger' : 'text-fg')} data-testid={testId}>
        {tipo === 'moeda' ? <Valor centavos={valor} /> : <span className="numeros">{valor}</span>}
      </p>
      {detalhe && <p className="mt-1 text-meta text-fg-2">{detalhe}</p>}
      {extra && <div className="mt-2">{extra}</div>}
    </>
  );
  const classes = cn('block min-w-0 bg-surface', nivel === 'destaque' ? 'p-5' : nivel === 'compacta' ? 'px-4 py-3' : 'p-4', className);
  if (!href) return <div className={classes}>{conteudo}</div>;
  return (
    <Link href={href} className={cn(classes, 'transition-colors duration-150 hover:bg-surface-2/60 focus-visible:-outline-offset-2')}>
      {conteudo}
    </Link>
  );
}
