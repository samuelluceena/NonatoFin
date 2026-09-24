import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Landmark } from 'lucide-react';
import { Cartao } from '@/components/ui/cartao';
import { Valor } from '@/components/ui/valor';
import type { Centavos } from '@/lib/domain/dinheiro';
import { cobertura } from '@/lib/domain/saldos';
import type { ContaBancaria } from '@/lib/domain/tipos';
import { cn } from '@/lib/utils/cn';

interface Props {
  contas: ContaBancaria[];
  saldos: ReadonlyMap<string, Centavos>;
  /** Por conta: contas pendentes vencidas até hoje (o que precisa sair hoje). */
  saidas: ReadonlyMap<string, Centavos>;
}

/** Tela Hoje: saldo de cada conta × o que precisa sair hoje. */
export function SaldosDoDia({ contas, saldos, saidas }: Props) {
  const ativas = contas.filter((c) => c.ativa);
  if (ativas.length === 0) return null;
  return (
    <section aria-labelledby="titulo-saldos-dia">
      <h2 id="titulo-saldos-dia" className="mb-3 flex items-center gap-2 text-lg font-semibold text-fg">
        <Landmark className="size-5 text-primary-text" aria-hidden="true" />
        Saldo × saídas de hoje
      </h2>
      <Cartao className="divide-y divide-border" data-testid="saldos-do-dia">
        {ativas.map((c) => {
          const saldo = saldos.get(c.id) ?? 0;
          const sai = saidas.get(c.id) ?? 0;
          const { cobre, faltaCentavos } = cobertura(saldo, sai);
          return (
            <Link key={c.id} href={`/contas/${c.id}`} className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-surface-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium text-fg">{c.apelido}</span>
                <span className="block truncate text-[13px] text-fg-3">{c.empresa.apelido}</span>
              </span>
              <span className="numeros text-right text-[13px] text-fg-2">
                saldo <Valor centavos={saldo} className={cn('font-medium', saldo < 0 ? 'text-danger' : 'text-fg')} />
                <span className="block">
                  sai hoje <Valor centavos={sai} className="font-medium text-fg" />
                </span>
              </span>
              <span className="w-full text-right text-[13px] font-medium sm:w-24">
                {cobre ? (
                  <span className="inline-flex items-center gap-1 text-success">
                    <CheckCircle2 className="size-3.5" aria-hidden="true" /> cobre
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-danger">
                    <AlertTriangle className="size-3.5" aria-hidden="true" /> faltam <Valor centavos={faltaCentavos} />
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </Cartao>
    </section>
  );
}
