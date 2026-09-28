/**
 * Contas bancárias e saldo: cadastrar com saldo de hoje, conta padrão no
 * novo boleto, pagar (sai do saldo), entrada, conferência com o extrato,
 * transferência, escolher a conta ao pagar e o bloco "Saldo × saídas" em Hoje.
 * Usa a 2ª empresa do E2E para não interferir nos outros testes de pagamento.
 */
import { expect, test, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { EMPRESAS_E2E, cadastrarBoleto, dataRelativa, escolherOpcao, semRolagemHorizontal, unico } from './auxiliares';

const EMPRESA = EMPRESAS_E2E[1].apelido;
const reais = (texto: string) => new RegExp(`R\\$\\s${texto.replace('.', '\\.')}`);

/** `padrao: true` marca como conta padrão (os testes rodam em vários tamanhos de tela, e a empresa já pode ter contas). */
async function criarConta(page: Page, apelido: string, saldoDigitos: string, opcoes: { padrao?: boolean } = {}) {
  await page.goto('/contas/nova');
  await escolherOpcao(page.locator('#empresaId').filter({ visible: true }), EMPRESA);
  await page.getByLabel('Apelido da conta').fill(apelido);
  await page.getByLabel('Banco', { exact: true }).fill('Banco de Teste');
  if (saldoDigitos) await page.locator('#saldoInicialCentavos').fill(saldoDigitos);
  if (opcoes.padrao) await page.getByLabel('Conta padrão da empresa').check();
  await page.getByRole('button', { name: 'Salvar conta' }).click();
  await expect(page.getByText('Conta cadastrada.')).toBeVisible();
  await expect(page).toHaveURL(/\/contas\/[0-9a-f-]{36}$/);
  return page.url();
}

test('conta: saldo inicial, pagamento, entrada, conferência e transferência', async ({ page }) => {
  const principal = unico('Itaú');
  const reserva = unico('Nubank');

  // 1. Conta principal com R$ 1.000,00 hoje, marcada como padrão da empresa
  const urlPrincipal = await criarConta(page, principal, '100000', { padrao: true });
  await expect(page.getByTestId('saldo-conta')).toHaveText(reais('1.000,00'));
  await expect(page.getByTestId('extrato')).toContainText('Saldo inicial');
  await semRolagemHorizontal(page);

  // 2. Novo boleto já vem com a conta padrão da empresa
  const fornecedor = unico('Aluguel');
  await cadastrarBoleto(page, { empresa: EMPRESA, fornecedor, descricao: 'Aluguel loja', vencimento: dataRelativa(2), valorDigitos: '25000' });
  await expect(page.getByTestId('detalhe-conta')).toContainText(principal);

  // 3. Pagar (conta prevista: um toque) → sai do saldo
  await page.getByTestId('marcar-pago').click();
  await expect(page.getByText(`Pago pela conta ${principal}.`)).toBeVisible();
  await page.goto(urlPrincipal);
  await expect(page.getByTestId('saldo-conta')).toHaveText(reais('750,00'));
  await expect(page.getByTestId('extrato')).toContainText(fornecedor);

  // 4. Entrada de R$ 100,00
  await page.getByTestId('nova-entrada').click();
  await page.getByLabel('Descrição').fill('Vendas do dia');
  await page.locator('#entrada-valor').pressSequentially('10000');
  await page.getByTestId('salvar-entrada').click();
  await expect(page.getByText('Entrada adicionada.')).toBeVisible();
  await expect(page.getByTestId('saldo-conta')).toHaveText(reais('850,00'));

  // 5. Conferência: o banco mostra R$ 840,00 → ajuste de −R$ 10,00
  await page.getByTestId('conferir-saldo').click();
  await page.locator('#conferencia-saldo').fill('84000');
  await expect(page.getByTestId('resumo-conferencia')).toContainText(reais('10,00'));
  await page.getByTestId('salvar-conferencia').click();
  await expect(page.getByText('Saldo conferido e ajustado.')).toBeVisible();
  await expect(page.getByTestId('saldo-conta')).toHaveText(reais('840,00'));

  // 6. Segunda conta (saldo zero) e transferência de R$ 40,00
  const urlReserva = await criarConta(page, reserva, '');
  await page.goto(urlPrincipal);
  await page.getByTestId('nova-transferencia').click();
  await escolherOpcao(page.locator('#transf-destino'), `${reserva} — ${EMPRESA}`);
  await page.locator('#transf-valor').pressSequentially('4000');
  await page.getByTestId('salvar-transferencia').click();
  await expect(page.getByText('Transferência concluída.')).toBeVisible();
  await expect(page.getByTestId('saldo-conta')).toHaveText(reais('800,00'));
  await page.goto(urlReserva);
  await expect(page.getByTestId('saldo-conta')).toHaveText(reais('40,00'));

  // 7. Lista de contas: total da empresa e as duas contas
  await page.goto('/contas');
  const grupo = page.getByTestId('grupo-empresa').filter({ hasText: EMPRESA });
  await expect(grupo.getByTestId('item-conta').filter({ hasText: principal })).toHaveCount(1);
  await expect(grupo.getByTestId('item-conta').filter({ hasText: reserva })).toHaveCount(1);
  await semRolagemHorizontal(page);
});

test('sem conta prevista, o pagamento pergunta por qual conta foi pago', async ({ page }) => {
  const conta = unico('Caixa');
  const url = await criarConta(page, conta, '50000');
  const fornecedor = unico('Sem conta');
  await cadastrarBoleto(page, { empresa: EMPRESA, fornecedor, descricao: 'Pagar escolhendo', vencimento: dataRelativa(0), valorDigitos: '1000' });
  // Tira a conta sugerida: editar → "Sem conta definida"
  await page.getByRole('link', { name: 'Editar' }).click();
  await escolherOpcao(page.locator('#contaId').filter({ visible: true }), 'Sem conta definida');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByTestId('detalhe-conta')).toContainText('Não definida');

  await page.getByTestId('marcar-pago').click();
  const dialogo = page.getByRole('dialog', { name: 'Por qual conta foi pago?' });
  await expect(dialogo).toBeVisible();
  await dialogo.getByText(conta, { exact: false }).first().click();
  await dialogo.getByTestId('confirmar-conta-pagamento').click();
  await expect(page.getByText(`Pago pela conta ${conta}.`)).toBeVisible();
  await expect(page.getByTestId('detalhe-conta')).toContainText(conta);
  await page.goto(url);
  await expect(page.getByTestId('saldo-conta')).toHaveText(reais('490,00'));

  // Hoje mostra o bloco de saldo × saídas
  await page.goto('/');
  await expect(page.getByTestId('saldos-do-dia')).toContainText(conta);
});

