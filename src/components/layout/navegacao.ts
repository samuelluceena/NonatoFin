import {
  ArrowLeftRight,
  CalendarCheck2,
  CalendarRange,
  ClipboardCheck,
  CreditCard,
  History,
  Landmark,
  LayoutDashboard,
  ReceiptText,
  Settings,
  Store,
  type LucideIcon,
} from 'lucide-react';

export interface ItemNavegacao {
  href: string;
  rotulo: string;
  icone: LucideIcon;
}

/** Todas as áreas do app (a ordem é a da navegação). */
export const ITENS_NAVEGACAO: ItemNavegacao[] = [
  { href: '/', rotulo: 'Hoje', icone: CalendarCheck2 },
  { href: '/transacoes', rotulo: 'Transações', icone: ArrowLeftRight },
  { href: '/boletos', rotulo: 'Boletos', icone: ReceiptText },
  { href: '/contas', rotulo: 'Contas', icone: Landmark },
  { href: '/fechar-dia', rotulo: 'Fechar o dia', icone: ClipboardCheck },
  { href: '/dashboard', rotulo: 'Dashboard', icone: LayoutDashboard },
  { href: '/cartoes', rotulo: 'Cartões', icone: CreditCard },
  { href: '/meses', rotulo: 'Meses', icone: CalendarRange },
  { href: '/fornecedores', rotulo: 'Fornecedores', icone: Store },
  { href: '/historico', rotulo: 'Histórico', icone: History },
  { href: '/configuracoes', rotulo: 'Configurações', icone: Settings },
];

export interface GrupoNavegacao {
  titulo: string;
  itens: string[];
}

/**
 * Agrupamento da sidebar (desktop) e do menu "Mais" (celular):
 * o dia a dia do dinheiro, a gestão/relatórios e o sistema.
 */
export const GRUPOS_NAVEGACAO: GrupoNavegacao[] = [
  { titulo: 'Principal', itens: ['/', '/transacoes', '/boletos', '/contas', '/fechar-dia'] },
  { titulo: 'Gestão', itens: ['/dashboard', '/cartoes', '/meses', '/fornecedores', '/historico'] },
  { titulo: 'Sistema', itens: ['/configuracoes'] },
];

/** Barra inferior (celular): itens principais. O "+" (ações rápidas) fica no centro. */
export const NAV_INFERIOR_ESQUERDA = ['/', '/transacoes'];
export const NAV_INFERIOR_DIREITA = ['/dashboard'];

/** Menu "Mais" (celular): os grupos, sem o que já está na barra inferior. */
export const GRUPOS_MAIS: GrupoNavegacao[] = GRUPOS_NAVEGACAO.map((g) => ({
  titulo: g.titulo,
  itens: g.itens.filter((href) => !NAV_INFERIOR_ESQUERDA.includes(href) && !NAV_INFERIOR_DIREITA.includes(href)),
})).filter((g) => g.itens.length > 0);

export const NAV_MAIS = GRUPOS_MAIS.flatMap((g) => g.itens);

/** Cookie com o estado da sidebar (lido no servidor: abre já no estado certo, sem piscar). */
export const COOKIE_SIDEBAR = 'nonatofin-sidebar';
export const SIDEBAR_COMPACTA = 'compacta';

export function itemPorHref(href: string): ItemNavegacao {
  const item = ITENS_NAVEGACAO.find((i) => i.href === href);
  if (!item) throw new Error(`Item de navegação inexistente: ${href}`);
  return item;
}

export function estaAtivo(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
