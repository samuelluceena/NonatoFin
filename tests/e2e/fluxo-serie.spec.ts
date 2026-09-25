/**
 * Fluxo de série: criar 5 lançamentos → conferir valores, datas e fornecedor →
 * editar o 3º e os próximos → validar → excluir um → validar os restantes.
 */
import { expect, test, type Page } from '@playwright/test';
import { adicionarMeses } from '../../src/lib/domain/datas';
import { br, CODIGO_47, unico, EMPRESAS_E2E, escolherOpcao } from './auxiliares';

const ANO = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric' }).format(new Date())) + 1;
const PRIMEIRO = `${ANO}-01-31`;
const DATAS = [0, 1, 2, 3, 4].map((i) => adicionarMeses(PRIMEIRO, i));

async function linhasDaSerie(page: Page) {
  const secao = page.locator('section[aria-labelledby="titulo-serie"]');
  await expect(secao).toBeVisible();
  return secao.getByRole('link');
}

test('série de 5 lançamentos: criar, editar próximos e excluir um', async ({ page }) => {
  const fornecedor = unico('Via da Moda');

  // 1. Criar 5 lançamentos
  await page.goto('/boletos/novo');
  await escolherOpcao(page.locator('#empresaId').filter({ visible: true }), EMPRESAS_E2E[0].apelido);
  await page.getByLabel('Fornecedor').fill(fornecedor);
  await page.getByLabel('Nome / descrição').fill('Compra coleção');
  await page.getByText('Vários meses', { exact: true }).click();
  await expect(page.getByText('Primeiro vencimento', { exact: true })).toBeVisible();
  await page.locator('#vencimento').fill(PRIMEIRO);
  await page.locator('#valorCentavos').pressSequentially('299500');
  await page.getByLabel('Quantidade de lançamentos').fill('5');
  await page.getByLabel(/Código de barras/).fill(CODIGO_47);

  // Resumo antes de salvar (valor NÃO é dividido)
  const previa = page.getByTestId('previa-serie');
  await expect(previa).toContainText('Serão criados 5 lançamentos de R$ 2.995,00, totalizando R$ 14.975,00.');
  for (const [i, d] of DATAS.entries()) await expect(previa).toContainText(`${br(d)} — ${i + 1}/5`);
  // "mesmo código em todos" desmarcado por padrão
  await expect(page.getByLabel('Usar o mesmo código em todos os lançamentos')).not.toBeChecked();

  await page.getByRole('button', { name: 'Criar lançamentos' }).click();
  await expect(page.getByText('5 lançamentos criados.')).toBeVisible();
  await expect(page).toHaveURL(/\/boletos\/[0-9a-f-]{36}$/);

  // 2 e 3. Conferir valores e datas (31/01 -> 28/02 -> 31/03 -> 30/04 -> 31/05)
  let linhas = await linhasDaSerie(page);
  await expect(linhas).toHaveCount(5);
  for (const [i, d] of DATAS.entries()) {
    await expect(linhas.nth(i)).toContainText(`${i + 1}/5`);
    await expect(linhas.nth(i)).toContainText(br(d));
    await expect(linhas.nth(i)).toContainText('R$ 2.995,00');
  }
  // Código somente no 1º
  await expect(page.getByTestId('codigo-completo')).toBeVisible();
  await linhas.nth(1).click();
  await expect(page.getByTestId('codigo-completo')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Adicionar código' })).toBeVisible();

  // 4. Conferir fornecedor
  await page.getByRole('link', { name: fornecedor }).click();
  await expect(page.getByRole('heading', { level: 1, name: fornecedor })).toBeVisible();
  await expect(page.getByTestId('forn-total')).toHaveText('R$ 14.975,00');
  await expect(page.getByTestId('cartao-boleto')).toHaveCount(5);

  // 5. Editar o 3º e os próximos
  await page.getByTestId('cartao-boleto').filter({ hasText: 'Parcela 3/5' }).getByRole('link', { name: /Ver detalhes/ }).click();
  await page.getByRole('link', { name: 'Editar' }).click();
  const valor = page.locator('#valorCentavos');
  await valor.fill('');
  await valor.pressSequentially('350000');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Alterar boleto da série' });
  await expect(dialogo).toBeVisible();
  await dialogo.getByText('Alterar este e os próximos').click();
  await dialogo.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('3 boletos atualizados.')).toBeVisible();

  // 6. Validar
  linhas = await linhasDaSerie(page);
  const esperado = ['R$ 2.995,00', 'R$ 2.995,00', 'R$ 3.500,00', 'R$ 3.500,00', 'R$ 3.500,00'];
  for (const [i, v] of esperado.entries()) {
    await expect(linhas.nth(i)).toContainText(v);
    await expect(linhas.nth(i)).toContainText(br(DATAS[i]));
  }

  // 7. Excluir um (a 2ª parcela, somente ela)
  await linhas.nth(1).click();
  await expect(page.getByText('Parcela 2/5').first()).toBeVisible();
  await page.getByTestId('excluir-boleto').click();
  const dialogoExcluir = page.getByRole('alertdialog', { name: 'Excluir boleto da série' });
  await expect(dialogoExcluir.getByLabel(/Excluir somente este/)).toBeChecked();
  await dialogoExcluir.getByTestId('confirmar-exclusao').click();
  await expect(page.getByText('Boleto excluído.')).toBeVisible();

  // 8. Validar restantes: 1, 3, 4, 5
  await page.goto(`/boletos?filtro=todos&q=${encodeURIComponent(fornecedor)}`);
  const cartoes = page.getByTestId('cartao-boleto');
  await expect(cartoes).toHaveCount(4);
  for (const p of ['1/5', '3/5', '4/5', '5/5']) await expect(cartoes.filter({ hasText: `Parcela ${p}` })).toHaveCount(1);
  await expect(page.getByTestId('resumo-lista')).toContainText('R$ 13.495,00');
});

