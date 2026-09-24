/**
 * Contas bancárias e saldo contra o banco real: RLS/IDOR, conta da mesma
 * empresa, conta padrão única, cálculo do saldo, conferência, transferência,
 * pagamento com troca de conta, faturas herdando a conta do cartão.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarFornecedor, criarUsuarioTeste, removerUsuario, vinculo, type UsuarioTeste } from './auxiliares';

let dono: UsuarioTeste;
let intruso: UsuarioTeste;
let fornecedor: string;
let outraEmpresa: string;

async function novaConta(u: UsuarioTeste, apelido: string, empresaId = u.empresaId, padrao = false) {
  const { data, error } = await u.cliente
    .from('contas_bancarias')
    .insert({ empresa_id: empresaId, apelido, banco: 'Banco Teste', padrao })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

async function saldo(u: UsuarioTeste, contaId: string): Promise<number> {
  const { data, error } = await u.cliente.rpc('saldos_contas');
  if (error) throw error;
  return Number(data?.find((s) => s.conta_id === contaId)?.saldo_centavos ?? NaN);
}

async function lancamento(u: UsuarioTeste, valor: number, contaId: string | null, vencimento = '2026-10-10') {
  const { data, error } = await u.cliente
    .from('lancamentos')
    .insert({ ...vinculo(u), fornecedor_id: fornecedor, conta_id: contaId, descricao: 'Conta', valor_centavos: valor, vencimento })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

beforeAll(async () => {
  [dono, intruso] = await Promise.all([criarUsuarioTeste(true), criarUsuarioTeste(true)]);
  fornecedor = await criarFornecedor(dono.cliente, 'Enel');
  const { data } = await dono.cliente.from('empresas').insert({ apelido: 'Segunda', cnpj: '12345678000195' }).select('id').single();
  outraEmpresa = data!.id;
});

afterAll(async () => {
  await Promise.all([removerUsuario(dono.id), removerUsuario(intruso.id)]);
});

describe('cadastro de contas', () => {
  it('uma única conta padrão por empresa (marcar outra desmarca a anterior)', async () => {
    const a = await novaConta(dono, 'Itaú PJ', dono.empresaId, true);
    const b = await novaConta(dono, 'Nubank PJ', dono.empresaId, true);
    const { data } = await dono.cliente.from('contas_bancarias').select('id, padrao').in('id', [a, b]);
    expect(Object.fromEntries((data ?? []).map((c) => [c.id, c.padrao]))).toEqual({ [a]: false, [b]: true });
    // Outra empresa tem a sua própria padrão.
    const c = await novaConta(dono, 'Bradesco', outraEmpresa, true);
    const { data: d2 } = await dono.cliente.from('contas_bancarias').select('padrao').eq('id', b).single();
    expect(d2?.padrao).toBe(true);
    expect(c).toBeTruthy();
  });

  it('valida final, apelido repetido e padrão inativa', async () => {
    const base = { empresa_id: dono.empresaId, banco: 'X' };
    expect((await dono.cliente.from('contas_bancarias').insert({ ...base, apelido: 'Final', final: '12a4' })).error?.code).toBe('23514');
    expect((await dono.cliente.from('contas_bancarias').insert({ ...base, apelido: 'ITAÚ pj' })).error?.message).toContain('contas_apelido_unico');
    expect((await dono.cliente.from('contas_bancarias').insert({ ...base, apelido: 'Inativa', padrao: true, ativa: false })).error?.code).toBe('23514');
  });

  it('lançamento só aceita conta da MESMA empresa', async () => {
    const daOutra = await novaConta(dono, 'Caixa Outra', outraEmpresa);
    const r = await dono.cliente
      .from('lancamentos')
      .insert({ ...vinculo(dono), fornecedor_id: fornecedor, conta_id: daOutra, descricao: 'x', valor_centavos: 100, vencimento: '2026-10-10' });
    expect(r.error?.code).toBe('23503');
  });

  it('conta ligada a lançamento não pode ser excluída', async () => {
    const conta = await novaConta(dono, 'Em uso');
    await lancamento(dono, 100, conta);
    expect((await dono.cliente.from('contas_bancarias').delete().eq('id', conta)).error?.code).toBe('23503');
  });
});

describe('saldo', () => {
  it('saldo = movimentos confirmados − lançamentos pagos pela conta', async () => {
    const conta = await novaConta(dono, 'Saldo');
    await dono.cliente.rpc('conferir_saldo', { p_conta_id: conta, p_saldo_informado: 100000 });
    expect(await saldo(dono, conta)).toBe(100000);

    await dono.cliente.from('movimentos_conta').insert({ conta_id: conta, tipo: 'entrada', data: '2026-09-20', valor_centavos: 25000, descricao: 'Vendas' });
    await dono.cliente.from('movimentos_conta').insert({ conta_id: conta, tipo: 'entrada', data: '2099-01-01', valor_centavos: 99999, descricao: 'Prevista', confirmado: false });
    expect(await saldo(dono, conta)).toBe(125000);

    const pendente = await lancamento(dono, 30000, conta);
    expect(await saldo(dono, conta)).toBe(125000); // pendente não mexe no saldo
    await dono.cliente.rpc('definir_pagamento', { p_id: pendente, p_pago: true });
    expect(await saldo(dono, conta)).toBe(95000);
    await dono.cliente.rpc('definir_pagamento', { p_id: pendente, p_pago: false });
    expect(await saldo(dono, conta)).toBe(125000); // desfazer devolve
  });

  it('conferência grava o ajuste (banco − calculado) com a data de hoje', async () => {
    const conta = await novaConta(dono, 'Conferência');
    await dono.cliente.rpc('conferir_saldo', { p_conta_id: conta, p_saldo_informado: 50000 });
    const { data: mov, error } = await dono.cliente.rpc('conferir_saldo', { p_conta_id: conta, p_saldo_informado: 47650 });
    expect(error).toBeNull();
    expect(mov).toMatchObject({ tipo: 'conferencia', valor_centavos: -2350, saldo_informado: 47650 });
    const { data: hoje } = await dono.cliente.rpc('hoje_app');
    expect(mov?.data).toBe(hoje);
    expect(await saldo(dono, conta)).toBe(47650);
    // saldo negativo também pode ser informado
    await dono.cliente.rpc('conferir_saldo', { p_conta_id: conta, p_saldo_informado: -1500 });
    expect(await saldo(dono, conta)).toBe(-1500);
  });

  it('transferência move o valor entre contas e pode ser desfeita inteira', async () => {
    const a = await novaConta(dono, 'Origem');
    const b = await novaConta(dono, 'Destino', outraEmpresa);
    await dono.cliente.rpc('conferir_saldo', { p_conta_id: a, p_saldo_informado: 10000 });
    const { data: hoje } = await dono.cliente.rpc('hoje_app');
    const { data: tid, error } = await dono.cliente.rpc('transferir_entre_contas', {
      p_origem_id: a,
      p_destino_id: b,
      p_valor: 4000,
      p_data: hoje!,
      p_descricao: null,
    });
    expect(error).toBeNull();
    expect([await saldo(dono, a), await saldo(dono, b)]).toEqual([6000, 4000]);

    expect((await dono.cliente.rpc('transferir_entre_contas', { p_origem_id: a, p_destino_id: a, p_valor: 1, p_data: hoje!, p_descricao: null })).error?.message).toContain('contas diferentes');
    expect((await dono.cliente.rpc('transferir_entre_contas', { p_origem_id: a, p_destino_id: b, p_valor: 1, p_data: '2099-01-01', p_descricao: null })).error?.message).toContain('data futura');

    await dono.cliente.rpc('excluir_transferencia', { p_transferencia_id: tid! });
    expect([await saldo(dono, a), await saldo(dono, b)]).toEqual([10000, 0]);
  });

  it('pagar informando outra conta ("paguei pelo Nubank") debita a conta escolhida', async () => {
    const itau = await novaConta(dono, 'Itaú troca');
    const nubank = await novaConta(dono, 'Nubank troca');
    const l = await lancamento(dono, 7000, itau);
    const { error } = await dono.cliente.rpc('definir_pagamento', { p_id: l, p_pago: true, p_conta_id: nubank });
    expect(error).toBeNull();
    expect([await saldo(dono, itau), await saldo(dono, nubank)]).toEqual([0, -7000]);
    // conta de outra empresa é recusada
    const daOutra = await novaConta(dono, 'Outra troca', outraEmpresa);
    expect((await dono.cliente.rpc('definir_pagamento', { p_id: l, p_pago: true, p_conta_id: daOutra })).error?.code).toBe('23503');
  });

  it('edição com escopo aplica a conta aos lançamentos da série', async () => {
    const conta = await novaConta(dono, 'Série');
    const serieId = crypto.randomUUID();
    const { data: linhas } = await dono.cliente
      .from('lancamentos')
      .insert(
        [1, 2, 3].map((p) => ({
          ...vinculo(dono),
          fornecedor_id: fornecedor,
          descricao: 'Aluguel',
          valor_centavos: 1000,
          vencimento: `2027-0${p}-10`,
          serie_id: serieId,
          parcela: p,
          total_parcelas: 3,
        })),
      )
      .select('id, parcela')
      .order('parcela');
    const r = await dono.cliente.rpc('atualizar_lancamento', {
      p_id: linhas![1].id,
      p_escopo: 'proximos',
      p_empresa_id: dono.empresaId,
      p_categoria_id: dono.categoriaId,
      p_conta_id: conta,
      p_fornecedor_id: fornecedor,
      p_descricao: 'Aluguel',
      p_valor_centavos: 1000,
      p_vencimento: '2027-02-10',
      p_codigo_barras: null,
      p_observacao: null,
      p_status: 'pendente',
    });
    expect(r.error).toBeNull();
    const { data } = await dono.cliente.from('lancamentos').select('parcela, conta_id').eq('serie_id', serieId).order('parcela');
    expect(data?.map((l) => l.conta_id)).toEqual([null, conta, conta]);
  });
});

describe('conferência diária', () => {
  it('conta ativa sem conferência hoje precisa ser conferida; a conferência (ou o cadastro) resolve', async () => {
    const u = await criarUsuarioTeste(true);
    try {
      const { data: c } = await u.cliente.from('contas_bancarias').insert({ empresa_id: u.empresaId, apelido: 'Diária', banco: 'X' }).select('id').single();
      expect((await u.cliente.rpc('contas_a_conferir_hoje')).data).toEqual([c!.id]);
      await u.cliente.rpc('conferir_saldo', { p_conta_id: c!.id, p_saldo_informado: 0 });
      expect((await u.cliente.rpc('contas_a_conferir_hoje')).data).toEqual([]);
      // conta inativa não é cobrada
      await u.cliente.from('contas_bancarias').insert({ empresa_id: u.empresaId, apelido: 'Parada', banco: 'X', ativa: false });
      expect((await u.cliente.rpc('contas_a_conferir_hoje')).data).toEqual([]);
      // conferência de ontem não vale para hoje
      await u.cliente.from('movimentos_conta').update({ data: '2020-01-01' }).eq('conta_id', c!.id);
      expect((await u.cliente.rpc('contas_a_conferir_hoje')).data).toEqual([c!.id]);
    } finally {
      await removerUsuario(u.id);
    }
  });
});

describe('cartões e contas', () => {
  it('fatura herda a conta do cartão; mudar o cartão atualiza só as faturas em aberto', async () => {
    const conta1 = await novaConta(dono, 'Cartão 1');
    const conta2 = await novaConta(dono, 'Cartão 2');
    const emissor = await criarFornecedor(dono.cliente, 'Banco do Cartão');
    const { data: cartao } = await dono.cliente
      .from('cartoes')
      .insert({
        empresa_id: dono.empresaId,
        fornecedor_id: emissor,
        categoria_fatura_id: dono.categorias['Cartão de crédito'],
        conta_id: conta1,
        nome: 'Cartão com conta',
        dia_fechamento: 3,
        dia_vencimento: 10,
      })
      .select('id')
      .single();
    const compra = (mes: string) =>
      dono.cliente.rpc('registrar_compra_cartao', {
        p_cartao_id: cartao!.id,
        p_categoria_id: dono.categorias['Despesa variada'],
        p_descricao: 'Compra',
        p_data_compra: '2026-09-20',
        p_valor_total: 2000,
        p_parcelas: 2,
        p_primeira_fatura_mes: mes,
        p_observacao: null,
      });
    await compra('2027-01');
    const fatura = async (mes: string) =>
      (await dono.cliente.from('lancamentos').select('id, conta_id').eq('cartao_id', cartao!.id).eq('fatura_mes', mes).single()).data;
    expect((await fatura('2027-01'))?.conta_id).toBe(conta1);

    await dono.cliente.rpc('definir_pagamento', { p_id: (await fatura('2027-01'))!.id, p_pago: true });
    await dono.cliente.from('cartoes').update({ conta_id: conta2 }).eq('id', cartao!.id);
    expect((await fatura('2027-01'))?.conta_id).toBe(conta1); // paga: mantém
    expect((await fatura('2027-02'))?.conta_id).toBe(conta2); // em aberto: segue o cartão
    expect(await saldo(dono, conta1)).toBe(-1000);
  });
});

describe('segurança (RLS e IDOR)', () => {
  it('outra conta não vê, não usa e não mexe nas contas e movimentos', async () => {
    const conta = await novaConta(dono, 'Secreta');
    await dono.cliente.rpc('conferir_saldo', { p_conta_id: conta, p_saldo_informado: 123456 });

    for (const tabela of ['contas_bancarias', 'movimentos_conta'] as const) {
      const { data } = await intruso.cliente.from(tabela).select('id').eq('user_id', dono.id);
      expect(data, tabela).toEqual([]);
    }
    const { data: saldos } = await intruso.cliente.rpc('saldos_contas');
    expect(saldos?.some((s) => s.conta_id === conta)).toBe(false);

    // conferir, transferir, lançar entrada e pagar usando a conta alheia
    expect((await intruso.cliente.rpc('conferir_saldo', { p_conta_id: conta, p_saldo_informado: 0 })).error).not.toBeNull();
    const minha = await novaConta(intruso, 'Minha');
    const { data: hoje } = await intruso.cliente.rpc('hoje_app');
    expect(
      (await intruso.cliente.rpc('transferir_entre_contas', { p_origem_id: conta, p_destino_id: minha, p_valor: 100, p_data: hoje!, p_descricao: null })).error,
    ).not.toBeNull();
    expect(
      (await intruso.cliente.from('movimentos_conta').insert({ conta_id: conta, tipo: 'entrada', data: hoje!, valor_centavos: 1, descricao: 'x' })).error,
    ).not.toBeNull();
    const f = await criarFornecedor(intruso.cliente, 'F');
    expect(
      (
        await intruso.cliente
          .from('lancamentos')
          .insert({ ...vinculo(intruso), fornecedor_id: f, conta_id: conta, descricao: 'x', valor_centavos: 1, vencimento: '2026-10-10' })
      ).error,
    ).not.toBeNull();

    expect(await saldo(dono, conta)).toBe(123456);
  });
});
