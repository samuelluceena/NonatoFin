/**
 * Categorias: uso (quem depende de cada categoria).
 * A exclusão de categoria em uso é bloqueada pelo BANCO (FKs com
 * `on delete restrict` em lançamentos, compras e cartões); estas funções só
 * informam a tela antes da tentativa.
 */
import type { UsoCategoria } from './tipos';

export const USO_VAZIO: UsoCategoria = { lancamentos: 0, compras: 0, cartoes: 0 };

export function categoriaEmUso(uso: UsoCategoria): boolean {
  return uso.lancamentos + uso.compras + uso.cartoes > 0;
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** "12 lançamentos · 3 compras · 1 cartão" (só o que for maior que zero) ou "Sem uso". */
export function descreverUso(uso: UsoCategoria): string {
  const partes = [
    uso.lancamentos ? plural(uso.lancamentos, 'lançamento', 'lançamentos') : null,
    uso.compras ? plural(uso.compras, 'compra no cartão', 'compras no cartão') : null,
    uso.cartoes ? plural(uso.cartoes, 'cartão', 'cartões') : null,
  ].filter(Boolean);
  return partes.length ? partes.join(' · ') : 'Sem uso';
}
