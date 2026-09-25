/**
 * Transações contra o banco real: composição das fontes (lançamentos,
 * movimentos, compras), tipos, status, datas, filtros (período, tipo, status,
 * empresa, conta, categoria, fornecedor, pesquisa), totais e isolamento entre
 * usuários (RLS). Também o uso das categorias.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { listarUsoDasCategorias } from '@/features/empresas/consultas';
import { listarTransacoes } from '@/features/transacoes/consultas';
import { adicionarDias, adicionarMeses, chaveDoMes, hojeISO } from '@/lib/domain/datas';
import { SEM_CONTA } from '@/lib/domain/filtros';
import { FILTROS_TRANSACOES_PADRAO, compararTransacoes, resumirTransacoes, type FiltrosTransacoes } from '@/lib/domain/transacoes';
import type { ClienteSupabase } from '@/lib/supabase/server';
import { criarFornecedor, criarUsuarioTeste, removerUsuario, vinculo, type UsuarioTeste } from './auxiliares';

const HOJE = hojeISO();
let dono: UsuarioTeste;
let intruso: UsuarioTeste;
let empresaB: string;
const id: Record<string, string> = {};

const cliente = (u: UsuarioTeste) => u.cliente as unknown as ClienteSupabase;
/** Janela fixa em volta de hoje (não depende de estar no começo ou fim do mês). */
const filtros = (parcial: Partial<FiltrosTransacoes> = {}): FiltrosTransacoes => ({
  ...FILTROS_TRANSACOES_PADRAO,
  periodo: { tipo: 'intervalo', de: adicionarDias(HOJE, -10), ate: adicionarDias(HOJE, 10) },
  ...parcial,
});
const listar = (u: UsuarioTeste, parcial: Partial<FiltrosTransacoes> = {}, topo?: string) => listarTransacoes(cliente(u), filtros(parcial), HOJE, topo);

async function ok<T>(p: PromiseLike<{ data: T; error: unknown }>): Promise<NonNullable<T>> {
  const { data, error } = await p;
  if (error) throw error;
  if (data === null || data === undefined) throw new Error('consulta sem dados');
  return data;
}

/** Operações de escrita cujo retorno não importa. */
async function feito(p: PromiseLike<{ error: unknown }>): Promise<void> {
  const { error } = await p;
  if (error) throw error;
}

