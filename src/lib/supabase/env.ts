/**
 * Variáveis de ambiente do Supabase, validadas.
 * Usadas SOMENTE no servidor (Server Components, Server Actions, Route
 * Handlers e proxy). Nenhuma chave vai para o JavaScript do navegador.
 */
import { z } from 'zod';

const esquema = z.object({
  SUPABASE_URL: z.url({ message: 'SUPABASE_URL deve ser uma URL válida.' }),
  SUPABASE_PUBLISHABLE_KEY: z
    .string({ message: 'SUPABASE_PUBLISHABLE_KEY não configurada.' })
    .min(20, 'SUPABASE_PUBLISHABLE_KEY inválida.'),
});

export type EnvSupabase = z.infer<typeof esquema>;

let cache: EnvSupabase | null = null;

export function obterEnvSupabase(): EnvSupabase {
  if (cache) return cache;
  const resultado = esquema.safeParse({
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
  });
  if (!resultado.success) {
    const detalhes = resultado.error.issues.map((i) => `- ${i.message}`).join('\n');
    throw new Error(`Configuração do Supabase ausente ou inválida:\n${detalhes}\nVeja .env.example.`);
  }
  cache = resultado.data;
  return cache;
}
