/**
 * Empresas (CNPJ), seletor de empresa, categorias e cartões de crédito
 * com compra parcelada → fatura a pagar → ajuste → trava após pagamento.
 */
import { expect, test, type Page } from '@playwright/test';
import { calcularDigitosCnpj } from '../../src/lib/domain/cnpj';
import { EMPRESAS_E2E, cadastrarBoleto, dataRelativa, escolherOpcao, semRolagemHorizontal, unico } from './auxiliares';

/** CNPJ numérico válido e aleatório (evita repetir entre execuções). */
function cnpjAleatorio(): string {
  const base = String(Math.floor(Math.random() * 1e12)).padStart(12, '0');
  return base + calcularDigitosCnpj(base);
}

const seletorVisivel = (page: Page) => page.getByTestId('seletor-empresa').filter({ visible: true });
/** Diálogo aberto (comum ou de confirmação — alertdialog). */
const dialogo = (page: Page) => page.getByRole('dialog').or(page.getByRole('alertdialog'));

test('cadastra, valida CNPJ e exclui uma empresa', async ({ page }) => {
  const apelido = unico('Empresa');
  await page.goto('/configuracoes/empresas');
  await page.getByRole('button', { name: 'Nova empresa' }).click();
  await dialogo(page).getByLabel('Apelido').fill(apelido);
  await dialogo(page).getByLabel('CNPJ').fill('11.222.333/0001-82');
  await dialogo(page).getByRole('button', { name: 'Salvar' }).click();
  await expect(dialogo(page).getByText(/CNPJ inválido/)).toBeVisible();

  const cnpj = cnpjAleatorio();
  await dialogo(page).getByLabel('CNPJ').fill(cnpj);
  await expect(dialogo(page).getByText('CNPJ válido.')).toBeVisible();
  await dialogo(page).getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Empresa cadastrada.')).toBeVisible();
  const lista = page.getByTestId('lista-empresas');
  await expect(lista.getByText(apelido)).toBeVisible();
  await expect(lista.getByText(`CNPJ ${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`)).toBeVisible();
  await semRolagemHorizontal(page);

  await page.getByRole('button', { name: `Excluir ${apelido}` }).click();
  await dialogo(page).getByRole('button', { name: 'Excluir' }).click();
  await expect(page.getByText('Empresa excluída.')).toBeVisible();
  await expect(lista.getByText(apelido)).toHaveCount(0);
});

test('seletor do topo filtra os lançamentos por empresa', async ({ page }) => {
  const marca = unico('Filtro');
  await cadastrarBoleto(page, {
    empresa: EMPRESAS_E2E[0].apelido,
    fornecedor: `${marca} Alfa`,
    descricao: 'Da primeira empresa',
    vencimento: dataRelativa(4),
    valorDigitos: '1000',
  });
  await expect(page.getByRole('main').locator('dd', { hasText: EMPRESAS_E2E[0].apelido })).toContainText('CNPJ 12.345.678/0001-95');
  await cadastrarBoleto(page, {
    empresa: EMPRESAS_E2E[1].apelido,
    fornecedor: `${marca} Beta`,
    descricao: 'Da segunda empresa',
    vencimento: dataRelativa(4),
    valorDigitos: '2000',
  });

  await page.goto(`/boletos?filtro=todos&q=${encodeURIComponent(marca)}`);
  await expect(page.getByText('Da primeira empresa')).toBeVisible();
  await expect(page.getByText('Da segunda empresa')).toBeVisible();

  await escolherOpcao(seletorVisivel(page), EMPRESAS_E2E[1].apelido);
  await expect(page.getByText('Da primeira empresa')).toHaveCount(0);
  await expect(page.getByText('Da segunda empresa')).toBeVisible();

  // O novo boleto já vem com a empresa selecionada.
  await page.goto('/boletos/novo');
  await expect(page.locator('#empresaId').filter({ visible: true })).toHaveAttribute('data-valor', /[0-9a-f-]{36}/);
  await expect(page.locator('#empresaId').filter({ visible: true })).toHaveText(EMPRESAS_E2E[1].apelido);

  await page.goto(`/boletos?filtro=todos&q=${encodeURIComponent(marca)}`);
  await escolherOpcao(seletorVisivel(page), 'Todas as empresas');
  await expect(page.getByText('Da primeira empresa')).toBeVisible();
  await expect(page.getByText('Da segunda empresa')).toBeVisible();

  await page.goto('/dashboard');
  await expect(page.getByTestId('secao-por-empresa')).toBeVisible();
  await expect(page.getByTestId('secao-por-categoria')).toBeVisible();
});

