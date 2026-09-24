/**
 * Cria (ou atualiza a senha de) o usuário do NonatoFin e o autoriza.
 * Executa SOMENTE no seu computador — usa a chave secreta (service role).
 *
 * Uso:
 *   npm run usuario:criar -- seu@email.com "sua-senha-forte"
 *
 * Lê SUPABASE_URL e SUPABASE_SECRET_KEY do arquivo .env.local.
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: process.env.ARQUIVO_ENV ?? '.env.local', quiet: true });

async function principal() {
  const [email, senha] = process.argv.slice(2);
  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_SECRET_KEY;

  if (!email || !senha) {
    console.error('Uso: npm run usuario:criar -- seu@email.com "sua-senha-forte"');
    process.exit(1);
  }
  if (senha.length < 10) {
    console.error('Use uma senha com pelo menos 10 caracteres.');
    process.exit(1);
  }
  if (!url || !chave) {
    console.error('Defina SUPABASE_URL e SUPABASE_SECRET_KEY no .env.local (somente local!).');
    process.exit(1);
  }

  const admin = createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });

  // Procura usuário existente pelo e-mail.
  let usuarioId: string | undefined;
  for (let pagina = 1; !usuarioId; pagina++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (error) throw error;
    usuarioId = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
    if (data.users.length < 200) break;
  }

  if (usuarioId) {
    const { error } = await admin.auth.admin.updateUserById(usuarioId, { password: senha, email_confirm: true });
    if (error) throw error;
    console.log(`Senha atualizada para ${email}.`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
    if (error) throw error;
    usuarioId = data.user.id;
    console.log(`Usuário criado: ${email}.`);
  }

  // Autoriza o acesso aos dados (tabela sem acesso pela API pública).
  const { error: erroAutorizacao } = await admin
    .from('usuarios_autorizados')
    .upsert({ user_id: usuarioId }, { onConflict: 'user_id' });
  if (erroAutorizacao) throw erroAutorizacao;
  console.log('Usuário autorizado no NonatoFin. Já pode entrar!');
}

principal().catch((erro: unknown) => {
  console.error('Falha:', erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
