/**
 * Totais da lista filtrada. Separa o que JÁ movimentou dinheiro (entradas e
 * pagamentos) do que ainda é obrigação/previsão (a pagar, a receber).
 * Regra dos totais: resumirTransacoes (lib/domain/transacoes.ts).
 */
import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { formatarMoeda, formatarMoedaComSinal } from '@/lib/domain/dinheiro';
import type { ResumoTransacoes } from '@/lib/domain/transacoes';
import { cn } from '@/lib/utils/cn';

interface Metrica {
  chave: string;
  rotulo: string;
  valor: string;
  classe: string;
  nota?: ReactNode;
}

export function ResumoDasTransacoes({ resumo }: { resumo: ResumoTransacoes }) {
  const metricas: Metrica[] = [
    { chave: 'entradas', rotulo: 'Entradas', valor: formatarMoedaComSinal(resumo.entradasCentavos), classe: 'text-success', nota: 'Já entrou' },
    { chave: 'pagamentos', rotulo: 'Pagamentos', valor: formatarMoedaComSinal(-resumo.pagamentosCentavos), classe: 'text-danger', nota: 'Já saiu' },
    {
      chave: 'a-pagar',
      rotulo: 'A pagar',
      valor: formatarMoeda(resumo.aPagarCentavos),
      classe: 'text-fg',
      nota:
        resumo.atrasadas > 0 ? (
          <span className="inline-flex items-center gap-1 text-danger">
            <AlertTriangle className="size-3.5" aria-hidden="true" />
            {resumo.atrasadas} {resumo.atrasadas === 1 ? 'atrasada' : 'atrasadas'}
          </span>
        ) : (
          'Em aberto'
        ),
    },
    { chave: 'a-receber', rotulo: 'A receber', valor: formatarMoeda(resumo.aReceberCentavos), classe: 'text-fg', nota: 'Entradas previstas' },
  ];

  return (
    <section aria-label="Totais" className="mb-5">
      <dl className="grid grid-cols-2 overflow-hidden rounded-lg border border-border bg-surface sm:grid-cols-4" data-testid="resumo-transacoes">
        {metricas.map((m, i) => (
          <div
            key={m.chave}
            data-testid={`total-${m.chave}`}
            className={cn('flex min-w-0 flex-col gap-0.5 px-4 py-3', i % 2 === 1 && 'border-l border-border', i >= 2 && 'border-t border-border sm:border-t-0', i === 2 && 'sm:border-l')}
          >
            <dt className="text-meta font-medium text-fg-3">{m.rotulo}</dt>
            <dd className={cn('numeros truncate text-lg font-semibold tracking-tight', m.classe)}>{m.valor}</dd>
            <dd className="text-xs text-fg-3">{m.nota}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 px-1 text-xs text-fg-3">Transferências, ajustes e compras no cartão não entram nesses totais (a compra é paga pela fatura).</p>
    </section>
  );
}
