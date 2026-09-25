import Link from 'next/link';
import { Cartao, TituloSecao } from '@/components/ui/cartao';
import { formatarData } from '@/lib/domain/datas';
import { formatarMoedaComSinal, formatarMoedaSaldo } from '@/lib/domain/dinheiro';
import type { EventoPrevisto, LinhaPrevisao } from '@/lib/domain/saldos';
import { cn } from '@/lib/utils/cn';

type Linha = LinhaPrevisao<EventoPrevisto & { lancamentoId?: string }>;

/** Próximas saídas e entradas previstas, com o saldo depois de cada uma. */
export function PrevisaoConta({ linhas, dias }: { linhas: Linha[]; dias: number }) {
  return (
    <section aria-labelledby="titulo-previsao" className="mt-6">
      <TituloSecao id="titulo-previsao" className="mb-2 px-1">
        Próximos {dias} dias
      </TituloSecao>
      <Cartao className="divide-y divide-border" data-testid="previsao">
        {linhas.length === 0 && <p className="p-4 text-sm text-fg-2">Nada previsto para esta conta.</p>}
        {linhas.map((l, i) => {
          const conteudo = (
            <>
              <span className={cn('numeros w-12 shrink-0 text-meta', l.data < l.dataEfetiva ? 'font-medium text-danger' : 'text-fg-3')}>
                {formatarData(l.data).slice(0, 5)}
              </span>
              <span className="min-w-0 flex-1 truncate text-body text-fg">{l.descricao}</span>
              <span className="text-right">
                <span className={cn('numeros block text-body font-medium', l.tipo === 'entrada' ? 'text-success' : 'text-fg')}>
                  {formatarMoedaComSinal(l.tipo === 'entrada' ? l.valorCentavos : -l.valorCentavos)}
                </span>
                <span className={cn('numeros block text-caption', l.saldoApos < 0 ? 'font-medium text-danger' : 'text-fg-3')}>
                  saldo {formatarMoedaSaldo(l.saldoApos)}
                </span>
              </span>
            </>
          );
          return l.lancamentoId ? (
            <Link key={`${l.lancamentoId}-${i}`} href={`/boletos/${l.lancamentoId}`} className="flex min-h-14 items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
              {conteudo}
            </Link>
          ) : (
            <div key={`e-${i}`} className="flex min-h-14 items-center gap-3 px-4 py-2.5">
              {conteudo}
            </div>
          );
        })}
      </Cartao>
    </section>
  );
}
