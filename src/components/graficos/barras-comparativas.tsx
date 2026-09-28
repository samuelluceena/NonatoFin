'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Segmentado } from '@/components/ui/segmentado';
import { formatarMoeda } from '@/lib/domain/dinheiro';
import { valorDaMetrica } from '@/lib/domain/indicadores';
import type { MetricaFornecedor, ResumoStatus } from '@/lib/domain/tipos';

const METRICAS: { valor: MetricaFornecedor; rotulo: string }[] = [
  { valor: 'total', rotulo: 'Total' },
  { valor: 'pendente', rotulo: 'A pagar' },
  { valor: 'pago', rotulo: 'Pago' },
  { valor: 'atrasado', rotulo: 'Atrasado' },
];

export interface ItemComparativo {
  id: string;
  nome: string;
  href?: string;
  resumo: ResumoStatus;
}

/**
 * Barras horizontais comparando grupos (fornecedores, empresas, categorias)
 * pela métrica escolhida. Série única com rótulo direto de nome e valor.
 */
export function BarrasComparativas({
  itens,
  nome,
  rotulo = 'Comparar por',
  limite = 8,
}: {
  itens: ItemComparativo[];
  /** Nome único do grupo de botões de métrica (acessibilidade). */
  nome: string;
  /** Rótulo acessível do grupo de métricas (distinto quando há vários na tela). */
  rotulo?: string;
  limite?: number;
}) {
  const [metrica, setMetrica] = useState<MetricaFornecedor>('total');

  const linhas = useMemo(
    () =>
      [...itens]
        .sort(
          (a, b) =>
            valorDaMetrica(b.resumo, metrica) - valorDaMetrica(a.resumo, metrica) ||
            a.nome.localeCompare(b.nome, 'pt-BR'),
        )
        .filter((r) => valorDaMetrica(r.resumo, metrica) > 0)
        .slice(0, limite),
    [itens, metrica, limite],
  );
  const maximo = Math.max(1, ...linhas.map((r) => valorDaMetrica(r.resumo, metrica)));
  const cor = metrica === 'pago' ? 'bg-chart-2' : metrica === 'atrasado' ? 'bg-chart-3' : 'bg-chart-1';

  return (
    <div>
      <Segmentado nome={nome} rotulo={rotulo} ocultarRotulo opcoes={METRICAS} valor={metrica} onChange={setMetrica} className="mb-4" />
      {linhas.length === 0 ? (
        <p className="py-8 text-center text-sm text-fg-3">Nenhum valor nesta métrica.</p>
      ) : (
        <ol className="flex flex-col gap-3.5">
          {linhas.map((r, i) => {
            const valor = valorDaMetrica(r.resumo, metrica);
            const conteudo = (
              <>
                <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-fg transition-colors group-hover:text-primary-text">
                    <span className="numeros mr-2 inline-block w-4 text-right text-caption text-fg-3">{i + 1}</span>
                    {r.nome}
                  </span>
                  <span className="numeros shrink-0 font-medium text-fg">{formatarMoeda(valor)}</span>
                </div>
                <div className="ml-6 h-1.5 rounded-[4px] bg-chart-track">
                  <div className={`h-1.5 rounded-[4px] ${cor}`} style={{ width: `${Math.max(1.5, (valor / maximo) * 100)}%` }} />
                </div>
              </>
            );
            return (
              <li key={r.id}>
                {r.href ? (
                  <Link href={r.href} prefetch={false} className="group -m-1 block rounded-sm p-1 focus-visible:outline-2">
                    {conteudo}
                  </Link>
                ) : (
                  <div>{conteudo}</div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
