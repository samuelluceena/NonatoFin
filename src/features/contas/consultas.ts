import 'server-only';
/**
 * Consultas de contas bancárias, saldos e extrato (leitura, sempre com RLS).
 */
import { cache } from 'react';
import { LIMITES } from '@/lib/config';
import { adicionarDias, dataNoFuso, type DataISO } from '@/lib/domain/datas';
import type { Centavos } from '@/lib/domain/dinheiro';
import type { EventoPrevisto } from '@/lib/domain/saldos';
import type { ContaBancaria, MovimentoConta } from '@/lib/domain/tipos';
import { falharConsulta } from '@/lib/supabase/consultas';
import { primeiroEmbutido, type Embutido } from '@/lib/supabase/embutidos';
import { criarClienteServidor, type ClienteSupabase } from '@/lib/supabase/server';

const COLUNAS_CONTA = 'id, apelido, banco, final, padrao, ativa, empresa:empresas!contas_empresa_fk(id, apelido)';

interface LinhaConta {
  id: string;
  apelido: string;
  banco: string;
  final: string | null;
  padrao: boolean;
  ativa: boolean;
  empresa: Embutido<{ id: string; apelido: string }>;
}

function paraConta(l: LinhaConta): ContaBancaria {
  return {
    id: l.id,
    apelido: l.apelido,
    banco: l.banco,
    final: l.final,
    padrao: l.padrao,
    ativa: l.ativa,
    empresa: primeiroEmbutido(l.empresa) ?? { id: '', apelido: '(sem empresa)' },
  };
}

export async function listarContas(
  supabase: ClienteSupabase,
  opcoes: { empresaId?: string; somenteAtivas?: boolean } = {},
): Promise<ContaBancaria[]> {
  let q = supabase.from('contas_bancarias').select(COLUNAS_CONTA).order('apelido_normalizado');
  if (opcoes.empresaId) q = q.eq('empresa_id', opcoes.empresaId);
  if (opcoes.somenteAtivas) q = q.eq('ativa', true);
  const { data, error } = await q.overrideTypes<LinhaConta[], { merge: false }>();
  if (error) falharConsulta(error, 'listar contas');
  return (data ?? []).map(paraConta);
}

/** Todas as contas do usuário, uma vez por requisição (formulários e seletores). */
export const listarTodasAsContas = cache(async (): Promise<ContaBancaria[]> => listarContas(await criarClienteServidor()));

export async function obterConta(supabase: ClienteSupabase, id: string): Promise<ContaBancaria | null> {
  const { data, error } = await supabase
    .from('contas_bancarias')
    .select(COLUNAS_CONTA)
    .eq('id', id)
    .maybeSingle()
    .overrideTypes<LinhaConta, { merge: false }>();
  if (error) falharConsulta(error, 'obter conta');
  return data ? paraConta(data) : null;
}

/** Saldo atual de cada conta (calculado no banco: movimentos − pagamentos). */
export async function saldosDasContas(supabase: ClienteSupabase): Promise<Map<string, Centavos>> {
  const { data, error } = await supabase.rpc('saldos_contas');
  if (error) falharConsulta(error, 'calcular saldos');
  return new Map((data ?? []).map((s) => [s.conta_id, Number(s.saldo_centavos)]));
}

export interface LinhaMovimento {
  id: string;
  conta_id: string;
  tipo: string;
  data: string;
  valor_centavos: number;
  saldo_informado: number | null;
  descricao: string | null;
  confirmado: boolean;
  transferencia_id: string | null;
  created_at: string;
}

export function paraMovimento(m: LinhaMovimento): MovimentoConta {
  const tipo = m.tipo === 'entrada' || m.tipo === 'transferencia' || m.tipo === 'conferencia' ? m.tipo : null;
  if (!tipo) throw new Error(`Tipo de movimento desconhecido: ${m.tipo}`);
  return {
    id: m.id,
    contaId: m.conta_id,
    tipo,
    data: m.data,
    valorCentavos: Number(m.valor_centavos),
    saldoInformado: m.saldo_informado === null ? null : Number(m.saldo_informado),
    descricao: m.descricao,
    confirmado: m.confirmado,
    transferenciaId: m.transferencia_id,
    createdAt: m.created_at,
  };
}

export const COLUNAS_MOVIMENTO =
  'id, conta_id, tipo, data, valor_centavos, saldo_informado, descricao, confirmado, transferencia_id, created_at';

/** Movimentos da conta, do mais recente para o mais antigo. */
export async function listarMovimentos(supabase: ClienteSupabase, contaId: string, limite = 200): Promise<MovimentoConta[]> {
  const { data, error } = await supabase
    .from('movimentos_conta')
    .select(COLUNAS_MOVIMENTO)
    .eq('conta_id', contaId)
    .order('data', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limite);
  if (error) falharConsulta(error, 'listar movimentos');
  return (data ?? []).map(paraMovimento);
}

/** A conta já foi conferida hoje? (usado no pedido diário de saldos) */
export async function contasConferidasEm(supabase: ClienteSupabase, data: DataISO): Promise<Set<string>> {
  const { data: linhas, error } = await supabase.from('movimentos_conta').select('conta_id').eq('tipo', 'conferencia').eq('data', data);
  if (error) falharConsulta(error, 'verificar conferências');
  return new Set((linhas ?? []).map((l) => l.conta_id));
}

export interface PagamentoDaConta {
  id: string;
  descricao: string;
  fornecedor: string;
  valorCentavos: Centavos;
  data: DataISO;
}

