import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './tipos-banco';
import { obterEnvSupabase } from './env';

export type ResultadoReautenticacao =
  | { ok: true; cliente: SupabaseClient<Database>; encerrar: () => Promise<void> }
  | { ok: false; motivo: 'senha' | 'limite' | 'erro' };

/**
 * Confirma a senha do usuário logado abrindo uma sessão NOVA e temporária,
 * sem tocar nos cookies do navegador. O token dessa sessão registra o login
 * por senha "agora" — o banco só aceita limpar/restaurar dados com um login
 * por senha dos últimos 120 segundos. Chame `encerrar()` depois de usar.
 */
export async function reautenticarComSenha(email: string, senha: string, idEsperado: string): Promise<ResultadoReautenticacao> {
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = obterEnvSupabase();
  const cliente = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data, error } = await cliente.auth.signInWithPassword({ email, password: senha });
  if (error) {
    if (error.status === 429) return { ok: false, motivo: 'limite' };
    if (error.status === 400 || error.code === 'invalid_credentials') return { ok: false, motivo: 'senha' };
    console.error('[NonatoFin] reautenticação:', { code: error.code, status: error.status });
    return { ok: false, motivo: 'erro' };
  }

  const encerrar = async () => {
    // Revoga a sessão temporária (não afeta a sessão do navegador).
    await cliente.auth.signOut({ scope: 'local' }).catch(() => undefined);
  };
  if (data.user?.id !== idEsperado) {
    await encerrar();
    return { ok: false, motivo: 'erro' };
  }
  return { ok: true, cliente, encerrar };
}
