import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { TituloSecao } from './cartao';

interface Props {
  id: string;
  titulo: ReactNode;
  /** Texto à direita (total, contagem). */
  detalhe?: ReactNode;
  /** Link à direita ("Ver todos"). */
  link?: { href: string; rotulo: string };
  /** Controle à direita (ex.: abas de métrica). */
  acao?: ReactNode;
  className?: string;
}

/** Cabeçalho de seção (SectionHeader): título + detalhe/link/ação alinhados. */
export function CabecalhoSecao({ id, titulo, detalhe, link, acao, className }: Props) {
  return (
    <div className={cn('mb-2.5 flex min-h-8 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1', className)}>
      <TituloSecao id={id}>{titulo}</TituloSecao>
      <div className="flex items-center gap-3">
        {detalhe && <span className="text-meta text-fg-3">{detalhe}</span>}
        {acao}
        {link && (
          <Link href={link.href} className="rounded-sm text-sm font-medium text-primary-text hover:underline">
            {link.rotulo}
          </Link>
        )}
      </div>
    </div>
  );
}
