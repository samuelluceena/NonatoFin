/**
 * Transações: visão centralizada (conta a pagar, pagamento, entrada,
 * transferência, ajuste), filtros na URL, pesquisa, detalhe existente,
 * menu de ações (desktop), acesso às Categorias, vazio e responsividade.
 * Os dados usam nomes únicos e a pesquisa isola cada execução.
 */
import { expect, test, type Page } from '@playwright/test';
import { EMPRESAS_E2E, cadastrarBoleto, dataRelativa, ehCelular, escolherOpcao, navegarPara, semRolagemHorizontal, unico } from './auxiliares';

const EMPRESA = EMPRESAS_E2E[1].apelido;
const reais = (texto: string) => new RegExp(`R\\$\\s${texto.replace('.', '\\.')}`);

/** Lista visível (cartões no celular/tablet, tabela a partir de 1280px). */
function itens(page: Page) {
  return (page.viewportSize()?.width ?? 1440) >= 1280 ? page.getByTestId('linha-transacao') : page.getByTestId('item-transacao');
}

function vigiarConsole(page: Page) {
  const erros: string[] = [];
  page.on('console', (m) => m.type() === 'error' && erros.push(m.text()));
  page.on('pageerror', (e) => erros.push(e.message));
  return erros;
}

async function criarConta(page: Page, apelido: string, saldoDigitos: string) {
  await page.goto('/contas/nova');
  await escolherOpcao(page.locator('#empresaId').filter({ visible: true }), EMPRESA);
  await page.getByLabel('Apelido da conta').fill(apelido);
  await page.getByLabel('Banco', { exact: true }).fill('Banco de Teste');
  await page.locator('#saldoInicialCentavos').fill(saldoDigitos);
  await page.getByRole('button', { name: 'Salvar conta' }).click();
  await expect(page).toHaveURL(/\/contas\/[0-9a-f-]{36}$/);
  return page.url();
}

test('lista centralizada: tipos, status, valores, filtros, pesquisa e detalhe', async ({ page }) => {
  test.setTimeout(120_000);
  const erros = vigiarConsole(page);
  const marca = unico('Trx');
  const fornecedor = `${marca} Fornecedor`;

  // Conta com saldo inicial, uma entrada e uma segunda conta para transferência.
  const urlConta = await criarConta(page, `${marca} Itaú`, '100000');
  await page.getByTestId('nova-entrada').click();
  await page.getByLabel('Descrição').fill(`${marca} vendas`);
  await page.locator('#entrada-valor').pressSequentially('25000');
  await page.getByTestId('salvar-entrada').click();
  await expect(page.getByText('Entrada adicionada.')).toBeVisible();
  await criarConta(page, `${marca} Caixa`, '');
  await page.goto(urlConta);
  await page.getByTestId('nova-transferencia').click();
  await escolherOpcao(page.locator('#transf-destino'), `${marca} Caixa — ${EMPRESA}`);
  await page.locator('#transf-valor').pressSequentially('4000');
  await page.locator('#transf-descricao').fill(`${marca} reserva`);
  await page.getByTestId('salvar-transferencia').click();
  await expect(page.getByText('Transferência concluída.')).toBeVisible();

  // Uma conta a pagar (futura) e uma paga hoje.
  await cadastrarBoleto(page, { empresa: EMPRESA, fornecedor, descricao: `${marca} aluguel`, vencimento: dataRelativa(3), valorDigitos: '50000' });
  await cadastrarBoleto(page, { empresa: EMPRESA, fornecedor, descricao: `${marca} energia`, vencimento: dataRelativa(0), valorDigitos: '12345' });
  const urlPago = page.url();
  await page.getByTestId('marcar-pago').click();
  await expect(page.getByRole('button', { name: 'Desfazer pagamento' })).toBeVisible();

  // Navegação: Transações está no menu.
  await page.goto('/');
  await navegarPara(page, 'Transações');
  await expect(page.getByRole('heading', { level: 1, name: 'Transações' })).toBeVisible();

  // Pesquisa isola esta execução: descrições e fornecedor têm a marca.
  await page.getByLabel('Pesquisar transações por descrição ou fornecedor').fill(marca);
  await expect(page).toHaveURL(/q=/);
  const lista = itens(page);
  await expect(lista.filter({ hasText: `${marca} vendas` })).toHaveCount(1);
  await expect(lista.filter({ hasText: `${marca} reserva` })).toHaveCount(1);
  await expect(lista.filter({ hasText: `${marca} aluguel` })).toHaveCount(1);
  await expect(lista.filter({ hasText: `${marca} energia` })).toHaveCount(1);

  // Tipo, status e valor com sinal (e texto, não só cor).
  const entrada = lista.filter({ hasText: `${marca} vendas` });
  await expect(entrada).toHaveAttribute('data-tipo', 'entrada');
  await expect(entrada).toContainText('Confirmado');
  await expect(entrada).toContainText(reais('250,00'));
  await expect(entrada).toContainText('+');
  const pago = lista.filter({ hasText: `${marca} energia` });
  await expect(pago).toHaveAttribute('data-tipo', 'pagamento');
  await expect(pago).toContainText('Pago');
  await expect(pago).toContainText('−');
  const aPagar = lista.filter({ hasText: `${marca} aluguel` });
  await expect(aPagar).toHaveAttribute('data-tipo', 'conta-a-pagar');
  await expect(aPagar).toContainText('Pendente');
  const transf = lista.filter({ hasText: `${marca} reserva` });
  await expect(transf).toHaveAttribute('data-tipo', 'transferencia');
  await expect(transf).toContainText(`${marca} Itaú`);
  await expect(transf).toContainText(`${marca} Caixa`);
  await expect(page.getByTestId('total-entradas')).toContainText(reais('250,00'));
  await expect(page.getByTestId('total-pagamentos')).toContainText(reais('123,45'));
  await expect(page.getByTestId('total-a-pagar')).toContainText(reais('500,00'));
  await semRolagemHorizontal(page);

  // Filtro por tipo (na URL) e etiqueta removível.
  await escolherOpcao(page.locator('#filtro-tipo'), 'Pagamentos');
  await expect(page).toHaveURL(/tipo=pagamentos/);
  await expect(lista).toHaveCount(1);
  await expect(lista.first()).toHaveAttribute('data-tipo', 'pagamento');
  await page.reload();
  await expect(itens(page)).toHaveCount(1); // filtros sobrevivem ao recarregar
  await page.getByRole('button', { name: 'Remover filtro: Pagamentos' }).click();
  await expect(page).not.toHaveURL(/tipo=/);
  await expect(itens(page).filter({ hasText: `${marca} vendas` })).toHaveCount(1);

  // Status: em aberto só traz a conta a pagar.
  await escolherOpcao(page.locator('#filtro-status'), 'Em aberto');
  await expect(itens(page)).toHaveCount(1);
  await expect(itens(page).first()).toHaveAttribute('data-tipo', 'conta-a-pagar');

  // Limpar filtros volta ao padrão (sem pesquisa).
  await page.getByRole('button', { name: 'Limpar filtros' }).click();
  await expect(page).toHaveURL(/\/transacoes$/);

  // Detalhe: reaproveita as telas existentes.
  await page.goto(`/transacoes?q=${encodeURIComponent(marca)}&tipo=pagamentos`);
  if ((page.viewportSize()?.width ?? 0) >= 1280) await itens(page).first().getByRole('link').first().click();
  else await itens(page).first().click();
  await expect(page).toHaveURL(urlPago);

  expect(erros, 'erros no console').toEqual([]);
});