test('excluir "este e os próximos" e "todos" em série', async ({ page }) => {
  const fornecedor = unico('Série Exclusão');
  await page.goto('/boletos/novo');
  await escolherOpcao(page.locator('#empresaId').filter({ visible: true }), EMPRESAS_E2E[0].apelido);
  await page.getByLabel('Fornecedor').fill(fornecedor);
  await page.getByLabel('Nome / descrição').fill('Parcelado');
  await page.getByText('Vários meses', { exact: true }).click();
  await page.locator('#vencimento').fill(`${ANO}-03-10`);
  await page.locator('#valorCentavos').pressSequentially('10000');
  await page.getByLabel('Quantidade de lançamentos').fill('4');
  await page.getByRole('button', { name: 'Criar lançamentos' }).click();
  await expect(page.getByText('4 lançamentos criados.')).toBeVisible();

  let linhas = await linhasDaSerie(page);
  await linhas.nth(2).click(); // parcela 3
  await expect(page.getByText('Parcela 3/4').first()).toBeVisible();
  await page.getByTestId('excluir-boleto').click();
  let dialogo = page.getByRole('alertdialog', { name: 'Excluir boleto da série' });
  await dialogo.getByText('Excluir este e os próximos').click();
  await dialogo.getByTestId('confirmar-exclusao').click();
  await expect(page.getByText('2 boletos excluídos.')).toBeVisible();

  await page.goto(`/boletos?filtro=todos&q=${encodeURIComponent(fornecedor)}`);
  await expect(page.getByTestId('cartao-boleto')).toHaveCount(2);
  await page.getByTestId('cartao-boleto').first().getByRole('link', { name: /Ver detalhes/ }).click();
  await expect(page.getByRole('link', { name: 'Editar' })).toBeVisible();
  linhas = await linhasDaSerie(page);
  await expect(linhas).toHaveCount(2);
  await page.getByTestId('excluir-boleto').click();
  dialogo = page.getByRole('alertdialog', { name: 'Excluir boleto da série' });
  await dialogo.getByText('Excluir todos').click();
  await dialogo.getByTestId('confirmar-exclusao').click();
  await expect(page.getByText('2 boletos excluídos.')).toBeVisible();
  await page.goto(`/boletos?filtro=todos&q=${encodeURIComponent(fornecedor)}`);
  await expect(page.getByText('Nenhum boleto encontrado')).toBeVisible();
});
