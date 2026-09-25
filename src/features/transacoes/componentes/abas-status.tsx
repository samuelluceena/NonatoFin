import Link from 'next/link';
import { consultaDosFiltrosTransacoes, rotuloStatusFiltro, type FiltrosTransacoes, type StatusFiltroTransacao } from '@/lib/domain/transacoes';
import { cn } from '@/lib/utils/cn';

/** Atalhos mais usados; os demais status seguem no seletor da barra de filtros. */
const ABAS: { status: StatusFiltroTransacao; rotulo: string }[] = [
  { status: 'todos', rotulo: 'Todos' },
  { status: 'em-aberto', rotulo: rotuloStatusFiltro('em-aberto') },
  { status: 'atrasados', rotulo: rotuloStatusFiltro('atrasados') },
  { status: 'pagos', rotulo: rotuloStatusFiltro('pagos') },
];

/**
 * Abas de status: atalho para o mesmo filtro `status` da URL. Cada aba mantém
 * os demais filtros e volta para a primeira página. Só apresentação: a regra
 * de cada status está em lib/domain/transacoes.ts.
 */
export function AbasStatus({ filtros }: { filtros: FiltrosTransacoes }) {
  return (
    <nav aria-label="Status das transações" className="mb-4 border-b border-border">
      <ul className="sem-barra-rolagem -mb-px flex gap-1 overflow-x-auto">
        {ABAS.map((aba) => {
          const ativa = filtros.status === aba.status;
          return (
            <li key={aba.status} className="shrink-0">
              <Link
                href={`/transacoes${consultaDosFiltrosTransacoes({ ...filtros, status: aba.status })}`}
                scroll={false}
                replace
                aria-current={ativa ? 'true' : undefined}
                className={cn(
                  'inline-flex h-11 items-center border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors duration-150 focus-visible:-outline-offset-2 lg:h-10',
                  ativa ? 'border-primary text-fg' : 'border-transparent text-fg-3 hover:border-border-strong hover:text-fg',
                )}
              >
                {aba.rotulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
