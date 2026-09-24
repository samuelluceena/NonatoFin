/**
 * Dashboard, fornecedores, meses e exportação conferidos contra os dados reais.
 */
import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { strFromU8, unzipSync } from 'fflate';
import { chaveDoMes, formatarMes } from '../../src/lib/domain/datas';
import { formatarMoeda } from '../../src/lib/domain/dinheiro';
import { calcularIndicadores, resumirStatus } from '../../src/lib/domain/indicadores';
import { EMPRESAS_E2E, cadastrarBoleto, dataRelativa, navegarPara, unico } from './auxiliares';
import { dadosDoUsuarioE2E } from './dados-reais';

const moeda = (c: number) => formatarMoeda(c).replace(/ /g, ' ');
const texto = async (loc: import('@playwright/test').Locator) => (await loc.innerText()).replace(/ /g, ' ').trim();

test('fornecedor: cadastro, totais por status e detalhe', async ({ page }) => {
  const fornecedor = unico('Fornecedor Totais');
  await cadastrarBoleto(page, { fornecedor, descricao: 'Atrasado', vencimento: dataRelativa(-5), valorDigitos: '10000' });
  await cadastrarBoleto(page, { fornecedor, descricao: 'Pago', vencimento: dataRelativa(2), valorDigitos: '20000' });
  await page.getByRole('button', { name: 'MARCAR COMO PAGO' }).click();
  await expect(page.getByText('Boleto marcado como pago!')).toBeVisible();
  await cadastrarBoleto(page, { fornecedor: fornecedor.toUpperCase(), descricao: 'Futuro', vencimento: dataRelativa(40), valorDigitos: '30000' });

  await navegarPara(page, 'Fornecedores');
  const cartao = page.getByTestId('cartao-fornecedor').filter({ hasText: fornecedor.toUpperCase() });
  await expect(cartao).toHaveCount(1); // maiúsculas não duplicam o fornecedor
  await expect(cartao).toContainText('3 boletos');
  await expect(cartao).toContainText('Pendentes: 1');
  await expect(cartao).toContainText('Pagos: 1');
  await expect(cartao).toContainText('Atrasados: 1');

  await cartao.click();
  await expect(page.getByTestId('forn-total')).toHaveText('R$ 600,00');
  await expect(page.getByTestId('forn-pendente')).toHaveText('R$ 300,00');
  await expect(page.getByTestId('forn-pago')).toHaveText('R$ 200,00');
  await expect(page.getByTestId('forn-atrasado')).toHaveText('R$ 100,00');

  // filtros do detalhe
  const chips = page.getByRole('navigation', { name: 'Filtrar por status' });
  await chips.getByRole('link', { name: 'Atrasados' }).click();
  await expect(page).toHaveURL(/status=atrasado/);
  await expect(page.getByTestId('cartao-boleto')).toHaveCount(1);
  await expect(page.getByTestId('cartao-boleto')).toContainText('Atrasado');
  await chips.getByRole('link', { name: 'Pagos' }).click();
  await expect(page).toHaveURL(/status=pago/);
  await expect(page.getByTestId('cartao-boleto')).toHaveCount(1);
  await chips.getByRole('link', { name: 'Todos' }).click();
  await expect(page).not.toHaveURL(/status=/);
  await expect(page.getByTestId('cartao-boleto')).toHaveCount(3);
  await page.getByLabel('Vencimento de').fill(dataRelativa(0));
  await page.getByRole('button', { name: 'Aplicar período' }).click();
  await expect(page.getByTestId('cartao-boleto')).toHaveCount(2);

  // Novo fornecedor manual (sem duplicar por maiúsculas)
  await page.goto('/fornecedores');
  await page.getByRole('button', { name: 'Novo fornecedor' }).click();
  await page.getByRole('dialog', { name: 'Novo fornecedor' }).getByLabel('Nome').fill(fornecedor.toLowerCase());
  await page.getByRole('dialog', { name: 'Novo fornecedor' }).getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Fornecedor já cadastrado.')).toBeVisible();
});

test('dashboard bate exatamente com os dados do banco', async ({ page }) => {
  await cadastrarBoleto(page, { fornecedor: unico('Dash'), descricao: 'Hoje', vencimento: dataRelativa(0), valorDigitos: '123456' });
  await navegarPara(page, 'Dashboard');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  const { resumos } = await dadosDoUsuarioE2E();
  const hoje = dataRelativa(0);
  const ind = calcularIndicadores(resumos, hoje);
  const esperado: Record<string, string> = {
    'kpi-hoje': moeda(ind.hoje.totalCentavos),
    'kpi-amanha': moeda(ind.amanha.totalCentavos),
    'kpi-semana': moeda(ind.semana.totalCentavos),
    'kpi-mes': moeda(ind.mes.totalCentavos),
    'kpi-proximo-mes': moeda(ind.proximoMes.totalCentavos),
    'kpi-atrasados': moeda(ind.atrasados.totalCentavos),
    'kpi-futuro': moeda(ind.futuro.totalCentavos),
    'kpi-pago-mes': moeda(ind.pagoNoMes.totalCentavos),
    'kpi-qtd-pendentes': String(ind.pendentes),
    'kpi-qtd-atrasados': String(ind.atrasadosQuantidade),
  };
  for (const [id, valor] of Object.entries(esperado)) {
    expect(await texto(page.getByTestId(id)), id).toBe(valor);
  }
  await expect(page.getByText('Valores por mês', { exact: true })).toBeVisible();
  await expect(page.getByText('Por fornecedor', { exact: true })).toBeVisible();

  // Comparativo por métrica
  await page.getByRole('group', { name: 'Comparar por', exact: true }).getByText('Atrasado').click();
  await page.getByRole('group', { name: 'Comparar por', exact: true }).getByText('Total').click();
});

