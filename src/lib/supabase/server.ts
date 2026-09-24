import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Database } from './tipos-banco';
import { obterEnvSupabase } from './env';

export type ClienteSupabase = Awaited<ReturnType<typeof criarClienteServidor>>;

/**
 * Cliente Supabase para Server Components, Server Actions e Route Handlers.
 * Usa a sessão (cookies httpOnly) do usuário: todas as consultas passam pela RLS.
 */
export async function criarClienteServidor() {
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = obterEnvSupabase();
  const cookieStore = await cookies();

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesParaDefinir) {
        try {
          for (const { name, value, options } of cookiesParaDefinir) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Chamado a partir de um Server Component (cookies somente leitura).
          // Seguro ignorar: o proxy renova a sessão a cada requisição.
        }
      },
    },
  });
}
