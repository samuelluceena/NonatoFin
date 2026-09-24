/**
 * CRUD e séries, executados no banco real com as mesmas funções (RPC) que o
 * aplicativo usa.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { gerarLancamentosSerie } from '@/lib/domain/recorrencia';
import { criarFornecedor, criarUsuarioTeste, removerUsuario, vinculo, type UsuarioTeste } from './auxiliares';

let u: UsuarioTeste;
let via: string;
let outro: string;

beforeAll(async () => {
  u = await criarUsuarioTeste();
  via = await criarFornecedor(u.cliente, 'Via da Moda');
  outro = await criarFornecedor(u.cliente, 'Fornecedor B');
});

afterAll(async () => {
  await removerUsuario(u.id);
});

const CODIGO = '00190000090123456789012345678901234567890123456';

async function criarSerie(primeiro = '2027-01-31', quantidade = 5) {
  const serieId = crypto.randomUUID();
  const linhas = gerarLancamentosSerie({
    primeiroVencimento: primeiro,
    quantidade,
    valorCentavos: 299500,
    codigoBarras: CODIGO,
    mesmoCodigoEmTodos: false,
  }).map((l) => ({
    ...vinculo(u),
    fornecedor_id: via,
    descricao: 'Compra coleção',
    valor_centavos: l.valorCentavos,
    vencimento: l.vencimento,
    codigo_barras: l.codigoBarras,
    serie_id: serieId,
    parcela: l.parcela,
    total_parcelas: l.totalParcelas,
  }));
  const { data, error } = await u.cliente.from('lancamentos').insert(linhas).select('id, parcela').order('parcela');
  if (error) throw error;
  return { serieId, ids: data.map((d) => d.id) };
}

async function lerSerie(serieId: string) {
  const { data, error } = await u.cliente
    .from('lancamentos')
    .select('id, parcela, total_parcelas, vencimento, valor_centavos, descricao, fornecedor_id, codigo_barras, status')
    .eq('serie_id', serieId)
    .order('parcela');
  if (error) throw error;
  return data;
}

const atualizar = (id: string, escopo: string, campos: Partial<Record<string, unknown>> = {}) =>
  u.cliente.rpc('atualizar_lancamento', {
    p_id: id,
    p_escopo: escopo,
    p_empresa_id: u.empresaId,
    p_categoria_id: u.categoriaId,
    p_conta_id: null,
    p_fornecedor_id: via,
    p_descricao: 'Compra coleção',
    p_valor_centavos: 299500,
    p_vencimento: '2027-01-31',
    p_codigo_barras: null,
    p_observacao: null,
    p_status: 'pendente',
    ...campos,
  } as never);

describe('boleto único: criar, ver, editar, pagar, desfazer, excluir', () => {
  let id: string;

  beforeEach(async () => {
    const { data, error } = await u.cliente
      .from('lancamentos')
      .insert({ ...vinculo(u), fornecedor_id: via, descricao: 'Compra coleção outubro', valor_centavos: 299500, vencimento: '2026-08-15', codigo_barras: CODIGO })
      .select('id')
      .single();
    if (error) throw error;
    id = data.id;
  });

  it('cria como pendente e lê com o fornecedor embutido', async () => {
    const { data } = await u.cliente
      .from('lancamentos')
      .select('status, pago_em, vencimento, valor_centavos, fornecedor:fornecedores!lancamentos_fornecedor_fk(nome)')
      .eq('id', id)
      .single();
    expect(data).toMatchObject({ status: 'pendente', pago_em: null, vencimento: '2026-08-15', valor_centavos: 299500 });
    expect(JSON.stringify(data?.fornecedor)).toContain('Via da Moda');
  });

  it('edita todos os campos (somente este)', async () => {
    const r = await atualizar(id, 'este', {
      p_fornecedor_id: outro,
      p_descricao: 'Nova descrição',
      p_valor_centavos: 10050,
      p_vencimento: '2026-08-20',
      p_codigo_barras: '8'.repeat(48),
      p_observacao: 'obs',
    });
    expect(r.error).toBeNull();
    expect(r.data).toBe(1);
    const { data } = await u.cliente.from('lancamentos').select('*').eq('id', id).single();
    expect(data).toMatchObject({
      fornecedor_id: outro,
      descricao: 'Nova descrição',
      valor_centavos: 10050,
      vencimento: '2026-08-20',
      codigo_barras: '8'.repeat(48),
      observacao: 'obs',
    });
  });

  it('marca pago (salva pago_em), é idempotente e desfaz', async () => {
    const p1 = await u.cliente.rpc('definir_pagamento', { p_id: id, p_pago: true });
    expect(p1.data).toMatchObject({ status: 'pago' });
    const pagoEm = p1.data!.pago_em;
    expect(pagoEm).toBeTruthy();

    const p2 = await u.cliente.rpc('definir_pagamento', { p_id: id, p_pago: true });
    expect(p2.data!.pago_em).toBe(pagoEm); // não sobrescreve

    const d = await u.cliente.rpc('definir_pagamento', { p_id: id, p_pago: false });
    expect(d.data).toMatchObject({ status: 'pendente', pago_em: null });
  });

  it('edição de status para pago define pago_em; voltar a pendente limpa', async () => {
    await atualizar(id, 'este', { p_status: 'pago', p_vencimento: '2026-08-15' });
    let { data } = await u.cliente.from('lancamentos').select('status, pago_em').eq('id', id).single();
    expect(data?.status).toBe('pago');
    expect(data?.pago_em).toBeTruthy();
    await atualizar(id, 'este', { p_status: 'pendente', p_vencimento: '2026-08-15' });
    ({ data } = await u.cliente.from('lancamentos').select('status, pago_em').eq('id', id).single());
    expect(data).toEqual({ status: 'pendente', pago_em: null });
  });

  it('exclui', async () => {
    const r = await u.cliente.rpc('excluir_lancamento', { p_id: id, p_escopo: 'este' });
    expect(r.data).toBe(1);
    const { data } = await u.cliente.from('lancamentos').select('id').eq('id', id);
    expect(data).toEqual([]);
  });
});

describe('série de 5 lançamentos', () => {
  it('cria 5 lançamentos com valor, datas, parcelas, fornecedor e código corretos', async () => {
    const { serieId } = await criarSerie();
    const serie = await lerSerie(serieId);
    expect(serie.map((b) => b.vencimento)).toEqual(['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30', '2027-05-31']);
    expect(serie.map((b) => `${b.parcela}/${b.total_parcelas}`)).toEqual(['1/5', '2/5', '3/5', '4/5', '5/5']);
    expect(serie.every((b) => b.valor_centavos === 299500 && b.fornecedor_id === via)).toBe(true);
    expect(serie.reduce((s, b) => s + b.valor_centavos, 0)).toBe(1497500);
    expect(serie.map((b) => b.codigo_barras)).toEqual([CODIGO, null, null, null, null]);
  });

  it('alterar SOMENTE ESTE afeta apenas a parcela escolhida', async () => {
    const { serieId, ids } = await criarSerie();
    const r = await atualizar(ids[2], 'este', { p_valor_centavos: 100000, p_vencimento: '2027-03-31' });
    expect(r.data).toBe(1);
    const serie = await lerSerie(serieId);
    expect(serie.map((b) => b.valor_centavos)).toEqual([299500, 299500, 100000, 299500, 299500]);
  });

  it('alterar ESTE E OS PRÓXIMOS a partir da 3ª: valor, descrição e datas (preservando o dia)', async () => {
    const { serieId, ids } = await criarSerie();
    // muda o vencimento da 3ª de 31/03 para 10/04 -> 4ª = 10/05, 5ª = 10/06
    const r = await atualizar(ids[2], 'proximos', {
      p_valor_centavos: 350000,
      p_descricao: 'Renegociado',
      p_vencimento: '2027-04-10',
      p_codigo_barras: '1'.repeat(44),
    });
    expect(r.error).toBeNull();
    expect(r.data).toBe(3);
    const serie = await lerSerie(serieId);
    expect(serie.map((b) => b.valor_centavos)).toEqual([299500, 299500, 350000, 350000, 350000]);
    expect(serie.map((b) => b.descricao)).toEqual(['Compra coleção', 'Compra coleção', 'Renegociado', 'Renegociado', 'Renegociado']);
    expect(serie.map((b) => b.vencimento)).toEqual(['2027-01-31', '2027-02-28', '2027-04-10', '2027-05-10', '2027-06-10']);
    // código só no editado
    expect(serie.map((b) => b.codigo_barras)).toEqual([CODIGO, null, '1'.repeat(44), null, null]);
  });

  it('alterar TODOS aplica em todas (inclusive anteriores) e mantém datas se o vencimento não mudou', async () => {
    const { serieId, ids } = await criarSerie();
    const r = await atualizar(ids[3], 'todos', { p_fornecedor_id: outro, p_vencimento: '2027-04-30' });
    expect(r.data).toBe(5);
    const serie = await lerSerie(serieId);
    expect(serie.every((b) => b.fornecedor_id === outro)).toBe(true);
    expect(serie.map((b) => b.vencimento)).toEqual(['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30', '2027-05-31']);
  });

  it('alterar TODOS com novo vencimento recalcula a partir da parcela editada (dia 31 preservado)', async () => {
    const { serieId, ids } = await criarSerie('2026-11-09');
    // parcela 2 (09/12/2026) passa para 31/12/2026
    await atualizar(ids[1], 'todos', { p_vencimento: '2026-12-31' });
    const serie = await lerSerie(serieId);
    expect(serie.map((b) => b.vencimento)).toEqual(['2026-11-30', '2026-12-31', '2027-01-31', '2027-02-28', '2027-03-31']);
  });

  it('pagar uma parcela não afeta as outras', async () => {
    const { serieId, ids } = await criarSerie();
    await u.cliente.rpc('definir_pagamento', { p_id: ids[0], p_pago: true });
    const serie = await lerSerie(serieId);
    expect(serie.map((b) => b.status)).toEqual(['pago', 'pendente', 'pendente', 'pendente', 'pendente']);
  });

  it('excluir SOMENTE ESTE mantém as demais (com numeração original)', async () => {
    const { serieId, ids } = await criarSerie();
    const r = await u.cliente.rpc('excluir_lancamento', { p_id: ids[1], p_escopo: 'este' });
    expect(r.data).toBe(1);
    const serie = await lerSerie(serieId);
    expect(serie.map((b) => b.parcela)).toEqual([1, 3, 4, 5]);
  });

  it('excluir ESTE E OS PRÓXIMOS a partir da 3ª deixa 1 e 2', async () => {
    const { serieId, ids } = await criarSerie();
    const r = await u.cliente.rpc('excluir_lancamento', { p_id: ids[2], p_escopo: 'proximos' });
    expect(r.data).toBe(3);
    expect((await lerSerie(serieId)).map((b) => b.parcela)).toEqual([1, 2]);
  });

  it('excluir TODOS remove a série inteira', async () => {
    const { serieId, ids } = await criarSerie();
    const r = await u.cliente.rpc('excluir_lancamento', { p_id: ids[4], p_escopo: 'todos' });
    expect(r.data).toBe(5);
    expect(await lerSerie(serieId)).toEqual([]);
  });

  it('escopo inválido é rejeitado', async () => {
    const { ids } = await criarSerie();
    const r = await u.cliente.rpc('excluir_lancamento', { p_id: ids[0], p_escopo: 'tudo' });
    expect(r.error?.code).toBe('22023');
  });

  it('um insert com linha inválida não cria nenhuma parcela (atômico)', async () => {
    const serieId = crypto.randomUUID();
    const linhas = [1, 2, 3].map((p) => ({
      ...vinculo(u),
    fornecedor_id: via,
      descricao: 'Atômico',
      valor_centavos: p === 3 ? -1 : 1000,
      vencimento: '2027-01-10',
      serie_id: serieId,
      parcela: p,
      total_parcelas: 3,
    }));
    const r = await u.cliente.from('lancamentos').insert(linhas);
    expect(r.error).not.toBeNull();
    expect(await lerSerie(serieId)).toEqual([]);
  });
});
