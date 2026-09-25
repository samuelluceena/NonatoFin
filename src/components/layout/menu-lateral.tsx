'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Building2, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { BotaoIcone } from '@/components/ui/botao';
import { Dica } from '@/components/ui/dica';
import { SeletorEmpresa } from '@/features/empresas/componentes/seletor-empresa';
import { sair } from '@/features/auth/acoes';
import { APP } from '@/lib/config';
import { cn } from '@/lib/utils/cn';
import { AcoesRapidas } from './acoes-rapidas';
import { Logo } from './logo';
import { COOKIE_SIDEBAR, GRUPOS_NAVEGACAO, SIDEBAR_COMPACTA, estaAtivo, itemPorHref } from './navegacao';
import { SeletorTemaCompacto } from './seletor-tema';

interface Props {
  email: string;
  empresas: { id: string; apelido: string }[];
  selecionadaId: string | null;
  /** Estado salvo no cookie (lido no servidor: sem "piscar" ao carregar). */
  compactaInicial: boolean;
}

/**
 * Navegação lateral fixa (a partir de 1024px): empresa, "Novo lançamento",
 * áreas agrupadas (Principal, Gestão, Sistema) e, no rodapé, conta e tema.
 * Recolhível: no modo compacto só os ícones, com dica; os nomes continuam
 * acessíveis (texto para leitores de tela).
 */
export function MenuLateral({ email, empresas, selecionadaId, compactaInicial }: Props) {
  const pathname = usePathname();
  const [compacta, setCompacta] = useState(compactaInicial);
  const empresaAtual = empresas.find((e) => e.id === selecionadaId)?.apelido ?? 'Todas as empresas';

  function alternar() {
    const nova = !compacta;
    setCompacta(nova);
    document.cookie = `${COOKIE_SIDEBAR}=${nova ? SIDEBAR_COMPACTA : 'expandida'}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <aside
      data-compacta={compacta || undefined}
      className={cn(
        'sticky top-0 z-20 hidden h-dvh shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-200 ease-out lg:flex',
        compacta ? 'w-(--largura-sidebar-compacta)' : 'w-(--largura-sidebar)',
      )}
    >
      <div className={cn('flex h-14 shrink-0 items-center', compacta ? 'justify-center px-2' : 'justify-between pr-2 pl-4')}>
        <Link href="/" className="rounded-md" aria-label={`${APP.nome} — início`}>
          <Logo apenasSimbolo={compacta} />
        </Link>
        {!compacta && (
          <BotaoIcone rotulo="Recolher menu" tamanho="sm" onClick={alternar} aria-expanded="true" className="text-fg-3">
            <PanelLeftClose aria-hidden="true" />
          </BotaoIcone>
        )}
      </div>

      <div className={cn('flex shrink-0 flex-col gap-2 pb-3', compacta ? 'items-center px-2' : 'px-3')}>
        {compacta ? (
          <>
            <Dica texto="Expandir menu">
              <BotaoIcone rotulo="Expandir menu" onClick={alternar} aria-expanded="false" className="text-fg-3">
                <PanelLeftOpen aria-hidden="true" />
              </BotaoIcone>
            </Dica>
            {empresas.length > 1 && (
              <Dica texto={`Empresa: ${empresaAtual}`}>
                <BotaoIcone rotulo={`Empresa: ${empresaAtual}. Expandir o menu para trocar.`} onClick={alternar} className="text-fg-3">
                  <Building2 aria-hidden="true" />
                </BotaoIcone>
              </Dica>
            )}
          </>
        ) : (
          <SeletorEmpresa empresas={empresas} selecionadaId={selecionadaId} />
        )}
        <AcoesRapidas variante="lateral" compacta={compacta} />
      </div>

      <nav
        aria-label="Principal"
        className={cn('flex flex-1 flex-col gap-4 pt-1 pb-3', compacta ? 'items-center overflow-visible px-2' : 'overflow-y-auto px-3')}
      >
        {GRUPOS_NAVEGACAO.map((grupo, indice) => (
          <div key={grupo.titulo} role="group" aria-label={grupo.titulo} className={cn('flex flex-col gap-px', compacta && 'items-center')}>
            {compacta ? (
              indice > 0 && <span className="mb-1 h-px w-6 bg-border" aria-hidden="true" />
            ) : (
              <p className="px-2.5 pb-1 text-caption font-medium text-fg-3" aria-hidden="true">
                {grupo.titulo}
              </p>
            )}
            {grupo.itens.map((href) => {
              const item = itemPorHref(href);
              const ativo = estaAtivo(pathname, href);
              const Icone = item.icone;
              const link = (
                <Link
                  href={href}
                  aria-current={ativo ? 'page' : undefined}
                  className={cn(
                    'group relative flex h-9 items-center rounded-md text-sm font-medium transition-colors duration-150',
                    compacta ? 'w-10 justify-center' : 'gap-2.5 px-2.5',
                    ativo ? 'bg-surface text-fg shadow-xs ring-1 ring-border' : 'text-fg-2 hover:bg-surface-2 hover:text-fg',
                  )}
                >
                  {ativo && <span className="absolute top-2 bottom-2 -left-3 w-0.5 rounded-r-full bg-primary" aria-hidden="true" />}
                  <Icone
                    className={cn('size-4.5 shrink-0', ativo ? 'text-primary-text' : 'text-fg-3 group-hover:text-fg-2')}
                    strokeWidth={ativo ? 2.1 : 1.8}
                    aria-hidden="true"
                  />
                  <span className={cn('truncate', compacta && 'sr-only')}>{item.rotulo}</span>
                </Link>
              );
              return (
                <Dica key={href} texto={item.rotulo} ativa={compacta}>
                  {link}
                </Dica>
              );
            })}
          </div>
        ))}
      </nav>

      <div className={cn('shrink-0 border-t border-border py-3', compacta ? 'flex flex-col items-center gap-1 px-2' : 'px-3')}>
        {compacta ? (
          <>
            <Dica texto="Alternar tema">
              <SeletorTemaCompacto className="text-fg-3" />
            </Dica>
            <Dica texto="Sair">
              <form action={sair}>
                <BotaoIcone rotulo="Sair" type="submit" className="text-fg-3">
                  <LogOut aria-hidden="true" />
                </BotaoIcone>
              </form>
            </Dica>
          </>
        ) : (
          <div className="flex items-center gap-1">
            <span
              className="grid size-8 shrink-0 place-items-center rounded-full border border-border bg-surface text-caption font-semibold text-fg-2 uppercase"
              aria-hidden="true"
            >
              {email.slice(0, 1)}
            </span>
            <p className="min-w-0 flex-1 truncate px-1 text-meta text-fg-2" title={email}>
              {email}
            </p>
            <SeletorTemaCompacto className="text-fg-3" />
            <form action={sair}>
              <BotaoIcone rotulo="Sair" type="submit" className="text-fg-3">
                <LogOut aria-hidden="true" />
              </BotaoIcone>
            </form>
          </div>
        )}
      </div>
    </aside>
  );
}
