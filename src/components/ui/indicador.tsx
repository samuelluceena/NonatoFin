import Link from 'next/link';
import type { ReactNode } from 'react';
import { formatarMoeda } from '@/lib/domain/dinheiro';
import { cn } from '@/lib/utils/cn';

interface Props {
  rotulo: string;
  /** Valor em centavos (moeda) ou número inteiro (contagem). */
  valor: number;
  tipo?: 'moeda' | 'contagem';
  detalhe?: ReactNode;
  href?: string;
  icone?: ReactNode;
  tom?: 'padrao' | 'destaque' | 'perigo' | 'sucesso';
  testId?: string;
}

const TONS = {
  padrao: '',
  destaque: 'border-primary/35 bg-primary-soft',
  perigo: 'border-danger-border',
  sucesso: '',
} as const;

/** Card de indicador (KPI). Clicável quando recebe href. */
export function Indicador({ rotulo, valor, tipo = 'moeda', detalhe, href, icone, tom = 'padrao', testId }: Props) {
  const conteudo = (
    <>
      <p className="flex items-center gap-1.5 text-[12px] font-semibold tracking-wide text-fg-3 uppercase">
        {icone}
        {rotulo}
      </p>
      <p
        className={cn(
          'numeros mt-2 text-[22px] leading-none font-semibold tracking-tight sm:text-2xl',
          tom === 'perigo' && valor > 0 ? 'text-danger' : 'text-fg',
        )}
        data-testid={testId}
      >
        {tipo === 'moeda' ? formatarMoeda(valor) : valor}
      </p>
      {detalhe && <p className="mt-1.5 text-[13px] text-fg-2">{detalhe}</p>}
    </>
  );
  const classes = cn('block rounded-lg border border-border bg-surface p-4 shadow-sm', TONS[tom]);
  if (!href) return <div className={classes}>{conteudo}</div>;
  return (
    <Link href={href} className={cn(classes, 'transition-colors hover:border-border-strong')}>
      {conteudo}
    </Link>
  );
}
