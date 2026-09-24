import Link from 'next/link';
import { cn } from '@/lib/utils/cn';

interface Chip {
  href: string;
  rotulo: string;
  ativo: boolean;
}

/** Chips de filtro (links) roláveis horizontalmente no celular. */
export function ChipsFiltro({ chips, rotulo }: { chips: Chip[]; rotulo: string }) {
  return (
    <nav aria-label={rotulo} className="sem-barra-rolagem -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
        {chips.map((c) => (
          <li key={c.href}>
            <Link
              href={c.href}
              replace
              scroll={false}
              aria-current={c.ativo ? 'true' : undefined}
              className={cn(
                'inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors',
                c.ativo
                  ? 'border-primary bg-primary text-primary-fg'
                  : 'border-border-strong bg-surface text-fg-2 hover:border-primary/50 hover:text-fg',
              )}
            >
              {c.rotulo}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
