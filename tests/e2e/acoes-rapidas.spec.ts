/**
 * Ações rápidas ("+"): abre e fecha (Esc, clique fora, botão fechar),
 * Despesa → Conta a pagar / Compra no cartão (fluxos existentes) e
 * Entrada → diálogo de entrada com escolha da conta. Celular (speed dial na
 * barra inferior) e desktop (botão do menu lateral).
 */
import { expect, test, type Page } from '@playwright/test';
import { EMPRESAS_E2E, ehCelular, escolherOpcao, semRolagemHorizontal, unico } from './auxiliares';

const EMPRESA = EMPRESAS_E2E[1].apelido;

function gatilho(page: Page) {
  return page.getByTestId('acoes-rapidas').filter({ visible: true });
}

async function abrir(page: Page) {
  await gatilho(page).click();
  await expect(page.getByTestId('acao-despesa')).toBeVisible();
  await expect(gatilho(page)).toHaveAttribute('aria-expanded', 'true');
}

function vigiarConsole(page: Page) {
  const erros: string[] = [];
  page.on('console', (m) => m.type() === 'error' && erros.push(m.text()));
  page.on('pageerror', (e) => erros.push(e.message));
  return erros;
}

test('abre e fecha: Esc, clique fora e botão fechar', async ({ page }) => {
  const erros = vigiarConsole(page);
  await page.goto('/');
  if (ehCelular(page)) {
    await expect(page.getByRole('navigation', { name: 'Principal' }).getByRole('button', { name: 'Novo lançamento' })).toBeVisible();
  }

  await abrir(page);
  await expect(page.getByTestId('acao-despesa')).toContainText('Despesa');
  await expect(page.getByTestId('acao-entrada')).toContainText('Entrada');
  for (const id of ['acao-despesa', 'acao-entrada']) {
    expect((await page.getByTestId(id).boundingBox())!.height, 'alvo de toque').toBeGreaterThanOrEqual(44);
  }
  await expect(page.getByTestId('acao-despesa')).toBeFocused();
  await semRolagemHorizontal(page);

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('acao-despesa')).toBeHidden();
  await expect(gatilho(page)).toHaveAttribute('aria-expanded', 'false');

  await abrir(page);
  await page.mouse.click(10, 10); // fora das opções
  await expect(page.getByTestId('acao-despesa')).toBeHidden();

  if (ehCelular(page)) {
    await abrir(page);
    await page.getByRole('dialog').getByRole('button', { name: 'Fechar' }).click();
    await expect(page.getByTestId('acao-despesa')).toBeHidden();
  }
  expect(erros, 'erros no console').toEqual([]);
});

test('Despesa → Conta a pagar e Compra no cartão abrem os formulários existentes', async ({ page }) => {
  const erros = vigiarConsole(page);
  await page.goto('/');
  await abrir(page);
  await page.getByTestId('acao-despesa').click();
  await expect(page.getByTestId('acao-conta-a-pagar')).toBeVisible();
  await expect(page.getByTestId('acao-compra-cartao')).toBeVisible();

  // Voltar retorna às duas opções
  await page.getByRole('button', { name: 'Voltar' }).click();
  await expect(page.getByTestId('acao-entrada')).toBeVisible();

  await page.getByTestId('acao-despesa').click();
  await page.getByTestId('acao-conta-a-pagar').click();
  await expect(page).toHaveURL(/\/boletos\/novo$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Novo boleto' })).toBeVisible();

  await abrir(page);
  await page.getByTestId('acao-despesa').click();
  await page.getByTestId('acao-compra-cartao').click();
  await expect(page).toHaveURL(/\/cartoes\/compras\/nova$/);
  expect(erros, 'erros no console').toEqual([]);
});

test('Entrada → escolhe a conta e registra no saldo', async ({ page }) => {
  const erros = vigiarConsole(page);
  const apelido = unico('Caixa');
  await page.goto('/contas/nova');
  await escolherOpcao(page.locator('#empresaId').filter({ visible: true }), EMPRESA);
  await page.getByLabel('Apelido da conta').fill(apelido);
  await page.getByLabel('Banco', { exact: true }).fill('Banco de Teste');
  await page.locator('#saldoInicialCentavos').fill('10000');
  await page.getByRole('button', { name: 'Salvar conta' }).click();
  await expect(page).toHaveURL(/\/contas\/[0-9a-f-]{36}$/);
  const urlConta = page.url();
  await expect(page.getByTestId('saldo-conta')).toHaveText(/R\$\s100,00/);

  await page.goto('/');
  await abrir(page);
  await page.getByTestId('acao-entrada').click();
  const dialogo = page.getByRole('dialog', { name: 'Registrar entrada' });
  await expect(dialogo).toBeVisible();
  const conta = dialogo.locator('#entrada-conta');
  const rotulo = await conta.locator('option', { hasText: apelido }).textContent();
  await escolherOpcao(conta, rotulo!);
  await dialogo.getByLabel('Descrição').fill('Pix recebido');
  await dialogo.locator('#entrada-valor').pressSequentially('2500');
  await page.getByTestId('salvar-entrada').click();
  await expect(page.getByText('Entrada adicionada.')).toBeVisible();
  await expect(dialogo).toBeHidden();

  await page.goto(urlConta);
  await expect(page.getByTestId('saldo-conta')).toHaveText(/R\$\s125,00/);
  await expect(page.getByTestId('extrato')).toContainText('Pix recebido');
  expect(erros, 'erros no console').toEqual([]);
});

test('Entrada sem conta escolhida mostra o erro no campo', async ({ page }) => {
  await page.goto('/');
  await abrir(page);
  await page.getByTestId('acao-entrada').click();
  const dialogo = page.getByRole('dialog', { name: 'Registrar entrada' });
  const conta = dialogo.locator('#entrada-conta');
  await expect(conta).toBeVisible();
  if ((await conta.inputValue()) !== '') await conta.selectOption('');
  await dialogo.getByLabel('Descrição').fill('Teste');
  await dialogo.locator('#entrada-valor').pressSequentially('100');
  await page.getByTestId('salvar-entrada').click();
  await expect(dialogo.getByText('Selecione a conta.')).toBeVisible();
  await dialogo.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialogo).toBeHidden();
});

test('movimento reduzido: com prefers-reduced-motion, as animações são desligadas', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await gatilho(page).click();
  const item = page.getByTestId('acao-despesa');
  await expect(item).toBeVisible();
  const duracao = await item.evaluate((el) => parseFloat(getComputedStyle(el).animationDuration));
  expect(duracao, 'animação desligada').toBeLessThan(0.01);
  await page.keyboard.press('Escape');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
});
