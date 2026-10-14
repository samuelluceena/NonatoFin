/**
 * Gerenciamento de dados (Configurações → Dados), no Supabase LOCAL:
 *  - tela, diálogos e ausência de rolagem horizontal (todos os tamanhos);
 *  - fluxo real com um usuário PRÓPRIO, criado e apagado pelo teste:
 *    senha errada → limpar dados financeiros → conferir saldos → restaurar
 *    backup → restaurar do zero.
 * O usuário E2E compartilhado nunca é limpo por este arquivo.
 */
import { expect, test, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { dataRelativa, semRolagemHorizontal } from './auxiliares';

const url = process.env.SUPABASE_URL ?? '';
if (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) {
  throw new Error('SUPABASE_URL não aponta para o Supabase local. E2E abortado.');
}

function admin(): SupabaseClient {
  return createClient(url, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
}

test('tela de dados: seções, diálogo travado e sem rolagem horizontal', async ({ page }) => {
  await page.goto('/configuracoes');
  await page.getByTestId('link-gerenciar-dados').click();
  await expect(page).toHaveURL(/\/configuracoes\/dados$/);
  await expect(page.getByRole('heading', { name: 'Zona de perigo' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Backups automáticos' })).toBeVisible();
  await expect(page.getByTestId('baixar-backup-completo')).toBeVisible();
  await semRolagemHorizontal(page);

  await page.getByTestId('abrir-limpeza-completo').click();
  const dialogo = page.getByRole('alertdialog');
  await expect(dialogo).toBeVisible();
  await expect(dialogo.getByText('até 30 dias')).toBeVisible();
  await expect(page.getByTestId('limpeza-completo-confirmar')).toBeDisabled();
  await page.getByTestId('limpeza-completo-senha').fill('qualquer');
  await page.getByTestId('limpeza-completo-frase').fill('reiniciar nonatofin');
  await expect(page.getByTestId('limpeza-completo-confirmar')).toBeDisabled();
  await semRolagemHorizontal(page);
  await dialogo.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialogo).toBeHidden();
});

test.describe('fluxo real com usuário próprio', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(({}, info) => {
    // Cada execução faz ~5 logins; o Auth local limita 30 a cada 5 min.
    test.skip(!['celular-390x844', 'desktop-1440x900'].includes(info.project.name), 'fluxo destrutivo roda em 2 tamanhos');
  });

  const senha = 'senha-dados-e2e-123';
  let userId = '';
  let email = '';

  test.beforeEach(async () => {
    const a = admin();
    email = `e2e-dados-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@teste.local`;
    const { data, error } = await a.auth.admin.createUser({ email, password: senha, email_confirm: true });
    if (error) throw error;
    userId = data.user.id;
    const passo = async (r: PromiseLike<{ error: unknown }>) => {
      const { error: e } = await r;
      if (e) throw e;
    };
    await passo(a.from('usuarios_autorizados').insert({ user_id: userId }));
    const empresa = (await a.from('empresas').insert({ user_id: userId, apelido: 'Empresa Dados' }).select('id').single()).data!.id;
    const categoria = (await a.from('categorias').insert({ user_id: userId, nome: 'Boleto de fornecedor', ordem: 1 }).select('id').single()).data!.id;
    const fornecedor = (await a.from('fornecedores').insert({ user_id: userId, nome: 'Fornecedor Dados' }).select('id').single()).data!.id;
    const conta = (await a.from('contas_bancarias').insert({ user_id: userId, empresa_id: empresa, apelido: 'Conta Dados', banco: 'Banco', padrao: true }).select('id').single()).data!.id;
    await passo(a.from('movimentos_conta').insert({ user_id: userId, conta_id: conta, tipo: 'conferencia', data: dataRelativa(0), valor_centavos: 50_000, saldo_informado: 50_000 }));
    await passo(a.from('lancamentos').insert({
      user_id: userId, empresa_id: empresa, categoria_id: categoria, fornecedor_id: fornecedor, conta_id: conta,
      descricao: 'Boleto dados', valor_centavos: 12_345, vencimento: dataRelativa(3),
    }));
  });

  test.afterEach(async () => {
    if (userId) await admin().auth.admin.deleteUser(userId);
  });

  async function contar(tabela: string) {
    const { count } = await admin().from(tabela).select('*', { count: 'exact', head: true }).eq('user_id', userId);
    return count ?? 0;
  }

  async function entrar(page: Page) {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Senha').fill(senha);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL((u) => u.pathname === '/');
  }

  test('/api/backup: 401 sem sessão, 200 com o arquivo completo, 400/404 e 403 para não autorizado', async ({ page }) => {
    const baixar = (caminho: string) =>
      page.evaluate(async (c) => {
        const r = await fetch(c, { cache: 'no-store' });
        return { status: r.status, tipo: r.headers.get('content-type') ?? '', disposicao: r.headers.get('content-disposition') ?? '', corpo: await r.text() };
      }, caminho);

    await page.goto('/login');
    expect((await baixar('/api/backup')).status).toBe(401);

    await entrar(page);
    const r = await baixar('/api/backup');
    expect(r.status).toBe(200);
    expect(r.tipo).toContain('application/json');
    expect(r.disposicao).toMatch(/attachment; filename="nonatofin-backup-\d{4}-\d{2}-\d{2}\.json"/);
    const arquivo = JSON.parse(r.corpo);
    expect(arquivo).toMatchObject({ formato: 'nonatofin-backup', versao_formato: 1, contagens: { lancamentos: 1, movimentos_conta: 1, empresas: 1 } });
    expect(Object.keys(arquivo.conteudo)).toHaveLength(9);
    expect(arquivo.sha256).toMatch(/^[0-9a-f]{64}$/);

    expect((await baixar('/api/backup?id=nao-e-uuid')).status).toBe(400);
    expect((await baixar(`/api/backup?id=${crypto.randomUUID()}`)).status).toBe(404);

    // Logado, mas removido da lista de autorizados: 403 (sem dados no corpo).
    await admin().from('usuarios_autorizados').delete().eq('user_id', userId);
    const negado = await baixar('/api/backup');
    expect(negado.status).toBe(403);
    expect(negado.corpo).not.toContain('conteudo');
  });

  test('senha errada → limpar financeiro → restaurar → reiniciar do zero', async ({ page }) => {
    await entrar(page);
    await page.goto('/configuracoes/dados');
    await expect(page.getByTestId('resumo-financeiro')).toHaveText('1 lançamento · 1 movimentação');
    await expect(page.getByTestId('sem-backups')).toBeVisible();

    // Senha errada: nada é apagado.
    await page.getByTestId('abrir-limpeza-financeiro').click();
    await page.getByTestId('limpeza-financeiro-senha').fill('senha-errada');
    await page.getByTestId('limpeza-financeiro-frase').fill('LIMPAR DADOS FINANCEIROS');
    await page.getByTestId('limpeza-financeiro-confirmar').click();
    await expect(page.getByRole('alertdialog').getByText('Senha incorreta.')).toBeVisible();
    expect(await contar('lancamentos')).toBe(1);

    // Senha certa: apaga, guarda backup e pede a conferência dos saldos.
    await page.getByTestId('limpeza-financeiro-senha').fill(senha);
    await page.getByTestId('limpeza-financeiro-confirmar').click();
    await expect(page).toHaveURL(/\/conferir-saldos$/);
    await expect(page.getByText(/Dados apagados/)).toBeVisible();
    expect([await contar('lancamentos'), await contar('movimentos_conta'), await contar('empresas'), await contar('contas_bancarias')]).toEqual([0, 0, 1, 1]);
    expect(await contar('backups_dados')).toBe(1);
    await semRolagemHorizontal(page);

    // Conferência do dia (pelo banco, para seguir direto ao backup).
    const conta = (await admin().from('contas_bancarias').select('id').eq('user_id', userId).single()).data!.id;
    await admin().from('movimentos_conta').insert({ user_id: userId, conta_id: conta, tipo: 'conferencia', data: dataRelativa(0), valor_centavos: 100, saldo_informado: 100 });

    // Restaurar o backup.
    await page.goto('/configuracoes/dados');
    await expect(page.getByTestId('backup')).toHaveCount(1);
    await page.getByTestId('abrir-restauracao').click();
    await page.getByTestId('restauracao-senha').fill(senha);
    await page.getByTestId('restauracao-frase').fill('RESTAURAR BACKUP');
    await page.getByTestId('restauracao-confirmar').click();
    await expect(page.getByText('Backup restaurado.', { exact: false })).toBeVisible();
    await expect(page).toHaveURL((u) => u.pathname === '/');
    expect([await contar('lancamentos'), await contar('movimentos_conta')]).toEqual([1, 1]);
    expect(await contar('backups_dados')).toBe(2); // + o estado "antes da restauração"

    // Restaurar do zero.
    await page.goto('/configuracoes/dados');
    await page.getByTestId('abrir-limpeza-completo').click();
    await page.getByTestId('limpeza-completo-senha').fill(senha);
    await page.getByTestId('limpeza-completo-frase').fill('REINICIAR NONATOFIN');
    await page.getByTestId('limpeza-completo-confirmar').click();
    await expect(page).toHaveURL((u) => u.pathname === '/');
    await expect(page.getByText('Cadastre suas empresas primeiro')).toBeVisible();
    for (const t of ['empresas', 'contas_bancarias', 'fornecedores', 'lancamentos', 'movimentos_conta']) expect(await contar(t), t).toBe(0);
    expect(await contar('usuarios_autorizados')).toBe(1);
    expect(await contar('backups_dados')).toBe(3);

    // Continua logado e o app funciona como no primeiro acesso.
    await page.goto('/configuracoes/empresas');
    await expect(page.getByRole('heading', { name: 'Empresas' })).toBeVisible();
  });
});
