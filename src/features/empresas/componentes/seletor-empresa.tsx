'use client';

import { Building2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import type { Empresa } from '@/lib/domain/tipos';
import { cn } from '@/lib/utils/cn';
import { selecionarEmpresa } from '../acoes';
import { TODAS_EMPRESAS } from '../constantes';

interface Props {
  empresas: Pick<Empresa, 'id' | 'apelido'>[];
  selecionadaId: string | null;
  className?: string;
}

/** Seletor global de empresa (filtra todas as telas). Oculto com 0 ou 1 empresa. */
export function SeletorEmpresa({ empresas, selecionadaId, className }: Props) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  if (empresas.length < 2) return null;

  return (
    <label className={cn('relative flex min-w-0 items-center', className)}>
      <span className="sr-only">Empresa</span>
      <Building2 className="pointer-events-none absolute left-2.5 size-4 text-fg-3" aria-hidden="true" />
      <select
        data-testid="seletor-empresa"
        value={selecionadaId ?? TODAS_EMPRESAS}
        disabled={pendente}
        onChange={(e) => {
          const valor = e.target.value;
          iniciar(async () => {
            const r = await selecionarEmpresa(valor);
            if (!r.ok) toast.error(r.erro);
            router.refresh();
          });
        }}
        className="h-10 w-full min-w-0 truncate rounded-md border border-border-strong bg-surface pr-7 pl-8 text-base font-medium text-fg focus:border-ring focus:outline-none disabled:opacity-60"
      >
        <option value={TODAS_EMPRESAS}>Todas as empresas</option>
        {empresas.map((e) => (
          <option key={e.id} value={e.id}>
            {e.apelido}
          </option>
        ))}
      </select>
    </label>
  );
}
