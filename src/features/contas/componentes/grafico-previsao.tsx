'use client';

import { useId, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { moedaCompacta } from '@/components/graficos/formatos';
import { adicionarDias, diferencaEmDias, formatarData, formatarDataCurta, type DataISO } from '@/lib/domain/datas';
import { formatarMoedaSaldo, type Centavos } from '@/lib/domain/dinheiro';
import type { LinhaPrevisao } from '@/lib/domain/saldos';
import { cn } from '@/lib/utils/cn';

interface Ponto {
  /** Dias desde hoje (0 = hoje). */
  dia: number;
  saldo: Centavos;
}

interface Props {
  saldoHoje: Centavos;
  /** Linhas de `projetarSaldo` (já na ordem do dia, entradas antes das saídas). */
  linhas: Pick<LinhaPrevisao, 'dataEfetiva' | 'saldoApos'>[];
  hoje: DataISO;
  /** Último dia da previsão. */
  ate: DataISO;
  /** `primeiroNegativo` de `projetarSaldo`. */
  primeiroNegativo: { data: DataISO; saldoCentavos: Centavos } | null;
}

/**
 * Saldo previsto dia a dia (degraus: o saldo só muda quando algo entra ou
 * sai). Cada dia mostra o saldo no FIM do dia, o mesmo critério do alerta de
 * negativo em `projetarSaldo`. Só apresentação: nenhum valor é recalculado.
 * Hover/toque/teclado (setas) mostram o saldo de cada dia; a lista
 * "Próximos N dias" logo abaixo é a versão em tabela.
 */
export function GraficoPrevisao({ saldoHoje, linhas, hoje, ate, primeiroNegativo }: Props) {
  const idBase = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [dia, setDia] = useState<number | null>(null);

  const total = Math.max(1, diferencaEmDias(hoje, ate));
  // Um ponto por dia com movimento: o saldo depois da última linha do dia.
  const pontos: Ponto[] = [{ dia: 0, saldo: saldoHoje }];
  for (const l of linhas) {
    const d = diferencaEmDias(hoje, l.dataEfetiva);
    const ultimo = pontos[pontos.length - 1];
    if (ultimo.dia === d && pontos.length > 1) ultimo.saldo = l.saldoApos;
    else if (d === 0) pontos[0] = { dia: 0, saldo: l.saldoApos };
    else pontos.push({ dia: d, saldo: l.saldoApos });
  }
  // Com movimento hoje, o traço começa no saldo de agora e desce/sobe no mesmo dia.
  const inicio = saldoHoje;

  const valores = [inicio, ...pontos.map((p) => p.saldo)];
  const menor = Math.min(0, ...valores);
  const maior = Math.max(0, ...valores);
  const folga = Math.max(1, (maior - menor) * 0.08);
  const topo = maior + folga;
  const base = menor - (menor < 0 ? folga : 0);
  const y = (v: Centavos) => ((topo - v) / (topo - base)) * 100;
  const x = (d: number) => (d / total) * 100;
  const yZero = y(0);

  const saldoNoDia = (d: number) => {
    let s = pontos[0].saldo;
    for (const p of pontos) if (p.dia <= d) s = p.saldo;
    return s;
  };

  // Linha em degraus (step-after) e a área até o zero.
  let traco = `M 0 ${y(inicio)} V ${y(pontos[0].saldo)}`;
  for (const p of pontos.slice(1)) traco += ` H ${x(p.dia)} V ${y(p.saldo)}`;
  traco += ` H 100`;
  const area = `${traco} V ${yZero} H 0 Z`;

  const menorPonto = pontos.reduce((a, p) => (p.saldo < a.saldo ? p : a), pontos[0]);
  const diaNegativo = primeiroNegativo ? diferencaEmDias(hoje, primeiroNegativo.data) : null;
  const rotuloDia = (d: number) => `${formatarDataCurta(adicionarDias(hoje, d))}: saldo previsto ${formatarMoedaSaldo(saldoNoDia(d))}`;

  // Rótulos do eixo: topo, zero e (se houver) o menor valor negativo, sem se sobreporem.
  const marcas = [{ valor: maior, pos: y(maior) }];
  if (maior !== 0) marcas.push({ valor: 0, pos: yZero });
  if (menor < 0) marcas.push({ valor: menor, pos: y(menor) });
  const visiveis = marcas.filter((m, i) => marcas.slice(0, i).every((o) => Math.abs(o.pos - m.pos) > 18));

  function mover(e: PointerEvent<HTMLDivElement>) {
    const caixa = e.currentTarget.getBoundingClientRect();
    const fracao = Math.min(1, Math.max(0, (e.clientX - caixa.left) / caixa.width));
    setDia(Math.round(fracao * total));
  }

  function teclado(e: KeyboardEvent<HTMLDivElement>) {
    const atual = dia ?? 0;
    const passo = e.shiftKey ? 7 : 1;
    const novo =
      e.key === 'ArrowRight' || e.key === 'ArrowUp' ? atual + passo
      : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? atual - passo
      : e.key === 'Home' ? 0
      : e.key === 'End' ? total
      : null;
    if (novo === null) return;
    e.preventDefault();
    setDia(Math.min(total, Math.max(0, novo)));
  }

  const clipAcima = `acima-${idBase}`;
  const clipAbaixo = `abaixo-${idBase}`;

  return (
    <figure className="m-0">
      <figcaption className="sr-only">
        Saldo previsto dia a dia até {formatarData(ate)}. Hoje {formatarMoedaSaldo(saldoHoje)}; no fim do período {formatarMoedaSaldo(pontos[pontos.length - 1].saldo)};
        menor saldo {formatarMoedaSaldo(menorPonto.saldo)} em {formatarDataCurta(adicionarDias(hoje, menorPonto.dia))}. Os valores de cada dia estão na lista de previsão abaixo.
      </figcaption>

      <div className="flex gap-2">
        {/* Eixo: só marcas de referência (topo, zero, menor negativo). */}
        <div className="relative h-28 w-12 shrink-0 text-right text-caption text-fg-3 sm:h-40" aria-hidden="true">
          {visiveis.map((m) => (
            <span key={m.valor} className={cn('numeros absolute right-0 -translate-y-1/2', m.valor === 0 && 'font-medium text-fg-2')} style={{ top: `${m.pos}%` }}>
              {m.valor === 0 ? 'R$ 0' : moedaCompacta(m.valor).replace('R$ ', '')}
            </span>
          ))}
        </div>

        <div className="relative h-28 min-w-0 flex-1 sm:h-40">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden="true">
            <defs>
              <clipPath id={clipAcima}>
                <rect x="-1" y="-1" width="102" height={yZero + 1} />
              </clipPath>
              <clipPath id={clipAbaixo}>
                <rect x="-1" y={yZero} width="102" height={101 - yZero} />
              </clipPath>
            </defs>
            <path d={area} className="fill-chart-1/10" clipPath={`url(#${clipAcima})`} />
            <path d={area} className="fill-danger/10" clipPath={`url(#${clipAbaixo})`} />
            <path d={traco} className="fill-none stroke-chart-1" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" clipPath={`url(#${clipAcima})`} />
            <path d={traco} className="fill-none stroke-danger" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" clipPath={`url(#${clipAbaixo})`} />
          </svg>

          {/* Linha do zero: a referência principal do gráfico. */}
          <div className="pointer-events-none absolute inset-x-0 border-t border-border-strong" style={{ top: `${yZero}%` }} aria-hidden="true" />

          {/* Primeiro dia negativo. */}
          {diaNegativo !== null && primeiroNegativo && (
            <span
              className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-danger ring-2 ring-surface"
              style={{ left: `${x(diaNegativo)}%`, top: `${y(primeiroNegativo.saldoCentavos)}%` }}
              aria-hidden="true"
            />
          )}

          {/* Cursor (hover/toque/teclado). */}
          {dia !== null && (
            <>
              <div className="pointer-events-none absolute inset-y-0 border-l border-fg-3/60" style={{ left: `${x(dia)}%` }} aria-hidden="true" />
              <span
                className={cn(
                  'pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface',
                  saldoNoDia(dia) < 0 ? 'bg-danger' : 'bg-chart-1',
                )}
                style={{ left: `${x(dia)}%`, top: `${y(saldoNoDia(dia))}%` }}
                aria-hidden="true"
              />
              <div
                className="pointer-events-none absolute top-1 z-10 w-max animate-esmaecer rounded-md border border-border bg-surface-elevated px-2.5 py-1.5 text-meta shadow-md"
                style={x(dia) < 50 ? { left: `calc(${x(dia)}% + 0.75rem)` } : { right: `calc(${100 - x(dia)}% + 0.75rem)` }}
                aria-hidden="true"
              >
                <p className="text-fg-3">{dia === 0 ? 'Hoje' : formatarDataCurta(adicionarDias(hoje, dia))}</p>
                <p className={cn('numeros font-semibold', saldoNoDia(dia) < 0 ? 'text-danger' : 'text-fg')}>{formatarMoedaSaldo(saldoNoDia(dia))}</p>
              </div>
            </>
          )}

          <div
            className="absolute inset-0 cursor-crosshair touch-pan-y rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2"
            onPointerMove={mover}
            onPointerDown={mover}
            onPointerLeave={() => setDia(null)}
            onKeyDown={teclado}
            onBlur={() => setDia(null)}
            tabIndex={0}
            role="slider"
            aria-label="Saldo previsto por dia"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={dia ?? 0}
            aria-valuetext={rotuloDia(dia ?? 0)}
          />
        </div>
      </div>

      <div className="mt-2 flex justify-between pl-14 text-caption text-fg-3" aria-hidden="true">
        <span>Hoje</span>
        <span className="numeros">{formatarDataCurta(adicionarDias(hoje, Math.round(total / 2)))}</span>
        <span className="numeros">{formatarDataCurta(ate)}</span>
      </div>

      {primeiroNegativo && (
        <p className="mt-2 flex items-center gap-1.5 text-meta text-fg-2">
          <span className="size-2 shrink-0 rounded-full bg-danger" aria-hidden="true" />
          Primeiro dia negativo: {formatarDataCurta(primeiroNegativo.data)}
        </p>
      )}
    </figure>
  );
}
