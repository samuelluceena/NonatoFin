'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CreditCard, LogOut, Plus } from 'lucide-react';
import { SeletorEmpresa } from '@/features/empresas/componentes/seletor-empresa';
import { LinkBotao } from '@/components/ui/botao';
import { sair } from '@/features/auth/acoes';
import { APP } from '@/lib/config';
import { cn } from '@/lib/utils/cn';
import { Logo } from './logo';
import { ITENS_NAVEGACAO, estaAtivo } from './navegacao';
import { SeletorTemaCompacto } from './seletor-tema';

/** Navegação lateral fixa (a partir de 1024px). */
interface Props {
  email: string;
  empresas: { id: string; apelido: string }[];
  selecionadaId: string | null;
}

export function MenuLateral({ email, empresas, selecionadaId }: Props) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col overflow-y-auto border-r border-border bg-surface px-4 py-5 lg:flex">
      <Link href="/" className="mb-6 rounded-md px-2 py-1" aria-label={`${APP.nome} — início`}>
        <Logo />
      </Link>
      <SeletorEmpresa empresas={empresas} selecionadaId={selecionadaId} className="mb-4" />
      <LinkBotao href="/boletos/novo" larguraTotal icone={<Plus className="size-5" aria-hidden="true" />} className="mb-2">
        Novo boleto
      </LinkBotao>
      <LinkBotao href="/cartoes/compras/nova" variante="secundario" larguraTotal icone={<CreditCard className="size-4.5" aria-hidden="true" />} className="mb-5">
        Compra no cartão
      </LinkBotao>
      <nav aria-label="Principal" className="flex flex-1 flex-col gap-1">
        {ITENS_NAVEGACAO.map((item) => {
          const ativo = estaAtivo(pathname, item.href);
          const Icone = item.icone;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={ativo ? 'page' : undefined}
              className={cn(
                'flex h-11 items-center gap-3 rounded-md px-3 text-[15px] font-medium transition-colors',
                ativo ? 'bg-primary-soft text-primary-soft-fg' : 'text-fg-2 hover:bg-surface-2 hover:text-fg',
              )}
            >
              <Icone className="size-5" aria-hidden="true" />
              {item.rotulo}
            </Link>
          );
        })}
      </nav>
      <div className="mt-4 border-t border-border pt-4">
        <p className="truncate px-2 text-[13px] text-fg-3" title={email}>
          {email}
        </p>
        <div className="mt-2 flex items-center gap-1">
          <form action={sair} className="flex-1">
            <button
              type="submit"
              className="flex h-11 w-full items-center gap-2 rounded-md px-2 text-sm font-medium text-fg-2 hover:bg-surface-2 hover:text-fg"
            >
              <LogOut className="size-4.5" aria-hidden="true" />
              Sair
            </button>
          </form>
          <SeletorTemaCompacto />
        </div>
      </div>
    </aside>
  );
}
