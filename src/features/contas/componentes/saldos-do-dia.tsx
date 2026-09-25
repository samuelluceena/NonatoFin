import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Landmark } from 'lucide-react';
import { CabecalhoSecao } from '@/components/ui/cabecalho-secao';
import { Cartao } from '@/components/ui/cartao';
import { IconeLista } from '@/components/ui/lista-painel';
import { Valor } from '@/components/ui/valor';
import type { Centavos } from '@/lib/domain/dinheiro';
import { cobertura } from '@/lib/domain/saldos';
import type { ContaBancaria } from '@/lib/domain/tipos';

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
      <CabecalhoSecao id="titulo-saldos-dia" titulo="Saldo × saídas de hoje" link={{ href: '/contas', rotulo: 'Contas' }} />
      <Cartao className="divide-y divide-border-subtle" data-testid="saldos-do-dia">
        {ativas.map((c) => {
          const saldo = saldos.get(c.id) ?? 0;
          const sai = saidas.get(c.id) ?? 0;
          const { cobre, faltaCentavos } = cobertura(saldo, sai);
          return (
            <Link
              key={c.id}
              href={`/contas/${c.id}`}
              className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors duration-150 hover:bg-surface-2/60 focus-visible:-outline-offset-2"
            >
              <IconeLista>
                <Landmark />
              </IconeLista>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-medium text-fg">{c.apelido}</span>
                <span className="block truncate text-meta text-fg-3">{c.empresa.apelido}</span>
              </span>
              <span className="numeros text-right text-meta text-fg-2">
                Saldo <Valor centavos={saldo} tom="negativo-perigo" className="font-medium" />
                <span className="block">
                  Sai hoje <Valor centavos={sai} className="font-medium text-fg" />
                </span>
              </span>
              <span className="w-full text-right text-meta font-medium sm:w-24">
                {cobre ? (
                  <span className="inline-flex items-center gap-1 text-success">
                    <CheckCircle2 className="size-3.5" aria-hidden="true" /> Cobre
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-warning">
                    <AlertTriangle className="size-3.5" aria-hidden="true" /> Faltam <Valor centavos={faltaCentavos} />
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
