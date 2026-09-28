/**
 * Fluxo obrigatório: login → criar → visualizar → copiar código → editar →
 * marcar pago → histórico → desfazer pagamento → excluir.
 * Executado em todos os tamanhos de tela configurados (celulares, tablet, desktop).
 */
import { expect, test } from '@playwright/test';
import { CODIGO_47, br, cadastrarBoleto, dataRelativa, navegarPara, semRolagemHorizontal, unico, EMPRESAS_E2E, escolherOpcao } from './auxiliares';

test.describe('fluxo principal do boleto', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('do login à exclusão', async ({ page }) => {
    const fornecedor = unico('Via da Moda');
    const hoje = dataRelativa(0);

    // 1. Login
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
    await expect(page).toHaveTitle(/NonatoFin/);
    await expect(page.getByText('NonatoFin').first()).toBeVisible();
    await page.getByLabel('E-mail').fill(process.env.E2E_EMAIL!);
    await page.getByLabel('Senha').fill(process.env.E2E_SENHA!);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: `Hoje — ${br(hoje)}` })).toBeVisible();

    // 2. Criar boleto que vence hoje
    await cadastrarBoleto(page, {
      fornecedor,
      descricao: 'Compra coleção agosto',
      vencimento: hoje,
      valorDigitos: '299500',
      codigo: '00190.00009 01234.567890 12345.678901 2 34567890123456',
    });
    await expect(page.getByText('Boleto salvo.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Compra coleção agosto' })).toBeVisible();
    await expect(page.getByText('R$ 2.995,00').first()).toBeVisible();

    // 3. Visualizar na tela Hoje
    await navegarPara(page, 'Hoje');
    const cartao = page.getByTestId('cartao-boleto').filter({ hasText: fornecedor });
    await expect(cartao).toBeVisible();
    await expect(cartao).toContainText('Compra coleção agosto');
    await expect(cartao).toContainText('R$ 2.995,00');
    await expect(cartao).toContainText(br(hoje));
    await expect(cartao).toContainText('00190.00009 01234.567890');
    await expect(cartao).toContainText('Pendente');
    await semRolagemHorizontal(page);

    // 4. Copiar código (somente dígitos)
    const copiar = cartao.getByRole('button', { name: 'Copiar código' });
    const caixa = await copiar.boundingBox();
    expect(caixa!.height, 'botão Copiar código confortável ao toque').toBeGreaterThanOrEqual(44);
    await copiar.click();
    await expect(page.getByText('Código copiado').first()).toBeVisible();
    await expect(cartao.getByRole('button', { name: 'Código copiado' })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(CODIGO_47);

    // 5. Editar
    await cartao.getByRole('link', { name: /Ver detalhes/ }).click();
    await page.getByRole('link', { name: 'Editar' }).click();
    await expect(page.getByRole('heading', { name: 'Editar boleto' })).toBeVisible();
    await page.getByLabel('Nome / descrição').fill('Compra coleção agosto (revisada)');
    const valor = page.locator('#valorCentavos');
    await valor.fill('');
    await valor.pressSequentially('310000');
    await page.getByLabel('Observação (opcional)').fill('Desconto negociado');
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(page.getByText('Boleto atualizado.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Compra coleção agosto (revisada)' })).toBeVisible();
    await expect(page.getByText('R$ 3.100,00').first()).toBeVisible();
    await expect(page.getByText('Desconto negociado')).toBeVisible();

    // 6. Marcar como pago
    await page.getByRole('button', { name: 'Marcar como pago' }).click();
    await expect(page.getByText('Pagamento registrado.')).toBeVisible();
    await expect(page.getByText('Pago em').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Desfazer pagamento' })).toBeVisible();
    const urlBoleto = page.url();

    // 7. Histórico
    await navegarPara(page, 'Histórico');
    await expect(page.getByRole('heading', { name: 'Histórico de pagamentos' })).toBeVisible();
    await page.getByLabel('Pesquisar no histórico').fill(fornecedor);
    await page.getByLabel('Pesquisar no histórico').press('Enter');
    const item = page.getByTestId('lista-historico').getByRole('link').filter({ hasText: fornecedor });
    await expect(item).toBeVisible();
    await expect(item).toContainText('R$ 3.100,00');
    await expect(item).toContainText(`Vencimento ${br(hoje)}`);
    await expect(item).toContainText('Pago em');

    // 8. Desfazer pagamento
    await page.goto(urlBoleto);
    await page.getByRole('button', { name: 'Desfazer pagamento' }).click();
    await expect(page.getByText('Pagamento desfeito.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Marcar como pago' })).toBeVisible();
    await expect(page.getByText('Pendente').first()).toBeVisible();

    // 9. Excluir (com confirmação)
    await page.getByTestId('excluir-boleto').click();
    await expect(page.getByRole('alertdialog', { name: 'Excluir boleto?' })).toBeVisible();
    await page.getByTestId('confirmar-exclusao').click();
    await expect(page.getByText('Boleto excluído.')).toBeVisible();
    await expect(page).toHaveURL(/\/boletos$/);
    await page.goto(`/boletos?filtro=todos&q=${encodeURIComponent(fornecedor)}`);
    await expect(page.getByText('Nenhum boleto encontrado')).toBeVisible();
  });
});

