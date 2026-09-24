'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { CreditCard, LogOut, Menu, Plus, ReceiptText } from 'lucide-react';
import { Dialogo } from '@/components/ui/dialogo';
import { sair } from '@/features/auth/acoes';
import { cn } from '@/lib/utils/cn';
import {
  NAV_INFERIOR_DIREITA,
  NAV_INFERIOR_ESQUERDA,
  NAV_MAIS,
  estaAtivo,
  itemPorHref,
} from './navegacao';

function ItemBarra({ href, pathname }: { href: string; pathname: string }) {
  const item = itemPorHref(href);
  const ativo = estaAtivo(pathname, href);
  const Icone = item.icone;
  return (
    <Link
      href={href}
      aria-current={ativo ? 'page' : undefined}
      className={cn(
        'flex h-16 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium',
        ativo ? 'text-primary-text' : 'text-fg-3',
      )}
    >
      <Icone className="size-[22px]" aria-hidden="true" strokeWidth={ativo ? 2.25 : 1.9} />
      {item.rotulo}
    </Link>
  );
}

/** Barra de navegação inferior (celular e tablet, abaixo de 1024px). */
export function BarraInferior() {
  const pathname = usePathname();
  const [maisAberto, setMaisAberto] = useState(false);
  const [novoAberto, setNovoAberto] = useState(false);
  const maisAtivo = NAV_MAIS.some((href) => estaAtivo(pathname, href));

  return (
    <>
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-safe backdrop-blur-md lg:hidden"
      >
        <div className="mx-auto flex max-w-xl items-stretch px-1">
          {NAV_INFERIOR_ESQUERDA.map((href) => (
            <ItemBarra key={href} href={href} pathname={pathname} />
          ))}
          <div className="flex flex-1 items-center justify-center">
            <button
              type="button"
              onClick={() => setNovoAberto(true)}
              aria-haspopup="dialog"
              aria-label="Novo lançamento"
              className="grid size-13 place-items-center rounded-full bg-primary text-primary-fg shadow-md transition-transform active:scale-95"
            >
              <Plus className="size-7" aria-hidden="true" />
            </button>
          </div>
          {NAV_INFERIOR_DIREITA.map((href) => (
            <ItemBarra key={href} href={href} pathname={pathname} />
          ))}
          <button
            type="button"
            onClick={() => setMaisAberto(true)}
            aria-haspopup="dialog"
            className={cn(
              'flex h-16 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium',
              maisAtivo ? 'text-primary-text' : 'text-fg-3',
            )}
          >
            <Menu className="size-[22px]" aria-hidden="true" />
            Mais
          </button>
        </div>
      </nav>

      <Dialogo aberto={novoAberto} onFechar={() => setNovoAberto(false)} titulo="Novo lançamento">
        <nav aria-label="Tipo de lançamento" className="grid gap-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Link
            href="/boletos/novo"
            onClick={() => setNovoAberto(false)}
            className="flex min-h-16 items-center gap-3 rounded-lg border border-border bg-surface-2 p-4 hover:border-border-strong"
          >
            <ReceiptText className="size-6 text-primary-text" aria-hidden="true" />
            <span>
              <span className="block text-[15px] font-semibold text-fg">Boleto ou conta</span>
              <span className="block text-[13px] text-fg-2">Fornecedor, empréstimo, despesa fixa ou variada</span>
            </span>
          </Link>
          <Link
            href="/cartoes/compras/nova"
            onClick={() => setNovoAberto(false)}
            className="flex min-h-16 items-center gap-3 rounded-lg border border-border bg-surface-2 p-4 hover:border-border-strong"
          >
            <CreditCard className="size-6 text-primary-text" aria-hidden="true" />
            <span>
              <span className="block text-[15px] font-semibold text-fg">Compra no cartão</span>
              <span className="block text-[13px] text-fg-2">À vista ou parcelada; entra na fatura certa</span>
            </span>
          </Link>
        </nav>
      </Dialogo>

      <Dialogo aberto={maisAberto} onFechar={() => setMaisAberto(false)} titulo="Menu">
        <nav aria-label="Mais opções" className="grid grid-cols-2 gap-2 pb-2">
          {NAV_MAIS.map((href) => {
            const item = itemPorHref(href);
            const Icone = item.icone;
            const ativo = estaAtivo(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMaisAberto(false)}
                aria-current={ativo ? 'page' : undefined}
                className={cn(
                  'flex h-20 flex-col items-start justify-between rounded-lg border p-3 text-[15px] font-medium transition-colors',
                  ativo
                    ? 'border-primary/40 bg-primary-soft text-primary-soft-fg'
                    : 'border-border bg-surface-2 text-fg hover:border-border-strong',
                )}
              >
                <Icone className="size-5" aria-hidden="true" />
                {item.rotulo}
              </Link>
            );
          })}
        </nav>
        <form action={sair} className="border-t border-border py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="submit"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-md text-[15px] font-medium text-danger hover:bg-danger-soft"
          >
            <LogOut className="size-5" aria-hidden="true" />
            Sair
          </button>
        </form>
      </Dialogo>
    </>
  );
}
