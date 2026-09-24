'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatarMes, formatarMesCurto } from '@/lib/domain/datas';
import { formatarMoeda } from '@/lib/domain/dinheiro';
import type { ResumoMes } from '@/lib/domain/tipos';
import { cn } from '@/lib/utils/cn';
import { moedaCompacta } from './formatos';

const ALTURA = 160; // px da área de plotagem

/**
 * Colunas empilhadas por mês: "Pago" (base) + "Em aberto" (pendente + atrasado).
 * Paleta validada para daltonismo; legenda sempre visível; valores em texto
 * no tooltip (toque/hover/foco) e na tabela acessível.
 */
export function GraficoMensal({ meses, mesAtual }: { meses: ResumoMes[]; mesAtual: string }) {
  const [ativo, setAtivo] = useState<string | null>(null);
  const maximo = Math.max(1, ...meses.map((m) => m.totalCentavos));
  const selecionado = meses.find((m) => m.mes === ativo) ?? null;

  return (
    <figure className="m-0">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-fg-2" aria-hidden="true">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px] bg-chart-1" /> Em aberto
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px] bg-chart-2" /> Pago
        </span>
      </div>

      <div className="relative" onMouseLeave={() => setAtivo(null)}>
        {/* linha de base e grade recessiva */}
        <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border" style={{ top: 0 }} />
        <div className="pointer-events-none absolute inset-x-0 border-t border-border" style={{ top: ALTURA }} />

        <div className="grid gap-1.5 sm:gap-2" style={{ gridTemplateColumns: `repeat(${meses.length}, minmax(0, 1fr))` }}>
          {meses.map((m) => {
            const aberto = m.pendenteCentavos + m.atrasadoCentavos;
            const hPago = (m.pagoCentavos / maximo) * ALTURA;
            const hAberto = (aberto / maximo) * ALTURA;
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
                  className={cn(
                    'flex w-full max-w-10 flex-col justify-end transition-opacity',
                    ativo && !destaque && 'opacity-45',
                  )}
                  style={{ height: ALTURA }}
                >
                  {aberto > 0 && (
                    <div
                      className="w-full rounded-t-[4px] bg-chart-1"
                      style={{ height: Math.max(2, hAberto), marginBottom: m.pagoCentavos > 0 ? 2 : 0 }}
                    />
                  )}
                  {m.pagoCentavos > 0 && (
                    <div
                      className={cn('w-full bg-chart-2', aberto === 0 && 'rounded-t-[4px]')}
                      style={{ height: Math.max(2, hPago) }}
                    />
                  )}
                </div>
                <span
                  className={cn(
                    'mt-1.5 text-[11px] leading-tight text-fg-3 sm:text-xs',
                    m.mes === mesAtual && 'font-semibold text-fg',
                  )}
                >
                  {formatarMesCurto(m.mes)}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="mt-3 min-h-11 rounded-md bg-surface-2 px-3 py-2 text-[13px]" aria-live="polite">
          {selecionado ? (
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <span className="font-semibold text-fg">{formatarMes(selecionado.mes)}</span>
              <span className="numeros text-fg-2">Total {formatarMoeda(selecionado.totalCentavos)}</span>
              <span className="numeros text-fg-2">
                Em aberto {formatarMoeda(selecionado.pendenteCentavos + selecionado.atrasadoCentavos)}
              </span>
              <span className="numeros text-fg-2">Pago {formatarMoeda(selecionado.pagoCentavos)}</span>
            </div>
          ) : (
            <span className="text-fg-3">
              Maior mês: {moedaCompacta(maximo)}. Toque em um mês para abrir os detalhes.
            </span>
          )}
        </div>
      </div>

      <details className="mt-2 text-sm">
        <summary className="cursor-pointer py-2 text-primary-text">Ver tabela</summary>
        <div className="overflow-x-auto">
          <table className="numeros w-full text-left text-[13px]">
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
                <tr key={m.mes} className="border-t border-border">
                  <td className="py-1.5 pr-2">{formatarMes(m.mes)}</td>
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