test('boleto sem código mostra Adicionar código e salva o código', async ({ page }) => {
  const fornecedor = unico('Sem Código');
  await cadastrarBoleto(page, { fornecedor, descricao: 'Pedido sem código', vencimento: dataRelativa(0), valorDigitos: '10000' });
  await page.goto('/');
  const cartao = page.getByTestId('cartao-boleto').filter({ hasText: fornecedor });
  await cartao.getByRole('button', { name: 'Adicionar código' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Adicionar código' });
  await dialogo.getByLabel(/linha digitável/).fill('123');
  await dialogo.getByRole('button', { name: 'Salvar código' }).click();
  await expect(dialogo.getByText('O código deve ter 44, 47 ou 48 dígitos.')).toBeVisible();
  await dialogo.getByLabel(/linha digitável/).fill(CODIGO_47);
  await dialogo.getByRole('button', { name: 'Salvar código' }).click();
  await expect(page.getByText('Código salvo.')).toBeVisible();
  await expect(cartao.getByRole('button', { name: 'Copiar código' })).toBeVisible();
});

test('validação do formulário e proteção contra duplo toque', async ({ page }) => {
  await page.goto('/boletos/novo');
  await page.getByRole('button', { name: 'Salvar boleto' }).click();
  await expect(page.getByText('Informe o fornecedor.')).toBeVisible();
  await expect(page.getByText('Informe o nome/descrição.')).toBeVisible();
  await expect(page.getByText('Informe o vencimento.')).toBeVisible();
  await expect(page.getByText('Informe um valor maior que zero.')).toBeVisible();

  const fornecedor = unico('Duplo Toque');
  await escolherOpcao(page.locator('#empresaId').filter({ visible: true }), EMPRESAS_E2E[0].apelido);
  await page.getByLabel('Fornecedor').fill(fornecedor);
  await page.getByLabel('Nome / descrição').fill('Não duplicar');
  await page.locator('#vencimento').fill(dataRelativa(3));
  await page.locator('#valorCentavos').pressSequentially('5000');
  const salvar = page.getByRole('button', { name: 'Salvar boleto' });
  await salvar.dblclick();
  await expect(page).toHaveURL(/\/boletos\/[0-9a-f-]{36}$/);
  await page.goto(`/boletos?filtro=todos&q=${encodeURIComponent(fornecedor)}`);
  await expect(page.getByTestId('cartao-boleto')).toHaveCount(1);
});

test('pesquisa inclui contas futuras e filtros funcionam', async ({ page }) => {
  test.setTimeout(120_000); // ~20 navegações (períodos × status, dia, intervalo)
  const fornecedor = unico('Futuro Distante');
  await cadastrarBoleto(page, { fornecedor, descricao: 'Parcela do ano que vem', vencimento: dataRelativa(300), valorDigitos: '12345' });

  await page.goto('/boletos');
  await page.getByLabel('Pesquisar por fornecedor, nome ou descrição').fill('ano que vem');
  await expect(page.getByTestId('cartao-boleto').filter({ hasText: fornecedor })).toBeVisible();
  await semRolagemHorizontal(page);

  // Filtro por fornecedor ("Mais filtros")
  await page.goto('/boletos?periodo=todos');
  await page.getByTestId('mais-filtros').click();
  const dialogo = page.getByRole('dialog', { name: 'Mais filtros' });
  await escolherOpcao(dialogo.getByRole('combobox', { name: 'Fornecedor', exact: true }), fornecedor);
  await dialogo.getByRole('button', { name: 'Aplicar' }).click();
  await expect(page).toHaveURL(/fornecedor=/);
  await expect(page.getByTestId('cartao-boleto')).toHaveCount(1);
  // O filtro aparece como etiqueta removível
  await page.getByRole('button', { name: `Remover filtro: ${fornecedor}` }).click();
  await expect(page).not.toHaveURL(/fornecedor=/);

  // Período (seletor) e status (chips) se combinam
  for (const periodo of ['Hoje', 'Amanhã', 'Esta semana', 'Este mês', 'Próximo mês', 'Todo o período']) {
    await page.goto('/boletos');
    await escolherOpcao(page.locator('#filtro-periodo'), periodo);
    await expect(page.getByTestId('resumo-lista')).toContainText(periodo);
    for (const status of ['Em aberto', 'A vencer', 'Atrasados', 'Pagos']) {
      if (periodo !== 'Todo o período' && status !== 'Pagos') continue; // amostra: todas as combinações estão nos testes de integração
      await page.getByRole('navigation', { name: 'Filtrar boletos' }).getByRole('link', { name: status, exact: true }).click();
      await expect(page.getByTestId('resumo-lista')).toContainText(`${periodo} · ${status}`);
    }
  }

  // Período personalizado: um dia (setas) e intervalo
  await page.goto('/boletos');
  await escolherOpcao(page.locator('#filtro-periodo'), 'Um dia');
  await expect(page).toHaveURL(/periodo=dia&dia=/);
  await page.getByRole('button', { name: 'Próximo dia' }).click();
  await expect(page).toHaveURL(new RegExp(`dia=${dataRelativa(1)}`));
  await escolherOpcao(page.locator('#filtro-periodo'), 'Intervalo de datas');
  await page.getByLabel('Até', { exact: true }).fill(dataRelativa(400));
  await expect(page).toHaveURL(new RegExp(`ate=${dataRelativa(400)}`));
  await expect(page.getByTestId('cartao-boleto').filter({ hasText: fornecedor })).toBeVisible();
  await page.getByRole('button', { name: 'Limpar filtros' }).click();
  await expect(page).toHaveURL(/\/boletos$/);
});