beforeAll(async () => {
  [dono, intruso] = await Promise.all([criarUsuarioTeste(true), criarUsuarioTeste(true)]);
  const c = dono.cliente;
  empresaB = (await ok(c.from('empresas').insert({ apelido: 'Filial Teste', cnpj: '12345678000195' }).select('id').single())).id;
  const conta = async (apelido: string, empresa: string) =>
    (await ok(c.from('contas_bancarias').insert({ empresa_id: empresa, apelido, banco: 'Banco Teste', final: '1234' }).select('id').single())).id;
  id.contaA1 = await conta('Itaú Trans', dono.empresaId);
  id.contaA2 = await conta('Caixa Trans', dono.empresaId);
  id.contaB = await conta('Nubank Trans', empresaB);

  // Saldo inicial (+1.000,00) e uma conferência SEM diferença (não deve aparecer).
  await feito(c.rpc('conferir_saldo', { p_conta_id: id.contaA1, p_saldo_informado: 100000 }));
  await feito(c.rpc('conferir_saldo', { p_conta_id: id.contaA1, p_saldo_informado: 100000 }));
  // Entradas: uma confirmada hoje, uma prevista (futura).
  await feito(c.from('movimentos_conta').insert({ conta_id: id.contaA1, tipo: 'entrada', data: HOJE, valor_centavos: 25000, descricao: 'Vendas balcão' }));
  await feito(c.from('movimentos_conta').insert({ conta_id: id.contaA2, tipo: 'entrada', data: adicionarDias(HOJE, 3), valor_centavos: 8000, descricao: 'Pix previsto', confirmado: false }));
  // Transferência entre empresas (A → B).
  await feito(c.rpc('transferir_entre_contas', { p_origem_id: id.contaA1, p_destino_id: id.contaB, p_data: HOJE, p_valor: 4000, p_descricao: 'Reserva' }));

  const forn = await criarFornecedor(c, 'Energia Elétrica Ávila');
  id.fornecedor = forn;
  const outroForn = await criarFornecedor(c, 'Aluguel Centro');
  const lanc = async (linha: Record<string, unknown>) => (await ok(c.from('lancamentos').insert({ ...vinculo(dono), ...linha } as never).select('id').single() as never)) as { id: string };
  id.pendente = (await lanc({ fornecedor_id: forn, descricao: 'Luz loja', valor_centavos: 12000, vencimento: adicionarDias(HOJE, 5), conta_id: id.contaA1, categoria_id: dono.categorias['Despesa fixa'] })).id;
  id.atrasado = (await lanc({ fornecedor_id: outroForn, descricao: 'Aluguel', valor_centavos: 50000, vencimento: adicionarDias(HOJE, -3), conta_id: id.contaA1 })).id;
  id.pago = (await lanc({ fornecedor_id: forn, descricao: 'Luz depósito', valor_centavos: 7000, vencimento: adicionarDias(HOJE, -2) })).id;
  await feito(c.rpc('definir_pagamento', { p_id: id.pago, p_pago: true, p_conta_id: id.contaA1 }));
  id.semConta = (await lanc({ empresa_id: empresaB, fornecedor_id: outroForn, descricao: 'Taxa filial', valor_centavos: 3000, vencimento: adicionarDias(HOJE, 1) })).id;

  // Compra no cartão (a fatura cai daqui a 2 meses, fora da janela).
  const emissor = await criarFornecedor(c, 'Banco Emissor');
  id.cartao = (
    await ok(
      c
        .from('cartoes')
        .insert({ empresa_id: dono.empresaId, fornecedor_id: emissor, categoria_fatura_id: dono.categorias['Cartão de crédito'], nome: 'Cartão Trans', dia_fechamento: 3, dia_vencimento: 10 })
        .select('id')
        .single(),
    )
  ).id;
  id.compra = await ok(
    c.rpc('registrar_compra_cartao', {
      p_cartao_id: id.cartao,
      p_categoria_id: dono.categorias['Despesa variada'],
      p_descricao: 'Tecidos da coleção',
      p_data_compra: HOJE,
      p_valor_total: 30000,
      p_parcelas: 3,
      p_primeira_fatura_mes: chaveDoMes(adicionarMeses(HOJE, 2)),
      p_observacao: null,
    }),
  );
});

afterAll(async () => {
  await Promise.all([removerUsuario(dono.id), removerUsuario(intruso.id)]);
});

