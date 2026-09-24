import {
  Building2,
  CalendarCheck2,
  CalendarRange,
  ClipboardCheck,
  CreditCard,
  History,
  Landmark,
  LayoutDashboard,
  ReceiptText,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export interface ItemNavegacao {
  href: string;
  rotulo: string;
  icone: LucideIcon;
}

/** Ordem da navegação lateral (desktop). */
export const ITENS_NAVEGACAO: ItemNavegacao[] = [
  { href: '/', rotulo: 'Hoje', icone: CalendarCheck2 },
  { href: '/dashboard', rotulo: 'Dashboard', icone: LayoutDashboard },
  { href: '/boletos', rotulo: 'Boletos', icone: ReceiptText },
  { href: '/contas', rotulo: 'Contas', icone: Landmark },
  { href: '/fechar-dia', rotulo: 'Fechar o dia', icone: ClipboardCheck },
  { href: '/cartoes', rotulo: 'Cartões', icone: CreditCard },
  { href: '/meses', rotulo: 'Meses', icone: CalendarRange },
  { href: '/fornecedores', rotulo: 'Fornecedores', icone: Building2 },
  { href: '/historico', rotulo: 'Histórico', icone: History },
  { href: '/configuracoes', rotulo: 'Configurações', icone: Settings },
];

/** Barra inferior (celular): itens principais. O "+" fica no centro. */
export const NAV_INFERIOR_ESQUERDA = ['/', '/boletos'];
export const NAV_INFERIOR_DIREITA = ['/dashboard'];

/** Itens do menu "Mais" (celular). */
export const NAV_MAIS = ['/contas', '/fechar-dia', '/cartoes', '/meses', '/fornecedores', '/historico', '/configuracoes'];

export function itemPorHref(href: string): ItemNavegacao {
  const item = ITENS_NAVEGACAO.find((i) => i.href === href);
  if (!item) throw new Error(`Item de navegação inexistente: ${href}`);
  return item;
}

export function estaAtivo(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
