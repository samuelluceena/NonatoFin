/**
 * Responsividade e uso 100% pelo celular: sem rolagem horizontal, navegação
 * adequada ao tamanho, alvos de toque, inputs sem zoom no iOS e capturas de
 * tela de todas as páginas nos temas claro e escuro (anexadas ao relatório).
 */
import { expect, test } from '@playwright/test';
import { cadastrarBoleto, dataRelativa, ehCelular, navegarPara, semRolagemHorizontal, unico } from './auxiliares';

const PAGINAS = [
  '/',
  '/dashboard',
  '/transacoes',
  '/boletos',
  '/boletos/novo',
  '/fornecedores',
  '/meses',
  '/historico',
  '/configuracoes',
  '/configuracoes/empresas',
  '/configuracoes/categorias',
  '/contas',
  '/fechar-dia',
  '/contas/nova',
  '/cartoes',
  '/cartoes/novo',
  '/cartoes/compras/nova',
];

for (const tema of ['light', 'dark'] as const) {
  test(`todas as páginas sem rolagem horizontal — tema ${tema === 'light' ? 'claro' : 'escuro'}`, async ({ page }, info) => {
    test.setTimeout(150_000); // ~20 páginas, cada uma com captura de tela
    // Garante conteúdo (série com código) para as capturas.
    await cadastrarBoleto(page, {
      fornecedor: unico('Visual'),
      descricao: 'Série para captura de tela',
      vencimento: dataRelativa(0),
      valorDigitos: '299500',
      codigo: '00190000090123456789012345678901234567890123456',
      serie: { quantidade: 3 },
    });
    await page.evaluate((t) => localStorage.setItem('nonatofin-tema', t), tema);
    const paginas = [...PAGINAS];
    // inclui detalhe e edição de um boleto e o detalhe de um fornecedor e mês
    await page.goto('/boletos?filtro=todos');
    const detalhe = await page.getByTestId('cartao-boleto').first().getByRole('link', { name: /Ver detalhes/ }).getAttribute('href');
    paginas.push(detalhe!, `${detalhe}/editar`, `/meses/${dataRelativa(0).slice(0, 7)}`);
    await page.goto('/fornecedores');
    paginas.push((await page.getByTestId('cartao-fornecedor').first().getAttribute('href'))!);
    // detalhe de uma conta bancária (criada pelo teste de contas, se existir)
    await page.goto('/contas');
    const conta = page.getByTestId('item-conta').first();
    if (await conta.count()) paginas.push((await conta.getAttribute('href'))!);
    // cartão, fatura e compra (criados pelo teste de cartões, se existirem)
    await page.goto('/cartoes');
    const cartao = page.getByTestId('item-cartao').first();
    if (await cartao.count()) {
      const rotaCartao = (await cartao.getAttribute('href'))!;
      await page.goto(rotaCartao);
      const fatura = await page.getByTestId('item-fatura').first().getAttribute('href');
      const compra = await page.getByTestId('item-compra').first().getAttribute('href');
      paginas.push(rotaCartao, `${rotaCartao}/editar`, fatura!, compra!);
    }

    for (const rota of paginas) {
      await page.goto(rota);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('html')).toHaveClass(tema === 'dark' ? /dark/ : /^(?!.*dark)/);
      await semRolagemHorizontal(page);
      await info.attach(`${tema}${rota.replace(/\//g, '_')}.png`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });
    }
    await page.evaluate(() => localStorage.setItem('nonatofin-tema', 'light'));
  });
}

test('navegação adequada ao tamanho da tela e alcance de todas as páginas', async ({ page }) => {
  await page.goto('/');
  if (ehCelular(page)) {
    const barra = page.getByRole('navigation', { name: 'Principal' });
    await expect(barra).toBeVisible();
    await expect(page.getByRole('complementary')).toBeHidden();
    for (const item of await barra.getByRole('link').all()) {
      const caixa = await item.boundingBox();
      expect(caixa!.height, 'alvo de toque da barra inferior').toBeGreaterThanOrEqual(44);
    }
    const novo = barra.getByRole('button', { name: 'Novo lançamento' });
    await expect(novo).toBeVisible();
    expect((await novo.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  } else {
    await expect(page.getByRole('complementary')).toBeVisible();
  }
  for (const [rotulo, titulo] of [
    ['Dashboard', 'Dashboard'],
    ['Transações', 'Transações'],
    ['Boletos', 'Boletos'],
    ['Meses', 'Contas por mês'],
    ['Contas', 'Contas'],
    ['Cartões', 'Cartões'],
    ['Fornecedores', 'Fornecedores'],
    ['Histórico', 'Histórico de pagamentos'],
    ['Configurações', 'Configurações'],
  ]) {
    await navegarPara(page, rotulo);
    await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible();
  }
});

test('campos com 16px (sem zoom automático no iPhone) e botões de ação grandes', async ({ page }) => {
  await page.goto('/boletos/novo');
  const tamanhos = await page.locator('input:not([type=hidden]):not([type=radio]):not([type=checkbox]), select, textarea').evaluateAll((els) =>
    els.map((e) => parseFloat(getComputedStyle(e).fontSize)),
  );
  expect(tamanhos.length).toBeGreaterThan(3);
  for (const t of tamanhos) expect(t).toBeGreaterThanOrEqual(16);
  const salvar = await page.getByRole('button', { name: 'Salvar boleto' }).boundingBox();
  expect(salvar!.height).toBeGreaterThanOrEqual(44);
});

test('menu "Mais" e sair funcionam no celular', async ({ page }) => {
  test.skip(!ehCelular(page), 'somente celular/tablet');
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Principal' }).getByRole('button', { name: 'Mais' }).click();
  const menu = page.getByRole('dialog', { name: 'Menu' });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Sair' })).toBeVisible();
  await menu.getByRole('button', { name: 'Fechar' }).click();
  await expect(menu).toBeHidden();
});

for (const tema of ['light', 'dark'] as const) {
  test(`modais e formulário legíveis no tema ${tema === 'light' ? 'claro' : 'escuro'}`, async ({ page }, info) => {
    await page.goto('/configuracoes');
    await page.evaluate((t) => localStorage.setItem('nonatofin-tema', t), tema);
    await cadastrarBoleto(page, { fornecedor: unico('Modal'), descricao: 'Modal', vencimento: dataRelativa(1), valorDigitos: '1000' });
    await page.getByTestId('excluir-boleto').click();
    const dialogo = page.getByRole('alertdialog', { name: 'Excluir boleto?' });
    await expect(dialogo).toBeVisible();
    // O modal usa a superfície elevada do tema e o texto principal do tema.
    const cores = await dialogo.evaluate((el) => {
      const s = getComputedStyle(el);
      const raiz = getComputedStyle(document.documentElement);
      const resolver = (v: string) => {
        const d = document.createElement('div');
        d.style.color = v;
        document.body.appendChild(d);
        const c = getComputedStyle(d).color;
        d.remove();
        return c;
      };
      return { fundo: s.backgroundColor, texto: s.color, surface: resolver(raiz.getPropertyValue('--surface-elevated')), fg: resolver(raiz.getPropertyValue('--fg')) };
    });
    expect(cores.fundo).toBe(cores.surface);
    expect(cores.texto).toBe(cores.fg);
    const caixa = await dialogo.boundingBox();
    expect(caixa!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    await info.attach(`modal-${tema}.png`, { body: await page.screenshot(), contentType: 'image/png' });
    await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialogo).toBeHidden();
    await page.evaluate(() => localStorage.setItem('nonatofin-tema', 'light'));
  });
}
