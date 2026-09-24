/**
 * Consultas reais do app (features/lancamentos/consultas.ts) contra o banco:
 * filtros, pesquisa (incluindo contas futuras) e cálculos do dashboard com
 * um cenário conhecido.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  listarLancamentos,
  listarLancamentosFiltrados,
  opcoesDosFiltros,
  listarLancamentosDoFornecedor,
  listarLancamentosTelaInicial,
  listarHistorico,
  listarResumos,
  listarTodosLancamentos,
} from '@/features/lancamentos/consultas';
import { listarFornecedores } from '@/features/fornecedores/consultas';
import { adicionarDias, adicionarMeses, hojeISO } from '@/lib/domain/datas';
import {
  FILTROS_PADRAO,
  PERIODOS_RAPIDOS,
  SEM_CONTA,
  STATUS_FILTRO,
  atendeCriterio,
  criterioDosFiltros,
  type FiltrosLista,
  type Periodo,
} from '@/lib/domain/filtros';
import { calcularIndicadores, resumoPorFornecedor } from '@/lib/domain/indicadores';
import type { ClienteSupabase } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/tipos-banco';
import { criarFornecedor, criarUsuarioTeste, removerUsuario, vinculo, type UsuarioTeste } from './auxiliares';

let u: UsuarioTeste;
let supabase: ClienteSupabase;
const HOJE = hojeISO();
const ids: Record<string, string> = {};

beforeAll(async () => {
  u = await criarUsuarioTeste();
  supabase = u.cliente as unknown as ClienteSupabase;
  const via = await criarFornecedor(u.cliente, 'Via da Móda');
  const enel = await criarFornecedor(u.cliente, 'Enel');
  type Insercao = Database['public']['Tables']['lancamentos']['Insert'] & { chave: string };
  const itens: Insercao[] = [
    { chave: 'atrasado', ...vinculo(u), fornecedor_id: via, descricao: 'Parcela antiga', valor_centavos: 299500, vencimento: adicionarDias(HOJE, -10) },
    { chave: 'hoje', ...vinculo(u), fornecedor_id: enel, descricao: 'Energia Loja Iguatu', valor_centavos: 12345, vencimento: HOJE },
    { chave: 'amanha', ...vinculo(u), fornecedor_id: via, descricao: 'Compra coleção', valor_centavos: 100050, vencimento: adicionarDias(HOJE, 1) },
    { chave: 'futuro', ...vinculo(u), fornecedor_id: via, descricao: 'Coleção de verão', valor_centavos: 500000, vencimento: adicionarMeses(HOJE, 6), observacao: 'negociado com Maria' },
    { chave: 'proximoMes', ...vinculo(u), fornecedor_id: enel, descricao: 'Energia depósito', valor_centavos: 7000, vencimento: adicionarMeses(HOJE, 1) },
  ];
  for (const { chave, ...linha } of itens) {
    const { data, error } = await u.cliente.from('lancamentos').insert(linha).select('id').single();
    if (error) throw error;
    ids[chave] = data.id;
  }
  // um pago hoje
  const { data } = await u.cliente
    .from('lancamentos')
    .insert({ ...vinculo(u), fornecedor_id: enel, descricao: 'Tarifa paga', valor_centavos: 990, vencimento: adicionarDias(HOJE, -2) })
    .select('id')
    .single();
  ids.pago = data!.id;
  await u.cliente.rpc('definir_pagamento', { p_id: ids.pago, p_pago: true });
});

afterAll(async () => {
  await removerUsuario(u.id);
});

describe('filtros: banco e regra em memória produzem o mesmo resultado', () => {
  // Todas as combinações período × status, mais os períodos personalizados.
  const periodos: Periodo[] = [
    ...PERIODOS_RAPIDOS.map((p) => ({ tipo: p.valor })),
    { tipo: 'mes-escolhido', mes: adicionarMeses(HOJE, 1).slice(0, 7) },
    { tipo: 'dia', data: adicionarDias(HOJE, 1) },
    { tipo: 'intervalo', de: adicionarDias(HOJE, -10), ate: HOJE },
    { tipo: 'intervalo', de: HOJE, ate: '' },
  ];
  const combinacoes = periodos.flatMap((periodo) => STATUS_FILTRO.map((s) => ({ periodo, status: s.valor })));

  it.each(combinacoes)('período $periodo.tipo × status $status', async (f) => {
    const criterio = criterioDosFiltros(f, HOJE);
    const { lancamentos } = await listarLancamentos(supabase, { criterio });
    const todos = await listarTodosLancamentos(supabase);
    const esperado = todos.filter((b) => atendeCriterio(b, criterio)).map((b) => b.id).sort();
    expect(lancamentos.map((b) => b.id).sort()).toEqual(esperado);
  });

  it('exportação filtrada traz exatamente o que a lista mostra', async () => {
    const filtros: FiltrosLista = { ...FILTROS_PADRAO, periodo: { tipo: 'todos' }, status: 'em-aberto', busca: 'energia' };
    const opcoes = opcoesDosFiltros(filtros, HOJE);
    const { lancamentos } = await listarLancamentos(supabase, opcoes);
    const exportados = await listarLancamentosFiltrados(supabase, opcoes);
    expect(exportados.map((b) => b.id)).toEqual(lancamentos.map((b) => b.id));
    expect(exportados.map((b) => b.id).sort()).toEqual([ids.hoje, ids.proximoMes].sort());
  });

  it('filtro por conta e "sem conta definida"', async () => {
    const { data: conta, error } = await u.cliente
      .from('contas_bancarias')
      .insert({ empresa_id: u.empresaId, apelido: 'Conta filtro', banco: 'Banco X' })
      .select('id')
      .single();
    if (error) throw error;
    await u.cliente.from('lancamentos').update({ conta_id: conta.id }).eq('id', ids.amanha);
    const todas = { ...FILTROS_PADRAO, periodo: { tipo: 'todos' } } as const;
    const daConta = await listarLancamentosFiltrados(supabase, opcoesDosFiltros({ ...todas, contaId: conta.id }, HOJE));
    expect(daConta.map((b) => b.id)).toEqual([ids.amanha]);
    const semConta = await listarLancamentosFiltrados(supabase, opcoesDosFiltros({ ...todas, contaId: SEM_CONTA }, HOJE));
    const total = await listarTodosLancamentos(supabase);
    expect(semConta).toHaveLength(total.length - 1);
    expect(semConta.some((b) => b.id === ids.amanha)).toBe(false);
    await u.cliente.from('lancamentos').update({ conta_id: null }).eq('id', ids.amanha);
  });

  it('filtro por fornecedor', async () => {
    const enel = (await listarFornecedores(supabase)).find((f) => f.nome === 'Enel')!;
    const { lancamentos } = await listarLancamentos(supabase, { criterio: { ordem: 'asc' }, fornecedorId: enel.id });
    expect(lancamentos).toHaveLength(3);
    expect(lancamentos.every((b) => b.fornecedor.nome === 'Enel')).toBe(true);
  });
});

describe('pesquisa', () => {
  const buscar = (busca: string) => listarLancamentos(supabase, { criterio: { ordem: 'asc' }, busca }).then((r) => r.lancamentos);

  it('por nome do fornecedor, sem diferenciar maiúsculas e acentos, inclui contas futuras', async () => {
    const r = await buscar('VIA DA MODA');
    expect(r.map((b) => b.id).sort()).toEqual([ids.atrasado, ids.amanha, ids.futuro].sort());
  });

  it('por descrição e por observação', async () => {
    expect((await buscar('iguatu')).map((b) => b.id)).toEqual([ids.hoje]);
    expect((await buscar('maria')).map((b) => b.id)).toEqual([ids.futuro]);
  });

  it('caracteres especiais não quebram a consulta', async () => {
    await expect(buscar('a,b).or(x*%')).resolves.toBeDefined();
  });
});

describe('tela inicial', () => {
  it('separa hoje, atrasados e próximos', async () => {
    const r = await listarLancamentosTelaInicial(supabase, HOJE);
    expect(r.hoje.map((b) => b.id)).toEqual([ids.hoje]);
    expect(r.atrasados.map((b) => b.id)).toEqual([ids.atrasado]);
    expect(r.proximos.map((b) => b.id)).toContain(ids.amanha);
    expect(r.proximos.map((b) => b.id)).not.toContain(ids.futuro);
  });
});

describe('dashboard com dados reais do banco', () => {
  it('indicadores batem exatamente com o cenário', async () => {
    const ind = calcularIndicadores(await listarResumos(supabase), HOJE);
    expect(ind.hoje).toEqual({ quantidade: 1, totalCentavos: 12345 });
    expect(ind.amanha).toEqual({ quantidade: 1, totalCentavos: 100050 });
    expect(ind.atrasados).toEqual({ quantidade: 1, totalCentavos: 299500 });
    expect(ind.futuro).toEqual({ quantidade: 4, totalCentavos: 12345 + 100050 + 500000 + 7000 });
    expect(ind.proximoMes.totalCentavos).toBe(7000 + (adicionarDias(HOJE, 1).slice(0, 7) !== HOJE.slice(0, 7) ? 100050 : 0));
    expect(ind.pagoNoMes).toEqual({ quantidade: 1, totalCentavos: 990 });
  });

  it('totais por fornecedor', async () => {
    const res = resumoPorFornecedor(await listarResumos(supabase), await listarFornecedores(supabase), HOJE);
    const via = res.find((r) => r.fornecedor.nome === 'Via da Móda')!;
    expect(via).toMatchObject({
      quantidadeTotal: 3,
      quantidadeAtrasada: 1,
      quantidadePendente: 2,
      totalCentavos: 299500 + 100050 + 500000,
      atrasadoCentavos: 299500,
    });
    const atrasadosVia = await listarLancamentosDoFornecedor(supabase, via.fornecedor.id, HOJE, { status: 'atrasado' });
    expect(atrasadosVia.map((b) => b.id)).toEqual([ids.atrasado]);
  });

  it('histórico traz somente pagos, filtrando pela data do pagamento', async () => {
    const r = await listarHistorico(supabase, { pagoDe: HOJE, pagoAte: HOJE });
    expect(r.lancamentos.map((b) => b.id)).toEqual([ids.pago]);
    const ontem = await listarHistorico(supabase, { pagoAte: adicionarDias(HOJE, -1) });
    expect(ontem.lancamentos).toEqual([]);
  });
});