test('cria, edita e exclui categoria; categoria em uso não é excluída', async ({ page }) => {
  const nome = unico('Impostos');
  await page.goto('/configuracoes/categorias');
  await page.getByRole('button', { name: 'Nova categoria' }).click();
  await dialogo(page).getByLabel('Nome').fill(nome);
  await dialogo(page).getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Categoria criada.')).toBeVisible();

  await expect(page.getByTestId('item-categoria').filter({ hasText: nome }).getByTestId('uso-categoria')).toHaveText('Sem uso');
  await page.getByRole('button', { name: `Editar ${nome}` }).click();
  await expect(dialogo(page).getByRole('heading', { name: 'Editar categoria' })).toBeVisible();
  await dialogo(page).getByLabel('Nome').fill(`${nome} 2`);
  await dialogo(page).getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Categoria atualizada.')).toBeVisible();

  await page.getByRole('button', { name: `Excluir ${nome} 2` }).click();
  await dialogo(page).getByRole('button', { name: 'Excluir categoria' }).click();
  await expect(page.getByText('Categoria excluída.')).toBeVisible();
  await expect(page.getByTestId('lista-categorias').getByText(`${nome} 2`)).toHaveCount(0);

  // "Boleto de fornecedor" está em uso pelos boletos de outros testes.
  await cadastrarBoleto(page, { categoria: 'Boleto de fornecedor', fornecedor: unico('Uso'), descricao: 'Em uso', vencimento: dataRelativa(2), valorDigitos: '100' });
  await page.goto('/configuracoes/categorias');
  const emUso = page.getByTestId('item-categoria').filter({ hasText: 'Boleto de fornecedor' });
  await expect(emUso.getByTestId('selo-em-uso')).toHaveText('Em uso');
  await expect(emUso.getByTestId('uso-categoria')).toContainText(/\d+ lançamentos?/);
  await page.getByRole('button', { name: 'Excluir Boleto de fornecedor' }).click();
  await expect(dialogo(page).getByTestId('aviso-categoria-em-uso')).toContainText('está sendo utilizada em transações e não pode ser excluída');
  await expect(dialogo(page).getByRole('button', { name: 'Excluir categoria' })).toHaveCount(0);
  await dialogo(page).getByRole('button', { name: 'Entendi' }).click();
  await expect(page.getByTestId('lista-categorias').getByText('Boleto de fornecedor')).toBeVisible();
});

test('cartão: compra parcelada vira faturas, ajuste e trava após pagar', async ({ page }) => {
  const nome = unico('Nubank');

  // 1. Cadastrar o cartão
  await page.goto('/cartoes/novo');
  await escolherOpcao(page.locator('#empresaId').filter({ visible: true }), EMPRESAS_E2E[0].apelido);
  await page.getByLabel('Nome do cartão').fill(nome);
  await page.getByLabel(/Final/).fill('4321');
  await page.getByLabel('Banco / emissor').fill(unico('Banco'));
  await page.getByLabel('Dia do fechamento').fill('3');
  await page.getByLabel('Dia do vencimento').fill('10');
  await expect(page.getByTestId('exemplo-fatura')).toBeVisible();
  await expect(page.locator('#categoriaFaturaId')).toHaveText('Cartão de crédito');
  await semRolagemHorizontal(page);
  await page.getByRole('button', { name: 'Salvar cartão' }).click();
  await expect(page).toHaveURL(/\/cartoes\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(nome);

  // 2. Compra de R$ 100,00 em 3x
  await page.getByRole('link', { name: 'Nova compra' }).first().click();
  await expect(page).toHaveURL(/\/cartoes\/compras\/nova\?cartao=/);
  await expect(page.locator('#cartaoId')).toContainText(nome);
  await page.getByLabel('O que foi comprado').fill('Tecidos');
  await page.locator('#valorTotalCentavos').pressSequentially('10000');
  await escolherOpcao(page.locator('#parcelas').filter({ visible: true }), '3x');
  const previa = page.getByTestId('previa-parcelas');
  await expect(previa).toContainText('3x: 1ª de R$ 33,34 e 2 de R$ 33,33');
  await expect(previa.getByRole('listitem')).toHaveCount(3);
  await semRolagemHorizontal(page);
  await page.getByRole('button', { name: 'Lançar compra' }).click();
  await expect(page.getByText('Compra lançada em 3 parcelas.')).toBeVisible();
  await expect(page).toHaveURL(/\/cartoes\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId('item-compra')).toHaveCount(1);
  await expect(page.getByTestId('item-fatura')).toHaveCount(3);

  // 3. Fatura: parcela, ajuste e total
  await page.getByTestId('item-fatura').first().click();
  await expect(page).toHaveURL(/\/boletos\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId('parcela-fatura')).toContainText('Parcela 1/3');
  await expect(page.getByRole('link', { name: 'Editar' })).toHaveCount(0);
  await expect(page.getByTestId('excluir-boleto')).toHaveCount(0);
  await page.getByTestId('ajustar-fatura').click();
  await dialogo(page).getByLabel('Valor do ajuste').pressSequentially('500');
  await expect(page.getByTestId('resumo-ajuste')).toContainText(/R\$\s38,34/);
  await page.getByTestId('salvar-ajuste').click();
  await expect(page.getByText('Fatura ajustada.')).toBeVisible();
  await expect(page.getByTestId('totais-fatura')).toContainText(/Total da fatura\s*R\$\s38,34/);
  await semRolagemHorizontal(page);

  // 4. Pagar trava as compras da fatura
  await page.getByTestId('marcar-pago').click();
  await expect(page.getByTestId('ajustar-fatura')).toHaveCount(0);
  await page.getByTestId('parcela-fatura').click();
  await expect(page).toHaveURL(/\/cartoes\/compras\/[0-9a-f-]{36}\/editar$/);
  await page.getByLabel('O que foi comprado').fill('Tecidos alterado');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByText(/já está paga/)).toBeVisible();
});

test('lista de cartões mostra próxima fatura e total em aberto', async ({ page }) => {
  await page.goto('/cartoes');
  await expect(page.getByRole('heading', { level: 1, name: 'Cartões' })).toBeVisible();
  await expect(page.getByTestId('item-cartao').first()).toBeVisible();
  await expect(page.getByTestId('resumo-cartoes')).toContainText('Faturas em aberto');
  await semRolagemHorizontal(page);
});
