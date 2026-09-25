'use client';

/**
 * Menu de ações secundárias (três pontos). Padrão "menu button" do WAI-ARIA:
 * Enter/Espaço/seta abrem; setas e Home/End navegam; Esc fecha e devolve o
 * foco ao botão; clique fora, Tab, rolagem ou redimensionar fecham.
 * O menu é `position: fixed` (calculado ao abrir) para não ser cortado por
 * tabelas ou cartões com overflow.
 */
import Link from 'next/link';
import { MoreHorizontal } from 'lucide-react';
import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils/cn';

export interface ItemMenu {
  rotulo: string;
  href: string;
}

const LARGURA = 208;

export function MenuAcoes({ itens, rotulo, className }: { itens: ItemMenu[]; rotulo: string; className?: string }) {
  const botao = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLUListElement>(null);
  const id = useId();
  const [posicao, setPosicao] = useState<CSSProperties | null>(null);
  const aberto = posicao !== null;

  function abrir(foco: 'primeiro' | 'ultimo' = 'primeiro') {
    const r = botao.current?.getBoundingClientRect();
    if (!r) return;
    const abaixo = r.bottom + 4 + itens.length * 36 + 12 < window.innerHeight;
    setPosicao({
      left: Math.max(8, Math.min(r.right - LARGURA, window.innerWidth - LARGURA - 8)),
      ...(abaixo ? { top: r.bottom + 4 } : { bottom: window.innerHeight - r.top + 4 }),
      width: LARGURA,
    });
    requestAnimationFrame(() => focar(foco === 'primeiro' ? 0 : itens.length - 1));
  }

  function fechar(devolverFoco = true) {
    setPosicao(null);
    if (devolverFoco) botao.current?.focus();
  }

  function focar(indice: number) {
    const links = menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
    if (!links?.length) return;
    links[(indice + links.length) % links.length].focus();
  }

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node) && !botao.current?.contains(e.target as Node)) fechar(false);
    };
    const sair = () => fechar(false);
    document.addEventListener('pointerdown', fora);
    window.addEventListener('scroll', sair, true);
    window.addEventListener('resize', sair);
    return () => {
      document.removeEventListener('pointerdown', fora);
      window.removeEventListener('scroll', sair, true);
      window.removeEventListener('resize', sair);
    };
  }, [aberto]);

  function teclaNoMenu(e: KeyboardEvent<HTMLUListElement>) {
    const links = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const atual = links.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') focar(atual + 1);
    else if (e.key === 'ArrowUp') focar(atual - 1);
    else if (e.key === 'Home') focar(0);
    else if (e.key === 'End') focar(links.length - 1);
    else if (e.key === 'Escape') fechar();
    else if (e.key === 'Tab') fechar(false);
    else return;
    if (e.key !== 'Tab') e.preventDefault();
  }

  if (itens.length === 0) return null;

  return (
    <>
      <button
        ref={botao}
        type="button"
        aria-label={rotulo}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? id : undefined}
        onClick={() => (aberto ? fechar() : abrir())}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            abrir(e.key === 'ArrowDown' ? 'primeiro' : 'ultimo');
          }
        }}
        className={cn(
          'grid size-9 place-items-center rounded-md text-fg-3 transition-colors hover:bg-surface-2 hover:text-fg',
          aberto && 'bg-surface-2 text-fg',
          className,
        )}
      >
        <MoreHorizontal className="size-5" aria-hidden="true" />
      </button>
      {aberto && (
        <ul
          ref={menu}
          id={id}
          role="menu"
          aria-label={rotulo}
          onKeyDown={teclaNoMenu}
          style={posicao}
          className="fixed z-50 animate-surgir rounded-lg border border-border bg-surface-elevated p-1 shadow-lg"
        >
          {itens.map((item) => (
            <li key={item.href + item.rotulo} role="none">
              <Link
                href={item.href}
                role="menuitem"
                tabIndex={-1}
                onClick={() => fechar(false)}
                className="flex h-9 items-center rounded-sm px-2.5 text-sm text-fg outline-none transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
              >
                {item.rotulo}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
