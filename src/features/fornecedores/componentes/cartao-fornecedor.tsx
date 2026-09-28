import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Valor } from '@/components/ui/valor';
import { formatarData } from '@/lib/domain/datas';
import type { ResumoFornecedor } from '@/lib/domain/tipos';
import { cn } from '@/lib/utils/cn';

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Colunas da lista (desktop): fornecedor · a pagar · atrasado · pago · total. */
const COLUNAS = 'xl:grid xl:grid-cols-[minmax(0,1fr)_8.5rem_8.5rem_8.5rem_9rem_1.25rem] xl:items-center xl:gap-4';

/** Cabeçalho das colunas (a partir de 1280px). */
export function CabecalhoListaFornecedores() {
  return (
    <div className={cn('hidden border-b border-border bg-bg-subtle px-4 py-2.5 text-caption font-medium text-fg-3', COLUNAS)} aria-hidden="true">
      <span>Fornecedor</span>
      <span className="text-right">A pagar</span>
      <span className="text-right">Atrasado</span>
      <span className="text-right">Pago</span>
      <span className="text-right">Total</span>
      <span />
    </div>
  );
}

/**
 * Linha de fornecedor: no celular, nome + quantidades e total; no desktop,
 * colunas com valor e quantidade por status. Toda a linha abre o detalhe.
 */
export function CartaoFornecedor({ resumo }: { resumo: ResumoFornecedor }) {
  const r = resumo;
  const meta = [plural(r.quantidadeTotal, 'boleto', 'boletos'), r.proximoVencimento && `próximo em ${formatarData(r.proximoVencimento)}`].filter(Boolean).join(' · ');
  return (
    <Link
      href={`/fornecedores/${r.fornecedor.id}`}
      data-testid="cartao-fornecedor"
      className={cn('group flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-surface-2/60 focus-visible:-outline-offset-2', COLUNAS)}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-medium text-fg group-hover:text-primary-text">{r.fornecedor.nome}</span>
        <span className="block truncate text-meta text-fg-3">{meta}</span>
        {/* Celular: quantidades por status (no desktop ficam nas colunas). */}
        <span className="mt-0.5 block truncate text-meta text-fg-2 xl:hidden">
          {plural(r.quantidadePendente, 'pendente', 'pendentes')} · {plural(r.quantidadePaga, 'pago', 'pagos')} ·{' '}
          <span className={r.quantidadeAtrasada > 0 ? 'text-danger' : undefined}>{plural(r.quantidadeAtrasada, 'atrasado', 'atrasados')}</span>
        </span>
      </span>

      <Coluna valor={r.pendenteCentavos} detalhe={plural(r.quantidadePendente, 'pendente', 'pendentes')} />
      <Coluna valor={r.atrasadoCentavos} detalhe={plural(r.quantidadeAtrasada, 'atrasado', 'atrasados')} perigo={r.atrasadoCentavos > 0} />
      <Coluna valor={r.pagoCentavos} detalhe={plural(r.quantidadePaga, 'pago', 'pagos')} />

      <span className="shrink-0 text-right">
        <Valor centavos={r.totalCentavos} className="block text-body font-semibold text-fg" />
        <span className="block text-caption text-fg-3 xl:hidden">total</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-fg-3" aria-hidden="true" />
    </Link>
  );
}

function Coluna({ valor, detalhe, perigo }: { valor: number; detalhe: string; perigo?: boolean }) {
  return (
    <span className="hidden text-right xl:block">
      <Valor centavos={valor} className={cn('block text-sm font-medium', perigo ? 'text-danger' : valor > 0 ? 'text-fg' : 'text-fg-3')} />
      <span className="block text-caption text-fg-3">{detalhe}</span>
    </span>
  );
}
