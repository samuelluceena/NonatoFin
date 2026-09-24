'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { useState, useTransition } from 'react';
import { Seletor } from '@/components/ui/campo';
import { Spinner } from '@/components/ui/spinner';
import type { Fornecedor } from '@/lib/domain/tipos';

interface Props {
  busca: string;
  fornecedorId: string;
  fornecedores: Fornecedor[];
  de: string;
  ate: string;
}

/** Pesquisa + fornecedor do histórico (mantém o período escolhido). */
export function FiltrosHistorico({ busca, fornecedorId, fornecedores, de, ate }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [texto, setTexto] = useState(busca);
  const [pendente, iniciar] = useTransition();

  function ir(params: { q?: string; fornecedor?: string }) {
    const sp = new URLSearchParams();
    const q = params.q ?? texto.trim();
    const f = params.fornecedor ?? fornecedorId;
    if (q) sp.set('q', q);
    if (f) sp.set('fornecedor', f);
    if (de) sp.set('de', de);
    if (ate) sp.set('ate', ate);
    const qs = sp.toString();
    iniciar(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <form
        role="search"
        className="relative flex-1"
        onSubmit={(e) => {
          e.preventDefault();
          ir({});
        }}
      >
        <label htmlFor="busca-historico" className="sr-only">
          Pesquisar no histórico
        </label>
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-fg-3" aria-hidden="true" />
        <input
          id="busca-historico"
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={() => texto.trim() !== busca && ir({})}
          placeholder="Pesquisar fornecedor, nome ou descrição"
          enterKeyHint="search"
          autoComplete="off"
          className="h-12 w-full rounded-md border border-border-strong bg-surface pr-10 pl-11 text-fg placeholder:text-fg-3 focus:border-ring focus:ring-2 focus:ring-ring/25 focus:outline-none"
        />
        {pendente && (
          <span className="absolute top-1/2 right-3 -translate-y-1/2 text-fg-3">
            <Spinner />
          </span>
        )}
      </form>
      <label htmlFor="historico-fornecedor" className="sr-only">
        Fornecedor
      </label>
      <Seletor id="historico-fornecedor" value={fornecedorId} onChange={(e) => ir({ fornecedor: e.target.value })} className="sm:max-w-xs">
        <option value="">Todos os fornecedores</option>
        {fornecedores.map((f) => (
          <option key={f.id} value={f.id}>
            {f.nome}
          </option>
        ))}
      </Seletor>
    </div>
  );
}
