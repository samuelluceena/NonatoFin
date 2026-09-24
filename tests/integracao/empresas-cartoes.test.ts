/**
 * Empresas (CNPJ), categorias e cartões de crédito contra o banco real:
 * RLS/IDOR, restrições, paridade TS x SQL das parcelas e das faturas,
 * sincronização da fatura, trava de fatura paga, ajuste e propagação.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { descricaoFatura, planejarParcelas, vencimentoDaFatura } from '@/lib/domain/cartoes';
import { bancoDireto, clienteAdmin, criarFornecedor, criarUsuarioTeste, removerUsuario, vinculo, type UsuarioTeste } from './auxiliares';

let dono: UsuarioTeste;
let intruso: UsuarioTeste;
let emissor: string;
let cartao: string;

const DIAS = { diaFechamento: 3, diaVencimento: 10 };

async function novoCartao(u: UsuarioTeste, nome: string, fornecedorId: string, dias = DIAS) {
  const { data, error } = await u.cliente
    .from('cartoes')
    .insert({
      empresa_id: u.empresaId,
      fornecedor_id: fornecedorId,
      categoria_fatura_id: u.categorias['Cartão de crédito'],
      nome,
      final: '1234',
      dia_fechamento: dias.diaFechamento,
      dia_vencimento: dias.diaVencimento,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

function compra(
  u: UsuarioTeste,
  cartaoId: string,
  total: number,
  parcelas: number,
  primeira: string,
  descricao = 'Compra teste',
) {
  return u.cliente.rpc('registrar_compra_cartao', {
    p_cartao_id: cartaoId,
    p_categoria_id: u.categorias['Despesa variada'],
    p_descricao: descricao,
    p_data_compra: '2026-09-20',
    p_valor_total: total,
    p_parcelas: parcelas,
    p_primeira_fatura_mes: primeira,
    p_observacao: null,
  });
}

async function fatura(u: UsuarioTeste, cartaoId: string, mes: string) {
  const { data, error } = await u.cliente
    .from('lancamentos')
    .select('id, descricao, valor_centavos, vencimento, status, empresa_id, categoria_id, fornecedor_id, ajuste_centavos, observacao')
    .eq('cartao_id', cartaoId)
    .eq('fatura_mes', mes)
    .maybeSingle();
  if (error) throw error;
  return data;
}

beforeAll(async () => {
  [dono, intruso] = await Promise.all([criarUsuarioTeste(true), criarUsuarioTeste(true)]);
  emissor = await criarFornecedor(dono.cliente, 'Nubank');
  cartao = await novoCartao(dono, 'Nubank PJ', emissor);
});

afterAll(async () => {
  await Promise.all([removerUsuario(dono.id), removerUsuario(intruso.id)]);
});

describe('empresas e CNPJ', () => {
  it('aceita CNPJ numérico e alfanumérico válidos', async () => {
    const r = await dono.cliente.from('empresas').insert({ apelido: 'Alfa', cnpj: '12ABC34501DE35' }).select('id').single();
    expect(r.error).toBeNull();
  });

  it('recusa CNPJ com dígito verificador errado', async () => {
    const r = await dono.cliente.from('empresas').insert({ apelido: 'Errada', cnpj: '11222333000182' });
    expect(r.error?.code).toBe('23514');
  });

  it('recusa CNPJ e apelido repetidos na mesma conta', async () => {
    const r1 = await dono.cliente.from('empresas').insert({ apelido: 'Outra', cnpj: '11222333000181' });
    expect(r1.error?.message).toContain('empresas_cnpj_unico');
    const r2 = await dono.cliente.from('empresas').insert({ apelido: 'empresa teste' });
    expect(r2.error?.message).toContain('empresas_apelido_unico');
  });

  it('o mesmo CNPJ pode existir em outra conta (isolamento)', async () => {
    const r = await intruso.cliente.from('empresas').insert({ apelido: 'Alfa', cnpj: '12ABC34501DE35' });
    expect(r.error).toBeNull();
  });

  it('não exclui empresa com lançamentos', async () => {
    const f = await criarFornecedor(dono.cliente, 'Via da Moda');
    const { data: e } = await dono.cliente.from('empresas').insert({ apelido: 'Com boleto' }).select('id').single();
    await dono.cliente
      .from('lancamentos')
      .insert({ ...vinculo(dono), empresa_id: e!.id, fornecedor_id: f, descricao: 'x', valor_centavos: 100, vencimento: '2026-10-10' });
    const r = await dono.cliente.from('empresas').delete().eq('id', e!.id);
    expect(r.error?.code).toBe('23503');
  });
});

describe('categorias', () => {
  it('cria as 5 categorias padrão uma única vez', async () => {
    await dono.cliente.rpc('garantir_categorias_padrao');
    const { data } = await dono.cliente.from('categorias').select('nome');
    expect(data?.map((c) => c.nome).sort()).toEqual(
      ['Boleto de fornecedor', 'Cartão de crédito', 'Despesa fixa', 'Despesa variada', 'Empréstimo'].sort(),
    );
  });

  it('recusa nome repetido (sem acento/maiúsculas) e não exclui categoria em uso', async () => {
    const r1 = await dono.cliente.from('categorias').insert({ nome: 'EMPRESTIMO' });
    expect(r1.error?.message).toContain('categorias_nome_unico');
    const r2 = await dono.cliente.from('categorias').delete().eq('id', dono.categoriaId);
    expect(r2.error?.code).toBe('23503');
  });

  it('renomeia e exclui categoria sem uso', async () => {
    const { data } = await dono.cliente.from('categorias').insert({ nome: 'Impostos' }).select('id').single();
    expect((await dono.cliente.from('categorias').update({ nome: 'Tributos' }).eq('id', data!.id)).error).toBeNull();
    expect((await dono.cliente.from('categorias').delete().eq('id', data!.id)).error).toBeNull();
  });
});

describe('segurança (RLS e IDOR)', () => {
  it('outra conta não vê empresas, categorias, cartões, compras nem parcelas', async () => {
    await compra(dono, cartao, 5000, 2, '2027-03', 'Compra secreta');
    for (const tabela of ['empresas', 'categorias', 'cartoes', 'compras_cartao', 'parcelas_cartao'] as const) {
      const { data } = await intruso.cliente.from(tabela).select('id').eq('user_id', dono.id);
      expect(data, tabela).toEqual([]);
    }
    const { data } = await intruso.cliente.from('cartoes').select('id').eq('id', cartao);
    expect(data).toEqual([]);
  });

  it('não lança boleto na empresa de outra conta (FK composta)', async () => {
    const f = await criarFornecedor(intruso.cliente, 'Qualquer');
    const r = await intruso.cliente
      .from('lancamentos')
      .insert({ ...vinculo(intruso), empresa_id: dono.empresaId, fornecedor_id: f, descricao: 'x', valor_centavos: 100, vencimento: '2026-10-10' });
    expect(r.error).not.toBeNull();
    const r2 = await intruso.cliente
      .from('lancamentos')
      .insert({ ...vinculo(intruso), categoria_id: dono.categoriaId, fornecedor_id: f, descricao: 'x', valor_centavos: 100, vencimento: '2026-10-10' });
    expect(r2.error).not.toBeNull();
  });

  it('não cria cartão com empresa de outra conta nem lança compra no cartão alheio', async () => {
    const f = await criarFornecedor(intruso.cliente, 'Banco X');
    const r = await intruso.cliente.from('cartoes').insert({
      empresa_id: dono.empresaId,
      fornecedor_id: f,
      categoria_fatura_id: intruso.categorias['Cartão de crédito'],
      nome: 'Invasor',
      dia_fechamento: 1,
      dia_vencimento: 8,
    });
    expect(r.error).not.toBeNull();
    const r2 = await compra(intruso, cartao, 1000, 1, '2027-01');
    expect(r2.error).not.toBeNull();
    const { count } = await dono.cliente.from('compras_cartao').select('id', { count: 'exact', head: true }).eq('descricao', 'Compra teste').eq('cartao_id', cartao).eq('primeira_fatura_mes', '2027-01');
    expect(count).toBe(0);
  });

  it('não altera, ajusta nem exclui compra/fatura de outra conta', async () => {
    const { data: c } = await dono.cliente.from('compras_cartao').select('id').eq('descricao', 'Compra secreta').single();
    const f = await fatura(dono, cartao, '2027-03');
    expect((await intruso.cliente.rpc('excluir_compra_cartao', { p_id: c!.id })).error).not.toBeNull();
    expect((await intruso.cliente.rpc('definir_ajuste_fatura', { p_id: f!.id, p_ajuste: -100, p_observacao: null })).error).not.toBeNull();
    const depois = await fatura(dono, cartao, '2027-03');
    expect(depois?.valor_centavos).toBe(2500);
    expect(depois?.ajuste_centavos).toBe(0);
  });

  it('não grava parcela diretamente (somente pelas funções)', async () => {
    const r = await dono.cliente.from('parcelas_cartao').insert({
      compra_id: '00000000-0000-0000-0000-000000000000',
      cartao_id: cartao,
      numero: 1,
      total: 1,
      valor_centavos: 1,
      fatura_mes: '2027-01',
    } as never);
    expect(r.error).not.toBeNull();
  });
});

describe('compras parceladas e faturas', () => {
  it('divide igual ao TypeScript (sobra na 1ª parcela) e cria as faturas', async () => {
    for (const [total, n] of [
      [10000, 3],
      [299999, 7],
      [48, 48],
      [123457, 12],
    ] as const) {
      const cartaoTmp = await novoCartao(dono, `Paridade ${total}-${n}`, emissor);
      const { data: id, error } = await compra(dono, cartaoTmp, total, n, '2026-11');
      expect(error).toBeNull();
      const { data: parcelas } = await dono.cliente
        .from('parcelas_cartao')
        .select('numero, total, valor_centavos, fatura_mes')
        .eq('compra_id', id!)
        .order('numero');
      expect(
        parcelas?.map((p) => ({ numero: p.numero, total: p.total, valorCentavos: Number(p.valor_centavos), faturaMes: p.fatura_mes })),
      ).toEqual(planejarParcelas(total, n, '2026-11'));
    }
  });

  it('a fatura soma as parcelas do mês e herda empresa, emissor e categoria do cartão', async () => {
    const c = await novoCartao(dono, 'Itaú Loja', emissor, { diaFechamento: 25, diaVencimento: 5 });
    await compra(dono, c, 10000, 3, '2026-10', 'Tecidos');
    await compra(dono, c, 2550, 1, '2026-10', 'Linhas');
    const f = await fatura(dono, c, '2026-10');
    expect(f).toMatchObject({
      valor_centavos: 3334 + 2550,
      vencimento: vencimentoDaFatura('2026-10', 5),
      descricao: descricaoFatura('Itaú Loja', '2026-10'),
      empresa_id: dono.empresaId,
      categoria_id: dono.categorias['Cartão de crédito'],
      fornecedor_id: emissor,
      status: 'pendente',
    });
    expect((await fatura(dono, c, '2026-11'))?.valor_centavos).toBe(3333);
    expect((await fatura(dono, c, '2026-12'))?.valor_centavos).toBe(3333);
    expect(await fatura(dono, c, '2027-01')).toBeNull();
  });

  it('vencimento no fim de mês curto usa o último dia', async () => {
    const c = await novoCartao(dono, 'Dia 31', emissor, { diaFechamento: 24, diaVencimento: 31 });
    await compra(dono, c, 900, 3, '2027-01');
    expect((await fatura(dono, c, '2027-02'))?.vencimento).toBe('2027-02-28');
    expect((await fatura(dono, c, '2027-03'))?.vencimento).toBe('2027-03-31');
  });

  it('editar a compra recalcula as faturas; excluir remove faturas vazias', async () => {
    const c = await novoCartao(dono, 'Edição', emissor);
    const { data: id } = await compra(dono, c, 6000, 3, '2027-01');
    const r = await dono.cliente.rpc('atualizar_compra_cartao', {
      p_id: id!,
      p_cartao_id: c,
      p_categoria_id: dono.categorias['Despesa fixa'],
      p_descricao: 'Editada',
      p_data_compra: '2026-12-20',
      p_valor_total: 5000,
      p_parcelas: 2,
      p_primeira_fatura_mes: '2027-02',
      p_observacao: 'obs',
    });
    expect(r.error).toBeNull();
    expect(await fatura(dono, c, '2027-01')).toBeNull();
    expect((await fatura(dono, c, '2027-02'))?.valor_centavos).toBe(2500);
    expect((await fatura(dono, c, '2027-03'))?.valor_centavos).toBe(2500);
    expect(await fatura(dono, c, '2027-04')).toBeNull();

    expect((await dono.cliente.rpc('excluir_compra_cartao', { p_id: id! })).error).toBeNull();
    expect(await fatura(dono, c, '2027-02')).toBeNull();
    const { count } = await dono.cliente.from('parcelas_cartao').select('id', { count: 'exact', head: true }).eq('compra_id', id!);
    expect(count).toBe(0);
  });

  it('fatura paga trava as compras dela até desfazer o pagamento', async () => {
    const c = await novoCartao(dono, 'Trava', emissor);
    const { data: id } = await compra(dono, c, 3000, 2, '2027-05');
    const f = await fatura(dono, c, '2027-05');
    await dono.cliente.rpc('definir_pagamento', { p_id: f!.id, p_pago: true });

    const nova = await compra(dono, c, 1000, 1, '2027-05');
    expect(nova.error?.message).toContain('já está paga');
    const exc = await dono.cliente.rpc('excluir_compra_cartao', { p_id: id! });
    expect(exc.error?.message).toContain('já está paga');
    const aj = await dono.cliente.rpc('definir_ajuste_fatura', { p_id: f!.id, p_ajuste: 100, p_observacao: null });
    expect(aj.error?.message).toContain('já está paga');
    expect((await fatura(dono, c, '2027-05'))?.valor_centavos).toBe(1500);

    // compra em fatura seguinte continua permitida
    expect((await compra(dono, c, 1000, 1, '2027-06')).error).toBeNull();

    await dono.cliente.rpc('definir_pagamento', { p_id: f!.id, p_pago: false });
    expect((await dono.cliente.rpc('excluir_compra_cartao', { p_id: id! })).error).toBeNull();
  });

  it('ajuste soma ao valor, não deixa a fatura zerada e mantém a fatura sem compras', async () => {
    const c = await novoCartao(dono, 'Ajuste', emissor);
    const { data: id } = await compra(dono, c, 10000, 1, '2027-07');
    const f = await fatura(dono, c, '2027-07');

    expect((await dono.cliente.rpc('definir_ajuste_fatura', { p_id: f!.id, p_ajuste: 1590, p_observacao: 'Juros' })).error).toBeNull();
    expect(await fatura(dono, c, '2027-07')).toMatchObject({ valor_centavos: 11590, ajuste_centavos: 1590, observacao: 'Juros' });

    const neg = await dono.cliente.rpc('definir_ajuste_fatura', { p_id: f!.id, p_ajuste: -10000, p_observacao: null });
    expect(neg.error?.message).toContain('zerado ou negativo');

    await dono.cliente.rpc('definir_ajuste_fatura', { p_id: f!.id, p_ajuste: 500, p_observacao: 'Anuidade' });
    await dono.cliente.rpc('excluir_compra_cartao', { p_id: id! });
    expect(await fatura(dono, c, '2027-07')).toMatchObject({ valor_centavos: 500, ajuste_centavos: 500 });
  });

  it('boleto de fatura não é editado pela edição comum e não é excluído com compras', async () => {
    const c = await novoCartao(dono, 'Protegida', emissor);
    await compra(dono, c, 2000, 1, '2027-08');
    const f = await fatura(dono, c, '2027-08');
    const ed = await dono.cliente.rpc('atualizar_lancamento', {
      p_id: f!.id,
      p_escopo: 'este',
      p_empresa_id: dono.empresaId,
      p_categoria_id: dono.categoriaId,
      p_conta_id: null,
      p_fornecedor_id: emissor,
      p_descricao: 'Hack',
      p_valor_centavos: 1,
      p_vencimento: '2027-08-01',
      p_codigo_barras: null,
      p_observacao: null,
      p_status: 'pendente',
    } as never);
    expect(ed.error?.message).toContain('Faturas de cartão');
    const ex = await dono.cliente.rpc('excluir_lancamento', { p_id: f!.id, p_escopo: 'este' });
    expect(ex.error?.message).toContain('tem compras');
    const del = await dono.cliente.from('cartoes').delete().eq('id', c);
    expect(del.error?.code).toBe('23503');
  });

  it('alterar o cartão atualiza só as faturas em aberto', async () => {
    const c = await novoCartao(dono, 'Propaga', emissor);
    await compra(dono, c, 2000, 2, '2027-09');
    const paga = await fatura(dono, c, '2027-09');
    await dono.cliente.rpc('definir_pagamento', { p_id: paga!.id, p_pago: true });

    const outroEmissor = await criarFornecedor(dono.cliente, 'Inter');
    const { error } = await dono.cliente
      .from('cartoes')
      .update({ nome: 'Propaga Novo', dia_vencimento: 15, fornecedor_id: outroEmissor, categoria_fatura_id: dono.categorias['Despesa fixa'] })
      .eq('id', c);
    expect(error).toBeNull();

    expect(await fatura(dono, c, '2027-10')).toMatchObject({
      descricao: descricaoFatura('Propaga Novo', '2027-10'),
      vencimento: '2027-10-15',
      fornecedor_id: outroEmissor,
      categoria_id: dono.categorias['Despesa fixa'],
    });
    expect(await fatura(dono, c, '2027-09')).toMatchObject({
      descricao: descricaoFatura('Propaga', '2027-09'),
      vencimento: '2027-09-10',
      fornecedor_id: emissor,
      status: 'pago',
    });
  });

  it('excluir a conta apaga tudo, inclusive faturas pagas', async () => {
    const temp = await criarUsuarioTeste(true);
    const f = await criarFornecedor(temp.cliente, 'Banco Temp');
    const c = await novoCartao(temp, 'Temp', f);
    await compra(temp, c, 3000, 3, '2027-01');
    const paga = await fatura(temp, c, '2027-01');
    await temp.cliente.rpc('definir_pagamento', { p_id: paga!.id, p_pago: true });
    const { error } = await clienteAdmin().auth.admin.deleteUser(temp.id);
    expect(error).toBeNull();
    const db = bancoDireto();
    try {
      for (const t of ['empresas', 'categorias', 'cartoes', 'compras_cartao', 'parcelas_cartao', 'lancamentos', 'fornecedores']) {
        const r = await db.query(`select count(*)::int as n from public.${t} where user_id = $1`, [temp.id]);
        expect(r.rows[0].n, t).toBe(0);
      }
    } finally {
      await db.end();
    }
  });

  it('valida dias, final e parcelas no banco', async () => {
    const base = {
      empresa_id: dono.empresaId,
      fornecedor_id: emissor,
      categoria_fatura_id: dono.categorias['Cartão de crédito'],
    };
    expect((await dono.cliente.from('cartoes').insert({ ...base, nome: 'Dias iguais', dia_fechamento: 5, dia_vencimento: 5 })).error?.code).toBe('23514');
    expect((await dono.cliente.from('cartoes').insert({ ...base, nome: 'Dia 32', dia_fechamento: 32, dia_vencimento: 5 })).error?.code).toBe('23514');
    expect((await dono.cliente.from('cartoes').insert({ ...base, nome: 'Final', final: '12a4', dia_fechamento: 1, dia_vencimento: 8 })).error?.code).toBe('23514');
    expect((await compra(dono, cartao, 1000, 49, '2027-01')).error).not.toBeNull();
    expect((await compra(dono, cartao, 3, 4, '2027-01')).error).not.toBeNull();
    expect((await compra(dono, cartao, 1000, 1, '2027-13')).error).not.toBeNull();
  });
});
