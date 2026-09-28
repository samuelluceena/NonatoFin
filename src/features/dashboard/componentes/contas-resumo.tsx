import Link from 'next/link';
import { CabecalhoSecao } from '@/components/ui/cabecalho-secao';
import { Valor } from '@/components/ui/valor';
import type { SaldoDaConta } from '@/lib/domain/saldos';

/** Quantas contas aparecem no Dashboard; as demais ficam em /contas. */
const LIMITE = 4;

/**
 * Saldo por conta como contexto do saldo total: linha compacta (nome + saldo),
 * sem cards grandes. No celular, a faixa rola na horizontal dentro dela mesma.
 * Só apresentação: os saldos vêm de agruparSaldos.
 */
export function ContasResumo({ contas }: { contas: readonly SaldoDaConta[] }) {
  if (contas.length === 0) return null;
  const visiveis = contas.slice(0, LIMITE);
  const restantes = contas.length - visiveis.length;

  return (
    <section aria-labelledby="titulo-contas-dashboard">
      <CabecalhoSecao
        id="titulo-contas-dashboard"
        titulo="Saldo por conta"
        link={restantes > 0 ? { href: '/contas', rotulo: `Ver todas (${contas.length})` } : undefined}
      />
      <ul className="flex snap-x gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-4">
        {visiveis.map(({ conta, saldoCentavos }) => (
          <li key={conta.id} className="w-44 shrink-0 snap-start sm:w-auto">
            <Link
              href={`/contas/${conta.id}`}
              className="flex h-full min-h-12 flex-col justify-center rounded-md border border-border-subtle bg-surface px-3 py-2.5 transition-colors duration-150 hover:bg-surface-2 focus-visible:-outline-offset-2"
            >
              <span className="flex min-w-0 items-baseline gap-1.5 text-meta text-fg-2">
                <span className="truncate font-medium">{conta.apelido}</span>
                {conta.final && <span className="numeros shrink-0 text-fg-3">•••• {conta.final}</span>}
              </span>
              <span className="mt-0.5 text-body font-semibold text-fg">
                <Valor centavos={saldoCentavos} tom="negativo-perigo" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
