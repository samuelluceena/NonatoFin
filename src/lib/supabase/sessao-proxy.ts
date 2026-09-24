import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from './tipos-banco';
import { obterEnvSupabase } from './env';

/** Rotas acessíveis sem login. */
export const ROTAS_PUBLICAS = ['/login'] as const;

export function ehRotaPublica(pathname: string): boolean {
  return ROTAS_PUBLICAS.some((rota) => pathname === rota || pathname.startsWith(`${rota}/`));
}

/**
 * Executada pelo proxy (src/proxy.ts) em toda requisição:
 * 1. renova a sessão do Supabase (cookies);
 * 2. redireciona para /login quem não estiver autenticado;
 * 3. redireciona para / quem já estiver logado e abrir /login.
 */
export async function atualizarSessao(request: NextRequest) {
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = obterEnvSupabase();
  let resposta = NextResponse.next({ request });

  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesParaDefinir) {
        for (const { name, value } of cookiesParaDefinir) request.cookies.set(name, value);
        resposta = NextResponse.next({ request });
        for (const { name, value, options } of cookiesParaDefinir) {
          resposta.cookies.set(name, value, options);
        }
      },
    },
  });

  // IMPORTANTE: não colocar código entre a criação do cliente e getClaims().
  const { data } = await supabase.auth.getClaims();
  const autenticado = Boolean(data?.claims?.sub);
  const { pathname } = request.nextUrl;

  if (!autenticado && !ehRotaPublica(pathname)) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    if (pathname !== '/') url.searchParams.set('voltar', pathname + request.nextUrl.search);
    return copiarCookies(resposta, NextResponse.redirect(url));
  }

  if (autenticado && ehRotaPublica(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return copiarCookies(resposta, NextResponse.redirect(url));
  }

  return resposta;
}

function copiarCookies(origem: NextResponse, destino: NextResponse): NextResponse {
  for (const cookie of origem.cookies.getAll()) destino.cookies.set(cookie);
  return destino;
}
