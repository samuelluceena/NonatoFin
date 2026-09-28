'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { ChevronRight, LogOut, Menu } from 'lucide-react';
import { Dialogo } from '@/components/ui/dialogo';
import { sair } from '@/features/auth/acoes';
import { cn } from '@/lib/utils/cn';
import { AcoesRapidas } from './acoes-rapidas';
import { GRUPOS_MAIS, NAV_INFERIOR_DIREITA, NAV_INFERIOR_ESQUERDA, NAV_MAIS, estaAtivo, itemPorHref } from './navegacao';

const CLASSE_ITEM = 'flex h-full flex-col items-center justify-center gap-0.5 text-caption font-medium transition-colors duration-150';

/** Ícone com "pílula" atrás quando ativo (indicador claro, sem depender só de cor: o texto também muda de peso). */
function IconeItem({ ativo, children }: { ativo: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        'grid h-7 w-12 place-items-center rounded-full transition-colors duration-150 [&_svg]:size-5',
        ativo ? 'bg-primary-soft text-primary-text' : 'text-fg-3',
      )}
    >
      {children}
    </span>
  );
}

function ItemBarra({ href, pathname }: { href: string; pathname: string }) {
  const item = itemPorHref(href);
  const ativo = estaAtivo(pathname, href);
  const Icone = item.icone;
  return (
    <Link href={href} aria-current={ativo ? 'page' : undefined} className={cn(CLASSE_ITEM, ativo ? 'font-semibold text-fg' : 'text-fg-3 hover:text-fg-2')}>
      <IconeItem ativo={ativo}>
        <Icone aria-hidden="true" strokeWidth={ativo ? 2.1 : 1.8} />
      </IconeItem>
      {item.rotulo}
    </Link>
  );
}

/**
 * Barra de navegação inferior (celular e tablet, abaixo de 1024px):
 * Hoje · Transações · + (ações rápidas) · Dashboard · Mais.
 * O "Mais" abre um sheet com as demais áreas, nos mesmos grupos da sidebar.
 */
export function BarraInferior({ email }: { email: string }) {
  const pathname = usePathname();
  const [maisAberto, setMaisAberto] = useState(false);
  const maisAtivo = NAV_MAIS.some((href) => estaAtivo(pathname, href));

  return (
    <>
      <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-safe lg:hidden">
        <div className="mx-auto grid h-(--altura-barra-inferior) max-w-md grid-cols-5 items-stretch px-1">
          {NAV_INFERIOR_ESQUERDA.map((href) => (
            <ItemBarra key={href} href={href} pathname={pathname} />
          ))}
          <div className="flex items-center justify-center">
            <AcoesRapidas variante="fab" />
          </div>
          {NAV_INFERIOR_DIREITA.map((href) => (
            <ItemBarra key={href} href={href} pathname={pathname} />
          ))}
          <button
            type="button"
            onClick={() => setMaisAberto(true)}
            aria-haspopup="dialog"
            aria-expanded={maisAberto}
            className={cn(CLASSE_ITEM, maisAtivo ? 'font-semibold text-fg' : 'text-fg-3 hover:text-fg-2')}
          >
            <IconeItem ativo={maisAtivo}>
              <Menu aria-hidden="true" />
            </IconeItem>
            Mais
          </button>
        </div>
      </nav>

      <Dialogo aberto={maisAberto} onFechar={() => setMaisAberto(false)} titulo="Menu">
        <nav aria-label="Mais opções" className="-mx-2 flex flex-col gap-3 pb-2">
          {GRUPOS_MAIS.map((grupo) => (
            <div key={grupo.titulo} role="group" aria-label={grupo.titulo}>
              <p className="px-2 pb-1 text-caption font-medium text-fg-3" aria-hidden="true">
                {grupo.titulo}
              </p>
              <ul className="flex flex-col">
                {grupo.itens.map((href) => {
                  const item = itemPorHref(href);
                  const Icone = item.icone;
                  const ativo = estaAtivo(pathname, href);
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        onClick={() => setMaisAberto(false)}
                        aria-current={ativo ? 'page' : undefined}
                        className={cn(
                          'flex h-12 items-center gap-3 rounded-md px-2 text-body font-medium transition-colors duration-150',
                          ativo ? 'bg-primary-soft text-primary-soft-fg' : 'text-fg hover:bg-surface-2',
                        )}
                      >
                        <span
                          className={cn(
                            'grid size-8 place-items-center rounded-md border [&_svg]:size-4.5',
                            ativo ? 'border-info-border bg-surface-elevated text-primary-text' : 'border-border bg-surface-2 text-fg-2',
                          )}
                          aria-hidden="true"
                        >
                          <Icone />
                        </span>
                        <span className="flex-1">{item.rotulo}</span>
                        <ChevronRight className="size-4 text-fg-3" aria-hidden="true" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="-mx-2 mt-1 flex items-center gap-2 border-t border-border px-2 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <p className="min-w-0 flex-1 truncate text-meta text-fg-3" title={email}>
            {email}
          </p>
          <form action={sair}>
            <button
              type="submit"
              className="flex h-11 items-center gap-2 rounded-md px-3 text-sm font-medium text-danger transition-colors hover:bg-danger-soft"
            >
              <LogOut className="size-4.5" aria-hidden="true" />
              Sair
            </button>
          </form>
        </div>
      </Dialogo>
    </>
  );
}