/** Lançamentos pagos pela conta (aparecem como saídas no extrato). */
export async function listarPagamentosDaConta(supabase: ClienteSupabase, contaId: string, limite = 200): Promise<PagamentoDaConta[]> {
  const { data, error } = await supabase
    .from('lancamentos')
    .select('id, descricao, valor_centavos, pago_em, fornecedor:fornecedores!lancamentos_fornecedor_fk(nome)')
    .eq('conta_id', contaId)
    .eq('status', 'pago')
    .order('pago_em', { ascending: false })
    .limit(limite)
    .overrideTypes<
      { id: string; descricao: string; valor_centavos: number; pago_em: string | null; fornecedor: Embutido<{ nome: string }> }[],
      { merge: false }
    >();
  if (error) falharConsulta(error, 'listar pagamentos da conta');
  return (data ?? []).map((l) => ({
    id: l.id,
    descricao: l.descricao,
    fornecedor: primeiroEmbutido(l.fornecedor)?.nome ?? '',
    valorCentavos: Number(l.valor_centavos),
    data: l.pago_em ? dataNoFuso(l.pago_em) : '',
  }));
}

/**
 * O que está previsto para a conta até `ate`: contas pendentes (inclusive
 * vencidas) e entradas previstas. Base da previsão de saldo.
 */
export async function eventosPrevistosDaConta(
  supabase: ClienteSupabase,
  contaId: string,
  hoje: DataISO,
  ate: DataISO = adicionarDias(hoje, LIMITES.diasPrevisaoSaldo),
): Promise<(EventoPrevisto & { lancamentoId?: string; movimentoId?: string })[]> {
  const [pendentes, entradas] = await Promise.all([
    supabase
      .from('lancamentos')
      .select('id, descricao, valor_centavos, vencimento, fornecedor:fornecedores!lancamentos_fornecedor_fk(nome)')
      .eq('conta_id', contaId)
      .eq('status', 'pendente')
      .lte('vencimento', ate)
      .order('vencimento')
      .limit(LIMITES.itensListaMax)
      .overrideTypes<
        { id: string; descricao: string; valor_centavos: number; vencimento: string; fornecedor: Embutido<{ nome: string }> }[],
        { merge: false }
      >(),
    supabase
      .from('movimentos_conta')
      .select('id, descricao, valor_centavos, data')
      .eq('conta_id', contaId)
      .eq('tipo', 'entrada')
      .eq('confirmado', false)
      .gte('data', hoje)
      .lte('data', ate)
      .order('data'),
  ]);
  if (pendentes.error) falharConsulta(pendentes.error, 'listar contas a pagar da conta');
  if (entradas.error) falharConsulta(entradas.error, 'listar entradas previstas');
  return [
    ...(pendentes.data ?? []).map((l) => ({
      tipo: 'saida' as const,
      data: l.vencimento,
      valorCentavos: Number(l.valor_centavos),
      descricao: [primeiroEmbutido(l.fornecedor)?.nome, l.descricao].filter(Boolean).join(' · '),
      lancamentoId: l.id,
    })),
    ...(entradas.data ?? []).map((m) => ({
      tipo: 'entrada' as const,
      data: m.data,
      valorCentavos: Number(m.valor_centavos),
      descricao: m.descricao ?? 'Entrada prevista',
      movimentoId: m.id,
    })),
  ];
}

/** Entradas previstas que já passaram da data e não foram confirmadas. */
export async function entradasPrevistasVencidas(supabase: ClienteSupabase, hoje: DataISO): Promise<MovimentoConta[]> {
  const { data, error } = await supabase
    .from('movimentos_conta')
    .select(COLUNAS_MOVIMENTO)
    .eq('tipo', 'entrada')
    .eq('confirmado', false)
    .lt('data', hoje)
    .order('data');
  if (error) falharConsulta(error, 'listar entradas previstas vencidas');
  return (data ?? []).map(paraMovimento);
}

/** Por conta: total das contas pendentes que vencem até `ate` (inclusive vencidas). */
export async function saidasAteDataPorConta(supabase: ClienteSupabase, ate: DataISO, empresaId?: string): Promise<{
  porConta: Map<string, Centavos>;
  semContaCentavos: Centavos;
  semContaQuantidade: number;
}> {
  let q = supabase.from('lancamentos').select('conta_id, valor_centavos').eq('status', 'pendente').lte('vencimento', ate).limit(5000);
  if (empresaId) q = q.eq('empresa_id', empresaId);
  const { data, error } = await q;
  if (error) falharConsulta(error, 'somar saídas por conta');
  const porConta = new Map<string, Centavos>();
  let semContaCentavos = 0;
  let semContaQuantidade = 0;
  for (const l of data ?? []) {
    const valor = Number(l.valor_centavos);
    if (l.conta_id) porConta.set(l.conta_id, (porConta.get(l.conta_id) ?? 0) + valor);
    else {
      semContaCentavos += valor;
      semContaQuantidade += 1;
    }
  }
  return { porConta, semContaCentavos, semContaQuantidade };
}

/** Quantos lançamentos em aberto de cada empresa estão sem conta (faturas não contam). */
export async function pendentesSemContaPorEmpresa(supabase: ClienteSupabase): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from('lancamentos')
    .select('empresa_id')
    .eq('status', 'pendente')
    .is('conta_id', null)
    .is('cartao_id', null)
    .limit(5000);
  if (error) falharConsulta(error, 'contar lançamentos sem conta');
  const mapa = new Map<string, number>();
  for (const l of data ?? []) mapa.set(l.empresa_id, (mapa.get(l.empresa_id) ?? 0) + 1);
  return mapa;
}

/**
 * Contas ativas ainda não conferidas hoje (uma vez por requisição).
 * Usado pelo layout do app para exigir a conferência diária dos saldos.
 */
export const contasAConferirHoje = cache(async (): Promise<string[]> => {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc('contas_a_conferir_hoje');
  if (error) falharConsulta(error, 'verificar conferência do dia');
  return data ?? [];
});
