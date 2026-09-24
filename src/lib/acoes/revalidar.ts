import { revalidatePath } from 'next/cache';

/**
 * Depois de gravar, invalida o cache de todas as páginas do app.
 * Um único usuário e telas que se cruzam (Hoje, Dashboard, Meses...):
 * atualizar tudo é mais simples e seguro do que rastrear cada página.
 */
export function revalidarTudo() {
  revalidatePath('/', 'layout');
}