test('primeiro acesso do dia exige conferir os saldos', async ({ page }) => {
  await criarConta(page, unico('Diária'), '30000');
  // Simula "novo dia": apaga as conferências de hoje do usuário E2E (só no teste, com a chave de serviço).
  const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
  const { data: usuarios } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const id = usuarios.users.find((u) => u.email === process.env.E2E_EMAIL)!.id;
  const { data: hoje } = await admin.rpc('hoje_app');
  await admin.from('movimentos_conta').delete().eq('user_id', id).eq('tipo', 'conferencia').eq('data', hoje);

  await page.goto('/boletos');
  await expect(page).toHaveURL(/\/conferir-saldos$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Confira os saldos de hoje' })).toBeVisible();
  const contas = page.getByTestId('conta-a-conferir');
  expect(await contas.count()).toBeGreaterThan(0);
  await semRolagemHorizontal(page);

  // Outras telas continuam bloqueadas até confirmar.
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/conferir-saldos$/);

  // A primeira conta: o banco mostra R$ 5,00 a menos que o sistema.
  const primeira = contas.first();
  const campo = primeira.locator('input[inputmode="numeric"]');
  const atual = Number((await campo.inputValue()).replace(/\D/g, ''));
  await campo.fill(String(Math.max(0, atual - 500)));
  await expect(primeira).toContainText('Ajuste de');
  await page.getByTestId('confirmar-saldos').click();
  await expect(page.getByText(/Saldos conferidos/)).toBeVisible();
  await expect(page).toHaveURL(/\/$/);

  // Já conferido hoje: não pede de novo.
  await page.goto('/conferir-saldos');
  await expect(page).toHaveURL(/\/$/);
});