test('período, vazio e acesso às Categorias', async ({ page }) => {
  const erros = vigiarConsole(page);
  await page.goto('/transacoes?q=nada-encontrado-xyz');
  await expect(page.getByText('Nenhuma transação encontrada')).toBeVisible();

  await page.goto('/transacoes');
  await escolherOpcao(page.locator('#filtro-periodo'), 'Um dia');
  await expect(page).toHaveURL(/periodo=dia/);
  await expect(page.getByLabel('Dia', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Dia anterior' }).click();
  await expect(page).toHaveURL(new RegExp(`dia=${dataRelativa(-1)}`));
  await escolherOpcao(page.locator('#filtro-periodo'), 'Intervalo de datas');
  await expect(page).toHaveURL(/periodo=intervalo/);
  await expect(page.getByTestId('resumo-lista')).toContainText(' a ');

  await page.getByTestId('link-categorias').click();
  await expect(page).toHaveURL(/\/configuracoes\/categorias\?origem=transacoes$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Categorias' })).toBeVisible();
  await page.getByRole('link', { name: 'Transações' }).first().click();
  await expect(page).toHaveURL(/\/transacoes$/);
  expect(erros, 'erros no console').toEqual([]);
});

test('desktop: tabela com menu de ações acessível pelo teclado', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1280, 'tabela somente a partir de 1280px');
  await page.goto('/transacoes?periodo=todos');
  await expect(page.getByTestId('tabela-transacoes')).toBeVisible();
  await expect(page.getByTestId('lista-transacoes')).toBeHidden();
  const menu = page.getByTestId('linha-transacao').first().getByRole('button', { name: /^Ações:/ });
  await menu.focus();
  await page.keyboard.press('ArrowDown');
  const itensMenu = page.getByRole('menu').getByRole('menuitem');
  await expect(itensMenu.first()).toBeFocused();
  await expect(itensMenu.first()).toHaveText('Ver detalhes');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(menu).toBeFocused();
});

test('celular: lista própria (sem tabela) e sem rolagem horizontal', async ({ page }) => {
  test.skip(!ehCelular(page), 'somente celular/tablet');
  await page.goto('/transacoes?periodo=todos');
  await expect(page.getByTestId('tabela-transacoes')).toBeHidden();
  await semRolagemHorizontal(page);
  for (const item of (await page.getByTestId('item-transacao').all()).slice(0, 5)) {
    expect((await item.boundingBox())!.height, 'alvo de toque').toBeGreaterThanOrEqual(44);
  }
});
