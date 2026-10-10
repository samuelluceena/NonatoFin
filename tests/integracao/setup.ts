import { config } from 'dotenv';

// Testes de integração usam o Supabase LOCAL (veja .env.test e docs/TESTES.md).
config({ path: '.env.test', quiet: true });

// Os testes criam e APAGAM dados: nunca rodam fora do Supabase local.
const LOCAL = new Set(['127.0.0.1', 'localhost']);
for (const nome of ['SUPABASE_URL', 'DATABASE_URL'] as const) {
  const valor = process.env[nome];
  const host = valor ? new URL(valor).hostname : '';
  if (!LOCAL.has(host)) {
    throw new Error(`${nome} não aponta para o Supabase local (127.0.0.1). Testes de integração abortados.`);
  }
}
