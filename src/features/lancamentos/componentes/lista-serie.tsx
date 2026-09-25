import Link from 'next/link';
import { Cartao, TituloSecao } from '@/components/ui/cartao';
import { SeloStatus } from '@/components/ui/selo-status';
import { Valor } from '@/components/ui/valor';
import { formatarData, type DataISO } from '@/lib/domain/datas';
import { calcularStatus } from '@/lib/domain/status';
import type { Lancamento } from '@/lib/domain/tipos';
import { cn } from '@/lib/utils/cn';

/** Todos os lançamentos de uma série (vários meses), destacando o atual. */
export function ListaSerie({ serie, atualId, hoje }: { serie: Lancamento[]; atualId: string; hoje: DataISO }) {
  return (
    <section className="mt-6" aria-labelledby="titulo-serie">
      <TituloSecao id="titulo-serie" className="mb-2 px-1">
        Lançamentos desta série
      </TituloSecao>
      <Cartao className="divide-y divide-border">
        {serie.map((l) => {
          const atual = l.id === atualId;
          return (
            <Link
              key={l.id}
              href={`/boletos/${l.id}`}
              aria-current={atual ? 'page' : undefined}
              className={cn('flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-surface-2', atual && 'bg-primary-soft')}
            >
              <span className="numeros w-10 shrink-0 text-sm font-medium text-fg-3">
                {l.recorrencia?.parcela}/{l.recorrencia?.totalParcelas}
              </span>
              <span className="min-w-0 flex-1">
                <span className="numeros block text-body text-fg">{formatarData(l.vencimento)}</span>
                <Valor centavos={l.valorCentavos} className="block text-meta text-fg-2 sm:hidden" />
              </span>
              <Valor centavos={l.valorCentavos} className="hidden text-body font-medium sm:inline" />
              <SeloStatus status={calcularStatus(l, hoje)} />
            </Link>
          );
        })}
      </Cartao>
    </section>
  );
}