describe('composição', () => {
  it('traz cada tipo uma vez, em ordem cronológica (mais recente primeiro)', async () => {
    const { itens, truncado } = await listar(dono);
    expect(truncado).toBe(false);
    const porTipo = (tipo: string) => itens.filter((t) => t.tipo === tipo);
    expect(porTipo('conta-a-pagar').map((t) => t.chave).sort()).toEqual([`l-${id.atrasado}`, `l-${id.pendente}`, `l-${id.semConta}`].sort());
    expect(porTipo('pagamento').map((t) => t.chave)).toEqual([`l-${id.pago}`]);
    expect(porTipo('entrada')).toHaveLength(2);
    expect(porTipo('transferencia')).toHaveLength(1); // os dois lados viram um item
    expect(porTipo('ajuste')).toHaveLength(1); // a conferência sem diferença não aparece
    expect(porTipo('compra-cartao').map((t) => t.chave)).toEqual([`c-${id.compra}`]);
    expect([...itens].sort(compararTransacoes)).toEqual(itens);
  });

  it('datas, status e valores de cada tipo', async () => {
    const { itens } = await listar(dono);
    const achar = (chave: string) => itens.find((t) => t.chave === chave)!;
    // Pagamento: no dia em que foi pago (hoje), não no vencimento.
    expect(achar(`l-${id.pago}`)).toMatchObject({ data: HOJE, status: 'pago', sinal: -1, efetivo: true, valorCentavos: 7000, conta: { id: id.contaA1 } });
    expect(achar(`l-${id.atrasado}`)).toMatchObject({ data: adicionarDias(HOJE, -3), status: 'atrasado', efetivo: false });
    expect(achar(`l-${id.pendente}`)).toMatchObject({ status: 'pendente', categoria: { nome: 'Despesa fixa' }, fornecedor: { nome: 'Energia Elétrica Ávila' } });
    const entradas = itens.filter((t) => t.tipo === 'entrada');
    expect(entradas.find((t) => t.efetivo)).toMatchObject({ titulo: 'Vendas balcão', status: 'confirmado', valorCentavos: 25000, sinal: 1 });
    expect(entradas.find((t) => !t.efetivo)).toMatchObject({ titulo: 'Pix previsto', status: 'previsto', data: adicionarDias(HOJE, 3) });
    const transf = itens.find((t) => t.tipo === 'transferencia')!;
    expect(transf).toMatchObject({ sinal: 0, valorCentavos: 4000, conta: { id: id.contaA1 }, contaDestino: { id: id.contaB }, descricao: 'Reserva' });
    expect(transf.complemento).toBe('Itaú Trans •••• 1234 → Nubank Trans •••• 1234');
    expect(itens.find((t) => t.tipo === 'ajuste')).toMatchObject({ titulo: 'Saldo inicial', sinal: 1, valorCentavos: 100000 });
    expect(achar(`c-${id.compra}`)).toMatchObject({ status: 'na-fatura', sinal: 0, valorCentavos: 30000, categoria: { nome: 'Despesa variada' } });
  });

  it('totais: caixa separado de obrigação; transferência, ajuste e compra fora', async () => {
    const { itens } = await listar(dono);
    expect(resumirTransacoes(itens)).toEqual({
      entradasCentavos: 25000,
      pagamentosCentavos: 7000,
      aPagarCentavos: 12000 + 50000 + 3000,
      atrasadas: 1,
      aReceberCentavos: 8000,
      quantidade: itens.length,
    });
  });
});

