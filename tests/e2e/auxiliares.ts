import { expect, type Locator, type Page } from '@playwright/test';

/** Nome único por teste (evita interferência entre projetos/tamanhos de tela). */
export function unico(prefixo: string): string {
  return `${prefixo} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

/** Data ISO de hoje + n dias no fuso de São Paulo. */
export function dataRelativa(dias: number): string {
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const [a, m, d] = hoje.split('-').map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d + dias));
  return dt.toISOString().slice(0, 10);
}

export const br = (iso: string) => iso.split('-').reverse().join('/');

export const CODIGO_47 = '00190000090123456789012345678901234567890123456';

/** Empresas criadas no global-setup para o usuário E2E (CNPJs fictícios válidos). */
export const EMPRESAS_E2E = [
  { apelido: 'Loja Centro', cnpj: '12345678000195' },
  { apelido: 'Confecção Norte', cnpj: '98765432000198' },
] as const;

/**
 * Restringe o locator ao gatilho do Seletor (role="combobox"). A lista aberta
 * (role="listbox") tem o mesmo nome acessível, então um locator por rótulo
 * pegaria os dois elementos.
 */
function gatilhoSeletor(seletor: Locator): Locator {
  return seletor.and(seletor.page().getByRole('combobox'));
}

/** Lista (role="listbox") aberta pelo Seletor customizado. */
async function abrirSeletor(seletor: Locator): Promise<Locator> {
  seletor = gatilhoSeletor(seletor);
  if ((await seletor.getAttribute('aria-expanded')) !== 'true') await seletor.click();
  const idLista = await seletor.getAttribute('aria-controls', { timeout: 1_000 });
  if (!idLista) throw new Error('A lista do seletor não abriu.');
  return seletor.page().locator(`[id="${idLista}"]`);
}

/**
 * Escolhe uma opção do Seletor (combobox customizado, sem <select> nativo) e
 * confirma que ela "pegou". Antes de o React hidratar, o clique não abre a
 * lista (ou a escolha se perde) — então repete até a opção permanecer.
 */
export async function escolherOpcao(seletor: Locator, rotulo: string) {
  seletor = gatilhoSeletor(seletor);
  await expect(async () => {
    const lista = await abrirSeletor(seletor);
    await lista.getByRole('option', { name: rotulo, exact: true }).click({ timeout: 2_000 });
    await seletor.page().waitForTimeout(250);
    await expect(seletor).toHaveText(rotulo, { timeout: 100 });
  }).toPass({ timeout: 10_000 });
}

/** Valor atual do Seletor (o mesmo enviado pelo formulário). */
export async function valorSeletor(seletor: Locator): Promise<string> {
  return (await gatilhoSeletor(seletor).getAttribute('data-valor')) ?? '';
}

/** Rótulos das opções do Seletor (abre a lista e fecha com Esc). */
export async function opcoesSeletor(seletor: Locator): Promise<string[]> {
  let rotulos: string[] = [];
  await expect(async () => {
    const lista = await abrirSeletor(seletor);
    rotulos = (await lista.getByRole('option').allTextContents()).map((t) => t.trim());
  }).toPass({ timeout: 10_000 });
  await gatilhoSeletor(seletor).press('Escape');
  return rotulos;
}

export interface DadosBoleto {
  /** Apelido da empresa (padrão: a primeira do E2E). */
  empresa?: string;
  /** Nome da categoria (padrão: a primeira da lista). */
  categoria?: string;
  fornecedor: string;
  descricao: string;
  vencimento: string; // ISO
  valorDigitos: string; // ex. "299500" = R$ 2.995,00
  codigo?: string;
  observacao?: string;
  serie?: { quantidade: number; mesmoCodigo?: boolean };
}

/** Cadastra um boleto pela interface (como o usuário faria). */
export async function cadastrarBoleto(page: Page, dados: DadosBoleto) {
  await page.goto('/boletos/novo');
  const empresa = page.locator('#empresaId').filter({ visible: true });
  if ((await valorSeletor(empresa)) === '' || dados.empresa) await escolherOpcao(empresa, dados.empresa ?? EMPRESAS_E2E[0].apelido);
  if (dados.categoria) await escolherOpcao(page.locator('#categoriaId').filter({ visible: true }), dados.categoria);
  await page.getByLabel('Fornecedor').fill(dados.fornecedor);
  await page.getByLabel('Nome / descrição').fill(dados.descricao);
  if (dados.serie) await page.getByText('Vários meses', { exact: true }).click();
  await page.locator('#vencimento').fill(dados.vencimento);
  await page.locator('#valorCentavos').pressSequentially(dados.valorDigitos);
  if (dados.serie) {
    await page.getByLabel('Quantidade de lançamentos').fill(String(dados.serie.quantidade));
    if (dados.serie.mesmoCodigo) await page.getByText('Usar o mesmo código em todos os lançamentos').click();
  }
  if (dados.codigo) await page.getByLabel(/Código de barras/).fill(dados.codigo);
  if (dados.observacao) await page.getByLabel(/Observação/).fill(dados.observacao);
  await page.getByRole('button', { name: /Salvar boleto|Criar lançamentos/ }).click();
  await expect(page).toHaveURL(/\/boletos\/[0-9a-f-]{36}$/);
}

/** Verifica que não há rolagem horizontal indevida. */
export async function semRolagemHorizontal(page: Page) {
  const { rolagem, largura } = await page.evaluate(() => ({
    rolagem: document.documentElement.scrollWidth,
    largura: window.innerWidth,
  }));
  expect(rolagem, 'página com rolagem horizontal').toBeLessThanOrEqual(largura);
}

export function ehCelular(page: Page): boolean {
  return (page.viewportSize()?.width ?? 1440) < 1024;
}

/** Navega por um item de menu (barra inferior + "Mais" no celular; lateral no desktop). */
export async function navegarPara(page: Page, rotulo: string) {
  if (ehCelular(page)) {
    const barra = page.getByRole('navigation', { name: 'Principal' });
    const link = barra.getByRole('link', { name: rotulo, exact: true });
    if (await link.count()) {
      await link.click();
    } else {
      await barra.getByRole('button', { name: 'Mais' }).click();
      await page.getByRole('navigation', { name: 'Mais opções' }).getByRole('link', { name: rotulo }).click();
    }
  } else {
    await page.getByRole('complementary').getByRole('link', { name: rotulo, exact: true }).click();
  }
}
