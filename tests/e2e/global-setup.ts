/**
 * Prepara o ambiente E2E: garante o usuário de teste (autorizado), limpa os
 * dados dele e salva uma sessão logada para os testes que não testam o login.
 */
import { chromium, type FullConfig } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { mkdir } from 'node:fs/promises';
import { EMPRESAS_E2E } from './auxiliares';

export default async function globalSetup(config: FullConfig) {
  const url = process.env.SUPABASE_URL!;
  const admin = createClient(url, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = process.env.E2E_EMAIL!;
  const senha = process.env.E2E_SENHA!;

  const { data: lista, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`Supabase local indisponível? ${error.message}`);
  let id = lista.users.find((u) => u.email === email)?.id;
  if (!id) {
    const { data, error: e } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
    if (e) throw e;
    id = data.user.id;
  } else {
    await admin.auth.admin.updateUserById(id, { password: senha });
  }
  await admin.from('usuarios_autorizados').upsert({ user_id: id }, { onConflict: 'user_id' });
  // Faturas pagas travam as compras: desfaz os pagamentos antes de limpar.
  await admin.from('lancamentos').update({ status: 'pendente', pago_em: null }).eq('user_id', id).not('cartao_id', 'is', null);
  // Ordem respeita as chaves estrangeiras (parcelas saem junto com as compras).
  for (const tabela of ['compras_cartao', 'lancamentos', 'cartoes', 'contas_bancarias', 'fornecedores', 'empresas', 'categorias']) {
    const { error: e } = await admin.from(tabela).delete().eq('user_id', id);
    if (e) throw new Error(`limpar ${tabela}: ${e.message}`);
  }
  // Duas empresas (como no uso real) — o seletor do topo começa em "Todas".
  const { error: eEmp } = await admin.from('empresas').insert([
    { user_id: id, apelido: EMPRESAS_E2E[0].apelido, razao_social: 'Empresa A de Teste', cnpj: EMPRESAS_E2E[0].cnpj },
    { user_id: id, apelido: EMPRESAS_E2E[1].apelido, razao_social: 'Empresa B de Teste', cnpj: EMPRESAS_E2E[1].cnpj },
  ]);
  if (eEmp) throw new Error(`criar empresas: ${eEmp.message}`);

  // Sessão salva (login real pela interface).
  const baseURL = config.projects[0].use.baseURL!;
  const executavel = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  const navegador = await chromium.launch(executavel ? { executablePath: executavel } : {});
  const pagina = await navegador.newPage({ baseURL });
  await pagina.goto('/login');
  await pagina.getByLabel('E-mail').fill(email);
  await pagina.getByLabel('Senha').fill(senha);
  await pagina.getByRole('button', { name: 'Entrar' }).click();
  await pagina.waitForURL(`${baseURL}/`);
  await mkdir('tests/e2e/.auth', { recursive: true });
  await pagina.context().storageState({ path: 'tests/e2e/.auth/sessao.json' });
  await navegador.close();
}
