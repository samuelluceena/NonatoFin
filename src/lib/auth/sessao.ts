import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { criarClienteServidor, type ClienteSupabase } from '@/lib/supabase/server';
import type { Usuario } from '@/lib/domain/tipos';

/**
 * Retorna o usuário autenticado (JWT validado pelo Supabase) ou null.
 * `cache` evita validar a sessão mais de uma vez por requisição.
 */
export const obterUsuario = cache(async (): Promise<Usuario | null> => {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return { id: data.claims.sub, email: String(data.claims.email ?? '') };
});

/**
 * Exige usuário autenticado. Use em TODA página privada, Server Action e
 * Route Handler — não confie apenas no proxy. Redireciona para /login.
 */
export async function exigirUsuario(): Promise<{ usuario: Usuario; supabase: ClienteSupabase }> {
  const usuario = await obterUsuario();
  if (!usuario) redirect('/login');
  const supabase = await criarClienteServidor();
  return { usuario, supabase };
}

export { destinoSeguro } from './destino';
