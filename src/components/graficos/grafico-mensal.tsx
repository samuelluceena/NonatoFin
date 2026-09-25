'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatarMes, formatarMesCurto } from '@/lib/domain/datas';
import { formatarMoeda } from '@/lib/domain/dinheiro';
import type { ResumoMes } from '@/lib/domain/tipos';
import { cn } from '@/lib/utils/cn';
import { moedaCompacta } from './formatos';

const ALTURA = 176; // px da área de plotagem

/** Topo "redondo" do eixo (1, 2, 2,5 ou 5 × 10ⁿ reais) para as linhas de grade. */
function topoDoEixo(maximoCentavos: number): number {
  const reais = Math.max(1, maximoCentavos / 100);
  const potencia = 10 ** Math.floor(Math.log10(reais));
  const passo = [1, 2, 2.5, 5, 10].find((m) => m * potencia >= reais) ?? 10;
  return passo * potencia * 100;
}

/**
 * Colunas empilhadas por mês: "Pago" (base) + "Em aberto" (pendente + atrasado).
 * Eixo e grade discretos; dica flutuante no hover/foco com os valores; no
 * toque, a coluna abre o mês. Valores também em texto (aria-label e tabela).
 */
export function GraficoMensal({ meses, mesAtual }: { meses: ResumoMes[]; mesAtual: string }) {
  const [ativo, setAtivo] = useState<string | null>(null);
  const topo = topoDoEixo(Math.max(1, ...meses.map((m) => m.totalCentavos)));
  const indiceAtivo = meses.findIndex((m) => m.mes === ativo);
  const selecionado = indiceAtivo >= 0 ? meses[indiceAtivo] : null;
  const grades = [1, 0.5, 0];

  return (
    <figure className="m-0">
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-meta text-fg-2" aria-hidden="true">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px] bg-chart-1" /> Em aberto
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px] bg-chart-2" /> Pago
        </span>
      </div>

      <div className="flex gap-2">
        {/* eixo: 3 marcas (topo, metade, zero) */}
        <div className="relative w-12 shrink-0 text-right text-caption text-fg-3" style={{ height: ALTURA }} aria-hidden="true">
          {grades.map((g) => (
            <span key={g} className="numeros absolute right-0 -translate-y-1/2" style={{ top: (1 - g) * ALTURA }}>
              {g === 0 ? '0' : moedaCompacta(topo * g).replace('R$ ', '')}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1" onMouseLeave={() => setAtivo(null)}>
          {grades.map((g) => (
            <div
              key={g}
              className={cn('pointer-events-none absolute inset-x-0 border-t', g === 0 ? 'border-border-strong' : 'border-border-subtle')}
              style={{ top: (1 - g) * ALTURA }}
              aria-hidden="true"
            />
          ))}

          {selecionado && (
            <div
              className="pointer-events-none absolute z-10 w-52 animate-esmaecer rounded-md border border-border bg-surface-elevated px-3 py-2 text-meta shadow-md"
              style={(() => {
                // Ao lado da coluna ativa (nunca por cima dela).
                const centro = ((indiceAtivo + 0.5) / meses.length) * 100;
                return centro < 50 ? { top: 8, left: `calc(${centro}% + 1.25rem)` } : { top: 8, right: `calc(${100 - centro}% + 1.25rem)` };
              })()}
              aria-hidden="true"
            >
              <p className="mb-1 font-medium text-fg">{formatarMes(selecionado.mes)}</p>
              <p className="flex items-center justify-between gap-2 text-fg-2">
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <span className="size-2 rounded-[2px] bg-chart-1" /> Em aberto
                </span>
                <span className="numeros text-fg">{formatarMoeda(selecionado.pendenteCentavos + selecionado.atrasadoCentavos)}</span>
              </p>
              <p className="flex items-center justify-between gap-2 text-fg-2">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-[2px] bg-chart-2" /> Pago
                </span>
                <span className="numeros text-fg">{formatarMoeda(selecionado.pagoCentavos)}</span>
              </p>
              <p className="mt-1 flex justify-between gap-2 border-t border-border-subtle pt-1 font-medium text-fg">
                <span>Total</span>
                <span className="numeros">{formatarMoeda(selecionado.totalCentavos)}</span>
              </p>
            </div>
          )}

          <div className="relative grid gap-1.5 sm:gap-3" style={{ gridTemplateColumns: `repeat(${meses.length}, minmax(0, 1fr))` }}>
            {meses.map((m) => {
              const aberto = m.pendenteCentavos + m.atrasadoCentavos;
              const hPago = (m.pagoCentavos / topo) * ALTURA;
              const hAberto = (aberto / topo) * ALTURA;
              const destaque = ativo === m.mes;
              return (
                <Link
                  key={m.mes}
                  href={`/meses/${m.mes}`}
                  prefetch={false}
                  onMouseEnter={() => setAtivo(m.mes)}
                  onFocus={() => setAtivo(m.mes)}
                  onBlur={() => setAtivo(null)}
                  aria-label={`${formatarMes(m.mes)}: total ${formatarMoeda(m.totalCentavos)}, em aberto ${formatarMoeda(aberto)}, pago ${formatarMoeda(m.pagoCentavos)}`}
                  className="group flex flex-col items-center rounded-sm focus-visible:outline-2"
                >
                  <div
                    className={cn('flex w-full max-w-9 flex-col justify-end transition-opacity duration-150', ativo && !destaque && 'opacity-40')}
                    style={{ height: ALTURA }}
                  >
                    {aberto > 0 && (
                      <div className="w-full rounded-t-[4px] bg-chart-1" style={{ height: Math.max(2, hAberto), marginBottom: m.pagoCentavos > 0 ? 2 : 0 }} />
                    )}
                    {m.pagoCentavos > 0 && <div className={cn('w-full bg-chart-2', aberto === 0 && 'rounded-t-[4px]')} style={{ height: Math.max(2, hPago) }} />}
                  </div>
                  <span className={cn('mt-2 text-caption text-fg-3', m.mes === mesAtual && 'font-semibold text-fg')}>
                    {/* No celular só o mês (3 letras) para os rótulos não se sobreporem. */}
                    <span className="sm:hidden">{formatarMesCurto(m.mes).slice(0, 3)}</span>
                    <span className="hidden sm:inline">{formatarMesCurto(m.mes)}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {selecionado
          ? `${formatarMes(selecionado.mes)}: em aberto ${formatarMoeda(selecionado.pendenteCentavos + selecionado.atrasadoCentavos)}, pago ${formatarMoeda(selecionado.pagoCentavos)}, total ${formatarMoeda(selecionado.totalCentavos)}.`
          : ''}
      </p>

      <p className="mt-3 text-meta text-fg-3">Toque ou clique em um mês para ver os boletos.</p>

      <details className="mt-1 text-sm">
        <summary className="cursor-pointer py-1 text-meta font-medium text-primary-text">Ver tabela</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="numeros w-full text-left text-meta">
            <thead className="text-fg-3">
              <tr>
                <th className="py-1.5 pr-2 font-medium">Mês</th>
                <th className="py-1.5 pr-2 text-right font-medium">Em aberto</th>
                <th className="py-1.5 pr-2 text-right font-medium">Pago</th>
                <th className="py-1.5 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {meses.map((m) => (
                <tr key={m.mes} className="border-t border-border-subtle">
                  <td className="py-1.5 pr-2 text-fg-2">{formatarMes(m.mes)}</td>
                  <td className="py-1.5 pr-2 text-right">{formatarMoeda(m.pendenteCentavos + m.atrasadoCentavos)}</td>
                  <td className="py-1.5 pr-2 text-right">{formatarMoeda(m.pagoCentavos)}</td>
                  <td className="py-1.5 text-right font-medium">{formatarMoeda(m.totalCentavos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <figcaption className="sr-only">Valores por mês de vencimento</figcaption>
    </figure>
  );
}
