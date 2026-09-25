/**
 * Segurança pela aplicação: rotas privadas, API, cadastro público e segredos.
 */
import { expect, test } from '@playwright/test';

const ROTAS_PRIVADAS = [
  '/',
  '/dashboard',
  '/transacoes',
  '/boletos',
  '/boletos/novo',
  '/boletos/00000000-0000-0000-0000-000000000000',
  '/meses',
  '/meses/2026-10',
  '/fornecedores',
  '/historico',
  '/configuracoes',
  '/configuracoes/empresas',
  '/configuracoes/categorias',
  '/contas',
  '/fechar-dia',
  '/contas/nova',
  '/contas/00000000-0000-0000-0000-000000000000',
  '/cartoes',
  '/cartoes/novo',
  '/cartoes/00000000-0000-0000-0000-000000000000',
  '/cartoes/compras/nova',
];

test.describe('sem login', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('todas as rotas privadas redirecionam para o login', async ({ page }) => {
    for (const rota of ROTAS_PRIVADAS) {
      await page.goto(rota);
      await expect(page, `rota ${rota}`).toHaveURL(/\/login/);
    }
  });

  test('API de exportação exige autenticação (401)', async ({ request }) => {
    const r = await request.get('/api/exportar?formato=csv');
    expect(r.status()).toBe(401);
    expect(await r.text()).not.toContain('Fornecedor');
  });

  test('não existe página de cadastro público', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText(/criar conta|cadastre-se|registrar/i)).toHaveCount(0);
    for (const rota of ['/cadastro', '/signup', '/registro']) {
      await page.goto(rota);
      await expect(page).toHaveURL(/\/login/); // nada público além do login
    }
  });

  test('login com senha errada mostra mensagem genérica', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(process.env.E2E_EMAIL!);
    await page.getByLabel('Senha').fill('senha-errada-123');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible();
  });

  test('parâmetro "voltar" não permite redirecionamento externo', async ({ page }) => {
    await page.goto('/login?voltar=https://exemplo-malicioso.com');
    await page.getByLabel('E-mail').fill(process.env.E2E_EMAIL!);
    await page.getByLabel('Senha').fill(process.env.E2E_SENHA!);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/localhost:\d+\/$/);
  });

  test('sair encerra a sessão deste aparelho', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(process.env.E2E_EMAIL!);
    await page.getByLabel('Senha').fill(process.env.E2E_SENHA!);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/localhost:\d+\/$/);
    await page.goto('/configuracoes');
    await page.getByRole('main').getByRole('button', { name: 'Sair' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto('/boletos');
    await expect(page).toHaveURL(/\/login/);
  });

  test('cabeçalhos de segurança presentes', async ({ request }) => {
    const r = await request.get('/login');
    const h = r.headers();
    expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(h['x-frame-options']).toBe('DENY');
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['x-powered-by']).toBeUndefined();
  });
});

test('nenhum segredo ou chave do Supabase no JavaScript do navegador', async ({ page, request }) => {
  const scripts = new Set<string>();
  page.on('response', (r) => {
    if (r.url().includes('/_next/static/') && r.url().endsWith('.js')) scripts.add(r.url());
  });
  for (const rota of ['/', '/dashboard', '/boletos/novo', '/configuracoes']) {
    await page.goto(rota);
    await page.waitForLoadState('networkidle');
  }
  expect(scripts.size).toBeGreaterThan(0);

  const proibidos = [
    process.env.SUPABASE_SECRET_KEY!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    'service_role',
    'SUPABASE_SECRET_KEY',
    '127.0.0.1:54321',
  ];
  for (const url of scripts) {
    const js = await (await request.get(url)).text();
    for (const segredo of proibidos) expect(js.includes(segredo), `${segredo.slice(0, 20)}… em ${url}`).toBe(false);
  }
  const html = await page.content();
  for (const segredo of proibidos) expect(html.includes(segredo)).toBe(false);
});

test('o navegador nunca chama o Supabase diretamente', async ({ page }) => {
  const externas: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('http://localhost') && !r.url().startsWith('data:')) externas.push(r.url());
  });
  await page.goto('/');
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  expect(externas).toEqual([]);
});
