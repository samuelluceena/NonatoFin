import Link from 'next/link';
import { CreditCard } from 'lucide-react';
import { Cartao, TituloSecao } from '@/components/ui/cartao';
import { Valor } from '@/components/ui/valor';
import { formatarData, type DataISO } from '@/lib/domain/datas';
import { formatarMoeda, formatarMoedaComSinal, type Centavos } from '@/lib/domain/dinheiro';
import type { ParcelaCartao } from '@/lib/domain/tipos';

interface Props {
  parcelas: (ParcelaCartao & { dataCompra: DataISO })[];
  somaParcelas: Centavos;
  ajusteCentavos: Centavos;
  totalCentavos: Centavos;
}

/** Detalhe da fatura: cada parcela de compra que a compõe, a soma, o ajuste e o total. */
export function ComprasDaFatura({ parcelas, somaParcelas, ajusteCentavos, totalCentavos }: Props) {
  return (
    <section className="mt-6" aria-labelledby="titulo-parcelas">
      <div className="mb-2 flex items-baseline justify-between px-1">
        <TituloSecao id="titulo-parcelas">Compras nesta fatura</TituloSecao>
        <span className="text-sm text-fg-3">
          {parcelas.length} {parcelas.length === 1 ? 'item' : 'itens'}
        </span>
      </div>
      <Cartao className="divide-y divide-border">
        {parcelas.length === 0 && <p className="p-4 text-sm text-fg-2">Nenhuma compra nesta fatura.</p>}
        {parcelas.map((p) => (
          <Link
            key={p.id}
            href={`/cartoes/compras/${p.compraId}/editar`}
            className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-surface-2"
            data-testid="parcela-fatura"
          >
            <CreditCard className="size-4 shrink-0 text-fg-3" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body text-fg">{p.compraDescricao}</span>
              <span className="numeros block text-meta text-fg-3">
                {p.dataCompra && formatarData(p.dataCompra)}
                {p.total > 1 ? ` · Parcela ${p.numero}/${p.total}` : ' · À vista'}
              </span>
            </span>
            <Valor centavos={p.valorCentavos} className="shrink-0 text-body font-medium" />
          </Link>
        ))}
        <dl className="numeros grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-4 py-3 text-sm" data-testid="totais-fatura">
          <dt className="text-fg-2">Soma das compras</dt>
          <dd className="text-right">{formatarMoeda(somaParcelas)}</dd>
          {ajusteCentavos !== 0 && (
            <>
              <dt className="text-fg-2">Ajuste</dt>
              <dd className="text-right">{formatarMoedaComSinal(ajusteCentavos)}</dd>
            </>
          )}
          <dt className="font-medium text-fg">Total da fatura</dt>
          <dd className="text-right font-semibold">{formatarMoeda(totalCentavos)}</dd>
        </dl>
      </Cartao>
    </section>
  );
}
