import type { NextRequest } from 'next/server';
import { atualizarSessao } from '@/lib/supabase/sessao-proxy';

/**
 * Proxy (antigo "middleware") do Next.js 16.
 * Protege TODAS as rotas, exceto /login e arquivos estáticos/PWA.
 */
export async function proxy(request: NextRequest) {
  return atualizarSessao(request);
}

export const config = {
  matcher: [
    // Ignora estáticos do Next, ícones, manifest e arquivos com extensão de imagem.
    '/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
