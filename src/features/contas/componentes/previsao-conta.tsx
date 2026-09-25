import Link from 'next/link';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { formatarData } from '@/lib/domain/datas';
import { formatarMoedaComSinal, formatarMoedaSaldo } from '@/lib/domain/dinheiro';
import type { EventoPrevisto, LinhaPrevisao } from '@/lib/domain/saldos';
import { cn } from '@/lib/utils/cn';

type Linha = LinhaPrevisao<EventoPrevisto & { lancamentoId?: string }>;

/**
 * Próximas saídas e entradas previstas, com o saldo depois de cada uma.
 * Celular: dois níveis; a partir de md: colunas Data · Descrição · Valor · Saldo depois.
 */
export function PrevisaoConta({ linhas, dias }: { linhas: Linha[]; dias: number }) {
  return (
    <section aria-labelledby="titulo-previsao">
      <h2 id="titulo-previsao" className="mb-2.5 px-1 text-body font-semibold text-fg">
        Próximos {dias} dias
      </h2>
      <div className="overflow-hidden rounded-lg border border-border bg-surface" data-testid="previsao">
        {linhas.length === 0 ? (
          <p className="p-4 text-sm text-fg-2">Nada previsto para esta conta.</p>
        ) : (
          <>
            <div className="hidden items-center gap-4 border-b border-border-subtle px-5 pt-3 pb-2 text-caption font-medium text-fg-3 md:flex" aria-hidden="true">
              <span className="w-14 shrink-0">Data</span>
              <span className="flex-1">Descrição</span>
              <span className="w-32 shrink-0 text-right">Valor</span>
              <span className="w-36 shrink-0 text-right">Saldo depois</span>
              <span className="w-4 shrink-0" />
            </div>
            <ul className="divide-y divide-border-subtle">
              {linhas.map((l, i) => {
                const vencida = l.data < l.dataEfetiva;
                const negativo = l.saldoApos < 0;
                const conteudo = (
                  <>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5 md:flex-row md:items-center md:gap-4">
                      <span className="order-2 md:order-1 md:w-14 md:shrink-0">
                        <span className={cn('numeros text-meta md:text-sm', vencida ? 'font-medium text-danger' : 'text-fg-3 md:text-fg-2')}>
                          {formatarData(l.data).slice(0, 5)}
                        </span>
                        {vencida && <span className="text-meta text-danger"> · vencida</span>}
                      </span>
                      <span className="order-1 min-w-0 truncate text-body text-fg md:order-2 md:flex-1">{l.descricao}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-0.5 md:flex-row md:items-center md:gap-4">
                      <span className={cn('numeros text-body font-medium md:w-32 md:text-right', l.tipo === 'entrada' ? 'text-success' : 'text-fg')}>
                        {formatarMoedaComSinal(l.tipo === 'entrada' ? l.valorCentavos : -l.valorCentavos)}
                      </span>
                      <span className={cn('numeros inline-flex items-center justify-end gap-1 text-meta md:w-36 md:text-sm', negativo ? 'font-medium text-danger' : 'text-fg-3 md:text-fg-2')}>
                        {negativo && <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />}
                        <span className="md:sr-only">saldo </span>
                        {formatarMoedaSaldo(l.saldoApos)}
                      </span>
                    </span>
                  </>
                );
                return (
                  <li key={l.lancamentoId ? `${l.lancamentoId}-${i}` : `e-${i}`}>
                    {l.lancamentoId ? (
                      <Link
                        href={`/boletos/${l.lancamentoId}`}
                        className="group flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-surface-2/60 focus-visible:-outline-offset-2 md:gap-4 md:px-5"
                      >
                        {conteudo}
                        <ChevronRight className="hidden size-4 shrink-0 text-fg-3 group-hover:text-fg md:block" aria-hidden="true" />
                      </Link>
                    ) : (
                      <div className="flex min-h-14 items-center gap-3 px-4 py-2.5 md:gap-4 md:px-5">
                        {conteudo}
                        <span className="hidden w-4 shrink-0 md:block" aria-hidden="true" />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