describe('filtros', () => {
  it('período: pagamento fora da janela quando o pagamento foi hoje e a janela termina ontem', async () => {
    const { itens } = await listar(dono, { periodo: { tipo: 'intervalo', de: adicionarDias(HOJE, -10), ate: adicionarDias(HOJE, -1) } });
    expect(itens.map((t) => t.chave)).toEqual([`l-${id.atrasado}`]);
    const dia = await listar(dono, { periodo: { tipo: 'dia', data: adicionarDias(HOJE, 5) } });
    expect(dia.itens.map((t) => t.chave)).toEqual([`l-${id.pendente}`]);
  });

  it('tipo e status', async () => {
    expect((await listar(dono, { tipo: 'entradas' })).itens.every((t) => t.tipo === 'entrada')).toBe(true);
    expect((await listar(dono, { tipo: 'pagamentos' })).itens.map((t) => t.chave)).toEqual([`l-${id.pago}`]);
    expect((await listar(dono, { tipo: 'transferencias' })).itens).toHaveLength(1);
    expect((await listar(dono, { tipo: 'ajustes' })).itens).toHaveLength(1);
    expect((await listar(dono, { status: 'atrasados' })).itens.map((t) => t.chave)).toEqual([`l-${id.atrasado}`]);
    expect((await listar(dono, { status: 'previstos' })).itens.map((t) => t.titulo)).toEqual(['Pix previsto']);
    const confirmados = (await listar(dono, { status: 'confirmados' })).itens;
    expect(confirmados.every((t) => t.status === 'confirmado')).toBe(true);
    expect(confirmados).toHaveLength(3); // entrada, transferência, saldo inicial
    expect((await listar(dono, { tipo: 'pagamentos', status: 'atrasados' })).itens).toEqual([]);
  });

  it('empresa: filtro da tela e seletor do topo', async () => {
    const soB = (await listar(dono, { empresaId: empresaB })).itens;
    expect(soB.map((t) => t.tipo).sort()).toEqual(['conta-a-pagar', 'transferencia']);
    // A transferência vista pela empresa B continua completa (origem → destino).
    expect(soB.find((t) => t.tipo === 'transferencia')).toMatchObject({ conta: { id: id.contaA1 }, contaDestino: { id: id.contaB } });
    const topoA = (await listar(dono, {}, dono.empresaId)).itens;
    expect(topoA.some((t) => t.chave === `l-${id.semConta}`)).toBe(false);
    expect(topoA.some((t) => t.chave === `c-${id.compra}`)).toBe(true);
    expect((await listar(dono, { empresaId: empresaB }, dono.empresaId)).itens).toEqual([]);
  });

  it('conta e "sem conta definida"', async () => {
    const a1 = (await listar(dono, { contaId: id.contaA1 })).itens;
    expect(a1.every((t) => t.conta?.id === id.contaA1)).toBe(true);
    expect(a1.map((t) => t.tipo).sort()).toEqual(['ajuste', 'conta-a-pagar', 'conta-a-pagar', 'entrada', 'pagamento', 'transferencia']);
    expect((await listar(dono, { contaId: SEM_CONTA })).itens.map((t) => t.chave)).toEqual([`l-${id.semConta}`]);
  });

  it('categoria e fornecedor', async () => {
    const variada = (await listar(dono, { categoriaId: dono.categorias['Despesa variada'] })).itens;
    expect(variada.map((t) => t.chave)).toEqual([`c-${id.compra}`]);
    const porFornecedor = (await listar(dono, { fornecedorId: id.fornecedor })).itens;
    expect(porFornecedor.map((t) => t.chave).sort()).toEqual([`l-${id.pago}`, `l-${id.pendente}`].sort());
  });

  it('pesquisa: descrição, fornecedor sem acento e compras', async () => {
    expect((await listar(dono, { busca: 'vendas' })).itens.map((t) => t.titulo)).toEqual(['Vendas balcão']);
    expect((await listar(dono, { busca: 'eletrica avila' })).itens.map((t) => t.chave).sort()).toEqual([`l-${id.pago}`, `l-${id.pendente}`].sort());
    expect((await listar(dono, { busca: 'tecidos' })).itens.map((t) => t.chave)).toEqual([`c-${id.compra}`]);
    expect((await listar(dono, { busca: 'nada-disso' })).itens).toEqual([]);
  });
});

describe('segurança (RLS)', () => {
  it('outro usuário não vê nenhuma transação do dono, com qualquer filtro', async () => {
    expect((await listar(intruso)).itens).toEqual([]);
    expect((await listar(intruso, { periodo: { tipo: 'todos' } })).itens).toEqual([]);
    expect((await listar(intruso, { contaId: id.contaA1 })).itens).toEqual([]);
    expect((await listar(intruso, { empresaId: dono.empresaId })).itens).toEqual([]);
    expect((await listar(intruso, { fornecedorId: id.fornecedor })).itens).toEqual([]);
    expect((await listar(intruso, {}, dono.empresaId)).itens).toEqual([]);
    expect((await listar(intruso, { busca: 'vendas' })).itens).toEqual([]);
  });
});

describe('uso das categorias', () => {
  it('conta lançamentos, compras e cartões — só do próprio usuário', async () => {
    const uso = await listarUsoDasCategorias(cliente(dono));
    expect(uso.get(dono.categorias['Despesa variada'])).toMatchObject({ compras: 1 });
    expect(uso.get(dono.categorias['Despesa fixa'])).toMatchObject({ lancamentos: 1 });
    expect(uso.get(dono.categorias['Cartão de crédito'])).toMatchObject({ cartoes: 1 });
    const doIntruso = await listarUsoDasCategorias(cliente(intruso));
    expect(doIntruso.has(dono.categorias['Despesa variada'])).toBe(false);
    expect([...doIntruso.values()].every((u) => u.lancamentos + u.compras + u.cartoes === 0)).toBe(true);
  });
});