test('contas por mês: lista e detalhe do mês atual', async ({ page }) => {
  await cadastrarBoleto(page, { fornecedor: unico('Mês'), descricao: 'Conta do mês', vencimento: dataRelativa(0), valorDigitos: '5000' });
  await navegarPara(page, 'Meses');
  const mes = chaveDoMes(dataRelativa(0));
  const cartao = page.getByTestId('cartao-mes').filter({ hasText: formatarMes(mes) });
  await expect(cartao).toBeVisible();
  await cartao.click();
  await expect(page).toHaveURL(new RegExp(`/meses/${mes}$`));

  const { resumos } = await dadosDoUsuarioE2E();
  const r = resumirStatus(resumos.filter((b) => chaveDoMes(b.vencimento) === mes), dataRelativa(0));
  expect(await texto(page.getByTestId('mes-total'))).toBe(moeda(r.totalCentavos));
  expect(await texto(page.getByTestId('mes-pendente'))).toBe(moeda(r.pendenteCentavos));
  expect(await texto(page.getByTestId('mes-pago'))).toBe(moeda(r.pagoCentavos));
  expect(await texto(page.getByTestId('mes-atrasado'))).toBe(moeda(r.atrasadoCentavos));
  await page.getByRole('link', { name: /Próximo mês/ }).click();
  await expect(page).not.toHaveURL(new RegExp(`/meses/${mes}$`));
});

test('exportação CSV e Excel', async ({ page }) => {
  const fornecedor = unico('Exportação');
  await cadastrarBoleto(page, { fornecedor, descricao: 'Para exportar', vencimento: dataRelativa(10), valorDigitos: '299500', observacao: 'obs; com "aspas"' });
  await navegarPara(page, 'Configurações');

  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByTestId('exportar-csv').click()]);
  await expect(page.getByText('Exportação concluída!')).toBeVisible();
  expect(csv.suggestedFilename()).toMatch(/^nonatofin-boletos-\d{4}-\d{2}-\d{2}\.csv$/);
  const conteudo = await readFile((await csv.path())!, 'utf8');
  expect(conteudo.charCodeAt(0)).toBe(0xfeff);
  expect(conteudo).toContain('Empresa;CNPJ;Categoria;Conta;Fornecedor;Nome/Descrição;Valor;Vencimento;Código;Status;Parcela;Total de parcelas;Observação;Pagamento');
  const linha = conteudo.split('\r\n').find((l) => l.includes(fornecedor))!;
  expect(linha).toContain(';Para exportar;2.995,00;');
  expect(linha.startsWith(`${EMPRESAS_E2E[0].apelido};12.345.678/0001-95;`)).toBe(true);
  expect(linha).toContain('"obs; com ""aspas"""');

  const [xlsx] = await Promise.all([page.waitForEvent('download'), page.getByTestId('exportar-xlsx').click()]);
  expect(xlsx.suggestedFilename()).toMatch(/\.xlsx$/);
  const arquivos = unzipSync(new Uint8Array(await readFile((await xlsx.path())!)));
  expect(strFromU8(arquivos['xl/worksheets/sheet1.xml'])).toContain(fornecedor);
});

test('exportar a lista filtrada traz só o que está na tela', async ({ page }) => {
  const fornecedor = unico('Export Filtro');
  await cadastrarBoleto(page, { fornecedor, descricao: 'Dentro do filtro', vencimento: dataRelativa(5), valorDigitos: '10000' });
  await cadastrarBoleto(page, { fornecedor, descricao: 'Fora do filtro', vencimento: dataRelativa(90), valorDigitos: '20000' });

  const fim = dataRelativa(30);
  await page.goto(`/boletos?periodo=intervalo&de=${dataRelativa(0)}&ate=${fim}&q=${encodeURIComponent(fornecedor)}`);
  await expect(page.getByTestId('cartao-boleto')).toHaveCount(1);

  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByTestId('exportar-csv').click()]);
  expect(csv.suggestedFilename()).toMatch(/^nonatofin-boletos-filtrados-\d{4}-\d{2}-\d{2}\.csv$/);
  const linhas = (await readFile((await csv.path())!, 'utf8')).split('\r\n').filter((l) => l.includes(fornecedor));
  expect(linhas).toHaveLength(1);
  expect(linhas[0]).toContain(';Dentro do filtro;');
});
