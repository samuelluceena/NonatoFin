'use client';

/**
 * Painel de filtros: no celular, um sheet (Dialogo); a partir de 640px, um
 * popover ancorado no botão "Filtros" (não bloqueia a página). Nos dois:
 * role="dialog" com título, Esc fecha, foco vai para o primeiro campo e
 * volta ao botão ao fechar; no popover, clique fora também fecha.
 */
import { X } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode, type RefObject } from 'react';
import { BotaoIcone } from './botao';
import { Dialogo } from './dialogo';

const CONSULTA_DESKTOP = '(min-width: 640px)';

function useDesktop() {
  return useSyncExternalStore(
    (avisar) => {
      const m = window.matchMedia(CONSULTA_DESKTOP);
      m.addEventListener('change', avisar);
      return () => m.removeEventListener('change', avisar);
    },
    () => window.matchMedia(CONSULTA_DESKTOP).matches,
    () => false,
  );
}

interface Props {
  aberto: boolean;
  onFechar: () => void;
  /** Botão que abriu (o popover se alinha a ele e o foco volta para ele). */
  ancora: RefObject<HTMLElement | null>;
  titulo?: string;
  descricao?: ReactNode;
  children: ReactNode;
  rodape: ReactNode;
}

export function PainelFiltros({ aberto, onFechar, ancora, titulo = 'Mais filtros', descricao, children, rodape }: Props) {
  const desktop = useDesktop();
  if (!aberto) return null;
  if (!desktop) {
    return (
      <Dialogo aberto onFechar={onFechar} titulo={titulo} descricao={descricao} rodape={rodape}>
        {children}
      </Dialogo>
    );
  }
  return (
    <Popover onFechar={onFechar} ancora={ancora} titulo={titulo} descricao={descricao} rodape={rodape}>
      {children}
    </Popover>
  );
}

const LARGURA = 352;

function Popover({ onFechar, ancora, titulo, descricao, children, rodape }: Omit<Props, 'aberto' | 'titulo'> & { titulo: string }) {
  const painel = useRef<HTMLDivElement>(null);
  const idTitulo = useId();
  // Posição calculada antes da pintura, alinhada à direita do botão e dentro da tela.
  useLayoutEffect(() => {
    const r = ancora.current?.getBoundingClientRect();
    const el = painel.current;
    if (!el) return;
    el.style.width = `${LARGURA}px`;
    el.style.top = `${r ? r.bottom + 6 : 80}px`;
    el.style.left = `${r ? Math.max(8, Math.min(r.right - LARGURA, window.innerWidth - LARGURA - 8)) : 16}px`;
  }, [ancora]);

  // Última versão do onFechar sem reexecutar o efeito (que devolve o foco ao botão).
  const fechar = useRef(onFechar);
  useEffect(() => {
    fechar.current = onFechar;
  }, [onFechar]);

  useEffect(() => {
    const botao = ancora.current;
    painel.current?.querySelector<HTMLElement>('select, input, button:not([aria-label="Fechar"])')?.focus();
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && fechar.current();
    const fora = (e: PointerEvent) => {
      const alvo = e.target as Node;
      if (!painel.current?.contains(alvo) && !botao?.contains(alvo)) fechar.current();
    };
    document.addEventListener('keydown', tecla);
    document.addEventListener('pointerdown', fora);
    return () => {
      document.removeEventListener('keydown', tecla);
      document.removeEventListener('pointerdown', fora);
      botao?.focus();
    };
  }, [ancora]);

  return (
    <div
      ref={painel}
      role="dialog"
      aria-modal="false"
      aria-labelledby={idTitulo}
      className="fixed z-40 animate-surgir rounded-lg border border-border bg-surface-elevated shadow-lg"
    >
      <div className="flex items-start justify-between gap-3 px-4 pt-3">
        <div className="min-w-0 pt-1">
          <h2 id={idTitulo} className="text-sm font-semibold text-fg">
            {titulo}
          </h2>
          {descricao && <p className="mt-0.5 text-meta text-fg-3">{descricao}</p>}
        </div>
        <BotaoIcone rotulo="Fechar" tamanho="sm" onClick={onFechar} className="-mr-1.5 text-fg-3">
          <X aria-hidden="true" />
        </BotaoIcone>
      </div>
      <div className="max-h-[60vh] overflow-y-auto px-4 pt-3 pb-1">{children}</div>
      <div className="mt-3 flex justify-end gap-2 border-t border-border-subtle px-4 py-3">{rodape}</div>
    </div>
  );
}
