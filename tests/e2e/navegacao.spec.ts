/**
 * Navegação (shell): sidebar agrupada e recolhível no desktop (estado salvo,
 * dicas, nomes acessíveis, item ativo, teclado) e barra inferior + menu "Mais"
 * no celular (composição, item ativo, safe area, conteúdo não coberto).
 */
import { expect, test, type Page } from '@playwright/test';
import { ehCelular } from './auxiliares';

const sidebar = (page: Page) => page.getByRole('complementary');

test.describe('desktop', () => {
  test.beforeEach(({ page }) => {
    test.skip(ehCelular(page), 'somente desktop (a partir de 1024px)');
  });

  test('sidebar agrupada, item ativo e teclado', async ({ page }) => {
    await page.context().clearCookies({ name: 'nonatofin-sidebar' });
    await page.goto('/transacoes');
    const nav = sidebar(page).getByRole('navigation', { name: 'Principal' });
    await expect(nav.getByRole('group')).toHaveCount(3);
    for (const [grupo, itens] of [
      ['Principal', ['Hoje', 'Transações', 'Boletos', 'Contas', 'Fechar o dia']],
      ['Gestão', ['Dashboard', 'Cartões', 'Meses', 'Fornecedores', 'Histórico']],
      ['Sistema', ['Configurações']],
    ] as const) {
      await expect(nav.getByRole('group', { name: grupo }).getByRole('link')).toHaveText([...itens]);
    }
    const ativo = nav.getByRole('link', { name: 'Transações', exact: true });
    await expect(ativo).toHaveAttribute('aria-current', 'page');
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);

    // Teclado: foco visível e navegação por Enter.
    await nav.getByRole('link', { name: 'Boletos', exact: true }).focus();
    const contorno = await nav.getByRole('link', { name: 'Boletos', exact: true }).evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(contorno).not.toBe('none');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/boletos$/);
    await expect(nav.getByRole('link', { name: 'Boletos', exact: true })).toHaveAttribute('aria-current', 'page');

    // Rodapé: tema e sair; empresa e "Novo lançamento" no topo.
    await expect(sidebar(page).getByTestId('alternar-tema')).toBeVisible();
    await expect(sidebar(page).getByRole('button', { name: 'Sair' })).toBeVisible();
    await expect(sidebar(page).getByTestId('seletor-empresa')).toBeVisible();
    await expect(sidebar(page).getByRole('button', { name: 'Novo lançamento' })).toBeVisible();
  });

  test('recolher e expandir: ícones com dica, nomes acessíveis e estado salvo', async ({ page }) => {
    await page.context().clearCookies({ name: 'nonatofin-sidebar' });
    await page.goto('/');
    const larguraAberta = (await sidebar(page).boundingBox())!.width;
    await sidebar(page).getByRole('button', { name: 'Recolher menu' }).click();
    await expect(sidebar(page)).toHaveAttribute('data-compacta', 'true');
    await expect.poll(async () => (await sidebar(page).boundingBox())!.width).toBeLessThan(larguraAberta / 2);

    // Nomes continuam acessíveis e a dica aparece ao passar o mouse.
    const link = sidebar(page).getByRole('link', { name: 'Dashboard', exact: true });
    await expect(link).toBeVisible();
    await link.hover();
    const dica = link.locator('xpath=..').getByText('Dashboard', { exact: true }).last();
    await expect.poll(() => dica.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');

    // "Novo lançamento" continua disponível (só o ícone).
    await sidebar(page).getByRole('button', { name: 'Novo lançamento' }).click();
    await expect(page.getByTestId('acao-despesa')).toBeVisible();
    await page.keyboard.press('Escape');

    // Estado salvo (cookie lido no servidor): recarrega já recolhida.
    await page.reload();
    await expect(sidebar(page)).toHaveAttribute('data-compacta', 'true');
    await sidebar(page).getByRole('button', { name: 'Expandir menu' }).click();
    await expect(sidebar(page)).not.toHaveAttribute('data-compacta', 'true');
    await page.reload();
    await expect(sidebar(page)).not.toHaveAttribute('data-compacta', 'true');
  });
});

test.describe('celular', () => {
  test.beforeEach(({ page }) => {
    test.skip(!ehCelular(page), 'somente celular/tablet');
  });

  test('barra inferior: Hoje, Transações, +, Dashboard, Mais', async ({ page }) => {
    await page.goto('/transacoes');
    const barra = page.getByRole('navigation', { name: 'Principal' });
    await expect(barra.getByRole('link')).toHaveText(['Hoje', 'Transações', 'Dashboard']);
    await expect(barra.getByRole('button')).toHaveText(['', 'Mais']);
    await expect(barra.getByRole('button', { name: 'Novo lançamento' })).toBeVisible();
    await expect(barra.getByRole('link', { name: 'Transações' })).toHaveAttribute('aria-current', 'page');
    await expect(barra.locator('[aria-current="page"]')).toHaveCount(1);
    // Barra encostada no fim da tela, sem cobrir o fim do conteúdo.
    const caixa = (await barra.boundingBox())!;
    const altura = page.viewportSize()!.height;
    expect(Math.round(caixa.y + caixa.height)).toBe(altura);
    const folga = await page.locator('main').evaluate((m) => parseFloat(getComputedStyle(m).paddingBottom));
    expect(folga).toBeGreaterThanOrEqual(caixa.height);
  });

  test('menu "Mais" agrupado leva às demais áreas e marca o item ativo', async ({ page }) => {
    await page.goto('/cartoes');
    const barra = page.getByRole('navigation', { name: 'Principal' });
    const mais = barra.getByRole('button', { name: 'Mais' });
    await expect(mais).toHaveAttribute('aria-expanded', 'false');
    await mais.click();
    await expect(mais).toHaveAttribute('aria-expanded', 'true');
    const menu = page.getByRole('navigation', { name: 'Mais opções' });
    await expect(menu.getByRole('group')).toHaveCount(3);
    await expect(menu.getByRole('group', { name: 'Principal' }).getByRole('link')).toHaveText(['Boletos', 'Contas', 'Fechar o dia']);
    await expect(menu.getByRole('group', { name: 'Gestão' }).getByRole('link')).toHaveText(['Cartões', 'Meses', 'Fornecedores', 'Histórico']);
    await expect(menu.getByRole('link', { name: 'Cartões' })).toHaveAttribute('aria-current', 'page');
    for (const link of await menu.getByRole('link').all()) {
      expect((await link.boundingBox())!.height, 'alvo de toque').toBeGreaterThanOrEqual(44);
    }
    await menu.getByRole('link', { name: 'Boletos' }).click();
    await expect(page).toHaveURL(/\/boletos$/);
    await expect(page.getByRole('dialog', { name: 'Menu' })).toBeHidden();
  });
});
