import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Valor } from '@/components/ui/valor';
import type { Centavos } from '@/lib/domain/dinheiro';

export interface Compromisso {
  rotulo: string;
  detalhe: string;
  totalCentavos: Centavos;
  href: string;
  /** data-testid no valor (os testes leem o número exibido). */
  testId: string;
}

/**
 * Próximos compromissos em lista (período à esquerda, valor à direita),
 * no lugar de uma grade de caixas. Cada linha leva à lista filtrada.
 */
export function ListaCompromissos({ itens }: { itens: readonly Compromisso[] }) {
  return (
    <ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border bg-surface">
      {itens.map((item) => (
        <li key={item.testId}>
          <Link
            href={item.href}
            className="group flex min-h-14 items-center justify-between gap-4 px-4 py-3 transition-colors duration-150 hover:bg-surface-2/60 focus-visible:-outline-offset-2"
          >
            <span className="min-w-0">
              <span className="block text-body font-medium text-fg">{item.rotulo}</span>
              <span className="block text-meta text-fg-3">{item.detalhe}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="text-body font-semibold text-fg" data-testid={item.testId}>
                <Valor centavos={item.totalCentavos} />
              </span>
              <ChevronRight
                className="size-4 text-fg-3 transition-[color,transform] duration-150 group-hover:translate-x-0.5 group-hover:text-fg"
                aria-hidden="true"
              />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
