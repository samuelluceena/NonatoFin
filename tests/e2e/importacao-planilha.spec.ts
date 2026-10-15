/**
 * Importação de planilha (Configurações → Importar planilha), no Supabase LOCAL:
 * arquivo UTF-16 → prévia (importar, conferir, fora) → importar → lançamentos
 * sem empresa (aviso, filtro) → atribuir empresa em lote → desfazer.
 * Cada execução usa descrições únicas e apaga o que criou no fim.
 */
import { expect, test, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { br, dataRelativa, escolherOpcao, EMPRESAS_E2E, semRolagemHorizontal, unico } from './auxiliares';

const url = process.env.SUPABASE_URL ?? '';
if (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) {
  throw new Error('SUPABASE_URL não aponta para o Supabase local. E2E abortado.');
}

function admin(): SupabaseClient {
  return createClient(url, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** CSV como o app financeiro exporta: UTF-16 com BOM, ";" e ponto decimal. */
function arquivoCsv(token: string): Buffer {
  const l = (data: string, desc: string, valor: string, conta: string, status: string, categoria: string) =>
    [br(data), desc, valor, conta, status, categoria, '', ''].map((c) => `"${c}"`).join(';');
  const linhas = [
    '"Date";"Description";"Value";"Account";"Status";"Category";"Subcategory";"Tags"',
    l(dataRelativa(5), `Fornecedor A ${token}(1/3)`, '-123.47', 'Carteira', 'Pending', 'Mercadoria'),
    l(dataRelativa(6), `Fornecedor B ${token}`, '-234.51', 'BB | Teste', 'Pending', 'Custos Operacionais'),
    l(dataRelativa(7), `Assinatura ${token}`, '-68.69', 'Carteira', 'Pending', 'Custos Operacionais'),
    l(dataRelativa(7), `Assinatura ${token}`, '-68.69', 'Carteira', 'Pending', 'Custos Operacionais'),
    l(dataRelativa(8), `Energia ${token} | Atualizar`, '-185.29', 'Carteira', 'Pending', 'Despesas Pessoais'),
    l(dataRelativa(9), `Reajuste de fatura ${token}`, '-51.13', 'Carteira', 'Pending', 'Reajuste de fatura'),
    l(dataRelativa(3), `Pago ${token}`, '-10.00', 'Carteira', 'Paid', 'Mercadoria'),
    l(dataRelativa(-1), `Vencido ${token}`, '-11.00', 'Carteira', 'Pending', 'Mercadoria'),
    l(dataRelativa(10), `Zero ${token}`, '0', 'Carteira', 'Pending', 'Mercadoria'),
    '"";"";"";"";"";"";"";""',
    '"Total (incomes - expenses)";"";"-752.09";"";"";"";"";""',
  ].join('\r\n');
  const corpo = Buffer.from(linhas, 'utf16le');
  return Buffer.concat([Buffer.from([0xff, 0xfe]), corpo]);
}

async function idDoUsuarioE2E(a: SupabaseClient): Promise<string> {
  const { data } = await a.auth.admin.listUsers({ perPage: 1000 });
  return data.users.find((u) => u.email === process.env.E2E_EMAIL)!.id;
}

async function gerarPrevia(page: Page, token: string, nome: string) {
  await page.goto('/configuracoes');
  await page.getByTestId('link-importacao').click();
  await expect(page).toHaveURL(/\/configuracoes\/importacao$/);
  await page.getByTestId('nova-importacao').click();
  await expect(page).toHaveURL(/\/configuracoes\/importacao\/nova$/);
  await page.getByTestId('arquivo-importacao').setInputFiles({ name: nome, mimeType: 'text/csv', buffer: arquivoCsv(token) });
  await expect(page.getByText(nome)).toBeVisible();
  await page.getByTestId('gerar-previa').click();
  await expect(page.getByTestId('previa-importacao')).toBeVisible({ timeout: 20_000 });
}

test.describe('importar planilha', () => {
  let token = '';
  let nomeArquivo = '';

  test.beforeEach(() => {
    token = unico('Imp').replace(/\s+/g, '');
    nomeArquivo = `planilha-${token}.csv`;
  });

  test.afterEach(async () => {
    // Remove o que este teste criou (lançamentos, lote e fornecedores).
    const a = admin();
    const userId = await idDoUsuarioE2E(a);
    await a.from('lancamentos').delete().eq('user_id', userId).ilike('descricao', `%${token}%`);
    await a.from('importacoes').delete().eq('user_id', userId).eq('arquivo_nome', nomeArquivo);
    await a.from('fornecedores').delete().eq('user_id', userId).ilike('nome', `%${token}%`);
  });

  test('prévia → importar → atribuir empresas em lote → desfazer', async ({ page }, info) => {
    await gerarPrevia(page, token, nomeArquivo);

    // Linhas que coincidem com lançamentos já existentes (improvável) exigem decisão.
    const coincidencias = page.getByTestId('grupo-coincide-com-existente');
    if (await coincidencias.count()) {
      for (const botao of await coincidencias.getByTestId('decidir-importar').all()) await botao.click();
    }

    // Importar: A, B, a 1ª Assinatura e Energia (valor estimado).
    await expect(page.getByTestId('total-importar-quantidade')).toHaveText('4');
    await expect(page.getByTestId('previa-total')).toContainText('611,96');
    await expect(page.getByTestId('previa-estimados')).toHaveText('1');
    await expect(page.getByTestId('grupo-duplicada-no-arquivo').getByTestId('linha-conferir')).toHaveCount(1);
    await expect(page.getByTestId('grupo-possivel-fatura-cartao').getByTestId('linha-conferir')).toHaveCount(1);
    for (const motivo of ['paga', 'vencida', 'valor-zero', 'sem-dados']) await expect(page.getByTestId(`fora-${motivo}`)).toBeVisible();
    await semRolagemHorizontal(page);

    // Tirar uma linha e devolver (a contagem acompanha).
    const linhaA = page.getByTestId('linha-importar').filter({ hasText: `Fornecedor A ${token}` });
    await linhaA.getByRole('checkbox').uncheck();
    await expect(page.getByTestId('total-importar-quantidade')).toHaveText('3');
    await linhaA.getByRole('checkbox').check();
    await expect(page.getByTestId('total-importar-quantidade')).toHaveText('4');

    await page.getByTestId('importar').click();
    await expect(page.getByTestId('resumo-confirmacao')).toContainText('A definir');
    await page.getByTestId('confirmar-importacao').click();
    await expect(page).toHaveURL(/\/configuracoes\/importacao\/[0-9a-f-]{36}$/, { timeout: 20_000 });
    await expect(page.getByTestId('importacao-total')).toContainText('611,96');
    await expect(page.getByTestId('importacao-sem-empresa')).toHaveText('4');
    await page.getByTestId('secao-separadas').locator('summary').click();
    await expect(page.getByTestId('linhas-separadas')).toContainText(`Reajuste de fatura ${token}`);
    const urlLote = page.url();
    await semRolagemHorizontal(page);

    // Boletos: aviso e filtro "Sem empresa definida".
    await page.goto(`/boletos?empresa=sem&periodo=todos&q=${token}`);
    await expect(page.getByTestId('cartao-boleto')).toHaveCount(4);
    await expect(page.getByTestId('cartao-meta').first()).toContainText('Sem empresa');

    // Atribuir: primeiro só a conta "BB | Teste", depois o resto do lote.
    await page.goto(urlLote);
    await page.getByTestId('atribuir-empresas-lote').click();
    await expect(page).toHaveURL(/\/boletos\/sem-empresa\?lote=/);
    await page.getByTestId('chip-conta-origem').filter({ hasText: 'BB | Teste' }).click();
    await expect(page.getByTestId('item-sem-empresa')).toHaveCount(1);
    await page.getByTestId('marcar-visiveis').check();
    await escolherOpcao(page.getByTestId('empresa-atribuir'), EMPRESAS_E2E[1].apelido);
    await page.getByTestId('atribuir-empresa').click();
    await expect(page.getByText('Empresa definida em 1 lançamento')).toBeVisible();

    await page.goto(urlLote.replace('/configuracoes/importacao/', '/boletos/sem-empresa?lote='));
    await expect(page.getByTestId('item-sem-empresa')).toHaveCount(3);
    await semRolagemHorizontal(page);
    await page.getByTestId('marcar-visiveis').check();
    await escolherOpcao(page.getByTestId('empresa-atribuir'), EMPRESAS_E2E[0].apelido);
    await page.getByTestId('atribuir-empresa').click();
    await expect(page.getByText('Empresa definida em 3 lançamentos')).toBeVisible();

    const a = admin();
    const userId = await idDoUsuarioE2E(a);
    const { data } = await a.from('lancamentos').select('empresa_id, status').eq('user_id', userId).ilike('descricao', `%${token}%`);
    expect(data).toHaveLength(4);
    expect(data!.every((l) => l.empresa_id && l.status === 'pendente')).toBe(true);

    // Desfazer pede a senha (login real): roda em 2 tamanhos por causa do limite de logins do Auth local.
    if (!['celular-390x844', 'desktop-1440x900'].includes(info.project.name)) return;
    await page.goto(urlLote);
    await page.getByTestId('desfazer-importacao').click();
    await expect(page.getByTestId('desfazer-importacao-confirmar')).toBeDisabled();
    await page.getByTestId('desfazer-importacao-senha').fill(process.env.E2E_SENHA!);
    await page.getByTestId('desfazer-importacao-frase').fill('DESFAZER IMPORTACAO');
    await page.getByTestId('desfazer-importacao-confirmar').click();
    await expect(page.getByText('Importação desfeita: 4 lançamentos removidos.')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Desfeita em/)).toBeVisible();
    const { count } = await a.from('lancamentos').select('id', { count: 'exact', head: true }).eq('user_id', userId).ilike('descricao', `%${token}%`);
    expect(count).toBe(0);
  });

  test('boleto importado: depois da atribuição em lote, a empresa é trocada pelo formulário de edição', async ({ page }) => {
    const a = admin();
    const userId = await idDoUsuarioE2E(a);
    await gerarPrevia(page, token, nomeArquivo);
    const coincidencias = page.getByTestId('grupo-coincide-com-existente');
    if (await coincidencias.count()) {
      for (const botao of await coincidencias.getByTestId('decidir-importar').all()) await botao.click();
    }
    await page.getByTestId('importar').click();
    await page.getByTestId('confirmar-importacao').click();
    await expect(page).toHaveURL(/\/configuracoes\/importacao\/[0-9a-f-]{36}$/, { timeout: 20_000 });

    // Atribuição em lote SEM conta (classificação inicial em uma empresa).
    await page.getByTestId('atribuir-empresas-lote').click();
    await page.getByTestId('marcar-visiveis').check();
    await escolherOpcao(page.getByTestId('empresa-atribuir'), EMPRESAS_E2E[0].apelido);
    // Empresa sem conta padrão: a opção fica desmarcada e desabilitada (nada de conta).
    const usarConta = page.getByTestId('usar-conta-padrao');
    if (await usarConta.isEnabled()) await usarConta.uncheck();
    await expect(usarConta).not.toBeChecked();
    await page.getByTestId('atribuir-empresa').click();
    await expect(page.getByText('Empresa definida em 4 lançamentos')).toBeVisible();

    // A outra empresa tem conta padrão: ao trocar, o formulário sugere a conta, mas dá para escolher "Sem conta definida".
    const { data: empresas } = await a.from('empresas').select('id, apelido').eq('user_id', userId);
    const destino = empresas!.find((e) => e.apelido === EMPRESAS_E2E[1].apelido)!.id;
    const conta = (await a.from('contas_bancarias').insert({ user_id: userId, empresa_id: destino, apelido: `Conta ${token}`, banco: 'Banco', padrao: true }).select('id').single()).data!.id;
    // Como no cadastro pelo app: o saldo inicial vira a conferência de hoje (senão a conferência diária bloqueia as telas).
    await a.from('movimentos_conta').insert({ user_id: userId, conta_id: conta, tipo: 'conferencia', data: dataRelativa(0), valor_centavos: 0, saldo_informado: 0, descricao: 'Saldo inicial' });
    try {
      const { data: antes } = await a
        .from('lancamentos')
        .select('id, valor_centavos, vencimento, descricao, fornecedor_id, categoria_id, status, observacao, conta_id')
        .eq('user_id', userId)
        .ilike('descricao', `Fornecedor B ${token}`)
        .single();
      expect(antes!.conta_id).toBeNull();

      await page.goto(`/boletos/${antes!.id}`);
      await page.getByRole('link', { name: 'Editar' }).click();
      await expect(page.getByRole('heading', { name: 'Editar boleto' })).toBeVisible();
      await escolherOpcao(page.locator('#empresaId'), EMPRESAS_E2E[1].apelido);
      await expect(page.locator('#contaId').and(page.getByRole('combobox'))).toContainText(`Conta ${token}`);
      await escolherOpcao(page.locator('#contaId'), 'Sem conta definida');
      await page.getByRole('button', { name: 'Salvar alterações' }).click();
      await expect(page).toHaveURL(new RegExp(`/boletos/${antes!.id}$`));
      await expect(page.getByText(EMPRESAS_E2E[1].apelido).first()).toBeVisible();

      const { data: depois } = await a
        .from('lancamentos')
        .select('id, valor_centavos, vencimento, descricao, fornecedor_id, categoria_id, status, observacao, conta_id, empresa_id')
        .eq('id', antes!.id)
        .single();
      expect(depois).toEqual({ ...antes, empresa_id: destino });
    } finally {
      await a.from('contas_bancarias').delete().eq('id', conta);
    }
  });

  test('arquivo inválido mostra o erro sem gravar nada', async ({ page }) => {
    await page.goto('/configuracoes/importacao/nova');
    await page.getByTestId('arquivo-importacao').setInputFiles({ name: nomeArquivo, mimeType: 'text/csv', buffer: Buffer.from('nome;quantia\nx;1') });
    await page.getByTestId('gerar-previa').click();
    await expect(page.getByRole('alert').filter({ hasText: 'colunas esperadas' })).toBeVisible();
    await semRolagemHorizontal(page);
  });
});
