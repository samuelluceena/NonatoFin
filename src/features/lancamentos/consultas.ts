import 'server-only';
/**
 * Consultas de lançamentos (leitura). Todas usam o cliente com a sessão do
 * usuário, portanto a RLS do banco é sempre aplicada.
 */
import { LIMITES } from '@/lib/config';
import { adicionarDias, instanteInicioDoDia, primeiroDiaDaChave, ultimoDiaDaChave, type ChaveMes, type DataISO } from '@/lib/domain/datas';
import { SEM_CONTA, criterioDosFiltros, sanitizarBusca, type CriterioBusca, type FiltrosLista } from '@/lib/domain/filtros';
import { normalizarNome } from '@/lib/domain/fornecedores';
import type { Lancamento, LancamentoResumo, StatusLancamento } from '@/lib/domain/tipos';
import { buscarTodasAsPaginas, falharConsulta } from '@/lib/supabase/consultas';
import type { ClienteSupabase } from '@/lib/supabase/server';
import {
  COLUNAS_LANCAMENTO,
  COLUNAS_RESUMO,
  paraLancamento,
  paraResumo,
  type LinhaLancamentoComFornecedor,
  type LinhaResumo,
} from './mapeadores';

/** IDs de fornecedores cujo nome contém o texto (sem acento/maiúsculas). */
async function idsFornecedoresPorNome(supabase: ClienteSupabase, texto: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('fornecedores')
    .select('id')
    .ilike('nome_normalizado', `%${normalizarNome(texto)}%`)
    .limit(200);
  if (error) falharConsulta(error, 'buscar fornecedores');
  return (data ?? []).map((f) => f.id);
}

/** Monta o filtro "or" da busca: fornecedor, nome/descrição ou observação. */
export async function filtroBusca(supabase: ClienteSupabase, buscaBruta: string | undefined): Promise<string | null> {
  const busca = sanitizarBusca(buscaBruta);
  if (!busca) return null;
  const ids = await idsFornecedoresPorNome(supabase, busca);
  const partes = [`descricao.ilike."*${busca}*"`, `observacao.ilike."*${busca}*"`];
  if (ids.length > 0) partes.push(`fornecedor_id.in.(${ids.join(',')})`);
  return partes.join(',');
}

export interface OpcoesListagem {
  criterio: CriterioBusca;
  /** Empresa selecionada (undefined = todas). */
  empresaId?: string;
  categoriaId?: string;
  fornecedorId?: string;
  /** Id da conta ou SEM_CONTA (lançamentos sem conta definida). */
  contaId?: string;
  busca?: string;
  limite?: number;
}

/** Filtros da tela (URL) → opções de consulta. Usado pela lista e pela exportação. */
export function opcoesDosFiltros(filtros: FiltrosLista, hoje: DataISO, empresaId?: string): OpcoesListagem {
  return {
    criterio: criterioDosFiltros(filtros, hoje),
    empresaId,
    categoriaId: filtros.categoriaId || undefined,
    fornecedorId: filtros.fornecedorId || undefined,
    contaId: filtros.contaId || undefined,
    busca: filtros.busca,
  };
}

export interface ResultadoListagem {
  lancamentos: Lancamento[];
  truncado: boolean;
}

/**
 * Consulta de lançamentos com os filtros aplicados (sem ordem nem limite).
 * Um só lugar monta os filtros: a lista e a exportação dão sempre o mesmo resultado.
 * `buscaOr` = resultado de `filtroBusca` (resolvido antes, uma vez só).
 */
export function consultaFiltrada(supabase: ClienteSupabase, opcoes: OpcoesListagem, buscaOr: string | null) {
  let consulta = supabase.from('lancamentos').select(COLUNAS_LANCAMENTO);
  const { criterio } = opcoes;
  if (criterio.status) consulta = consulta.eq('status', criterio.status);
  if (criterio.vencimentoDe) consulta = consulta.gte('vencimento', criterio.vencimentoDe);
  if (criterio.vencimentoAte) consulta = consulta.lte('vencimento', criterio.vencimentoAte);
  if (opcoes.fornecedorId) consulta = consulta.eq('fornecedor_id', opcoes.fornecedorId);
  if (opcoes.empresaId) consulta = consulta.eq('empresa_id', opcoes.empresaId);
  if (opcoes.categoriaId) consulta = consulta.eq('categoria_id', opcoes.categoriaId);
  if (opcoes.contaId === SEM_CONTA) consulta = consulta.is('conta_id', null);
  else if (opcoes.contaId) consulta = consulta.eq('conta_id', opcoes.contaId);
  if (buscaOr) consulta = consulta.or(buscaOr);
  return consulta;
}

export async function listarLancamentos(supabase: ClienteSupabase, opcoes: OpcoesListagem): Promise<ResultadoListagem> {
  const limite = opcoes.limite ?? LIMITES.itensListaMax;
  const buscaOr = await filtroBusca(supabase, opcoes.busca);
  const { data, error } = await consultaFiltrada(supabase, opcoes, buscaOr)
    .order('vencimento', { ascending: opcoes.criterio.ordem === 'asc' })
    .order('created_at', { ascending: true })
    .limit(limite + 1)
    .overrideTypes<LinhaLancamentoComFornecedor[], { merge: false }>();
  if (error) falharConsulta(error, 'listar boletos');
  const linhas = data ?? [];
  return { lancamentos: linhas.slice(0, limite).map(paraLancamento), truncado: linhas.length > limite };
}

/** Todos os lançamentos que atendem aos filtros, sem limite (exportação da lista). */
export async function listarLancamentosFiltrados(supabase: ClienteSupabase, opcoes: OpcoesListagem): Promise<Lancamento[]> {
  const buscaOr = await filtroBusca(supabase, opcoes.busca);
  const linhas = await buscarTodasAsPaginas<LinhaLancamentoComFornecedor>(
    (de, ate) =>
      consultaFiltrada(supabase, opcoes, buscaOr)
        .order('vencimento', { ascending: opcoes.criterio.ordem === 'asc' })
        .order('id', { ascending: true })
        .range(de, ate)
        .overrideTypes<LinhaLancamentoComFornecedor[], { merge: false }>(),
    'exportar boletos filtrados',
  );
  return linhas.map(paraLancamento);
}

export interface LancamentosTelaInicial {
  hoje: Lancamento[];
  atrasados: Lancamento[];
  proximos: Lancamento[];
}

/** Hoje (todos os status), atrasados e próximos vencimentos em aberto. */
export async function listarLancamentosTelaInicial(
  supabase: ClienteSupabase,
  hoje: DataISO,
  empresaId?: string,
): Promise<LancamentosTelaInicial> {
  const limiteProximos = adicionarDias(hoje, LIMITES.diasProximosVencimentos);
  let consulta = supabase.from('lancamentos').select(COLUNAS_LANCAMENTO);
  if (empresaId) consulta = consulta.eq('empresa_id', empresaId);
  const { data, error } = await consulta
    .or(`vencimento.eq.${hoje},and(status.eq.pendente,vencimento.lte.${limiteProximos})`)
    .order('vencimento', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(LIMITES.itensListaMax)
    .overrideTypes<LinhaLancamentoComFornecedor[], { merge: false }>();
  if (error) falharConsulta(error, 'carregar tela inicial');

  const lancamentos = (data ?? []).map(paraLancamento);
  return {
    // Pendentes primeiro; os já pagos hoje aparecem depois.
    hoje: lancamentos
      .filter((b) => b.vencimento === hoje)
      .sort((a, b) => Number(a.status === 'pago') - Number(b.status === 'pago')),
    atrasados: lancamentos.filter((b) => b.status === 'pendente' && b.vencimento < hoje),
    proximos: lancamentos.filter((b) => b.status === 'pendente' && b.vencimento > hoje),
  };
}

export async function obterLancamento(supabase: ClienteSupabase, id: string): Promise<Lancamento | null> {
  const { data, error } = await supabase
    .from('lancamentos')
    .select(COLUNAS_LANCAMENTO)
    .eq('id', id)
    .maybeSingle()
    .overrideTypes<LinhaLancamentoComFornecedor, { merge: false }>();
  if (error) falharConsulta(error, 'obter boleto');
  return data ? paraLancamento(data) : null;
}

export async function listarSerie(supabase: ClienteSupabase, serieId: string): Promise<Lancamento[]> {
  const { data, error } = await supabase
    .from('lancamentos')
    .select(COLUNAS_LANCAMENTO)
    .eq('serie_id', serieId)
    .order('parcela', { ascending: true })
    .overrideTypes<LinhaLancamentoComFornecedor[], { merge: false }>();
  if (error) falharConsulta(error, 'listar série');
  return (data ?? []).map(paraLancamento);
}

/** Todos os boletos em formato enxuto (dashboard/relatórios). */
export async function listarResumos(supabase: ClienteSupabase, empresaId?: string): Promise<LancamentoResumo[]> {
  const linhas = await buscarTodasAsPaginas<LinhaResumo>((de, ate) => {
    let consulta = supabase.from('lancamentos').select(COLUNAS_RESUMO);
    if (empresaId) consulta = consulta.eq('empresa_id', empresaId);
    return consulta.order('vencimento', { ascending: true }).order('id', { ascending: true }).range(de, ate);
  }, 'carregar resumos');
  return linhas.map(paraResumo);
}

/** Todos os lançamentos completos (exportação completa, em Configurações). */
export async function listarTodosLancamentos(supabase: ClienteSupabase, empresaId?: string): Promise<Lancamento[]> {
  return listarLancamentosFiltrados(supabase, { criterio: { ordem: 'asc' }, empresaId });
}

export interface OpcoesHistorico {
  empresaId?: string;
  fornecedorId?: string;
  /** Período pela DATA DO PAGAMENTO (fuso do app). */
  pagoDe?: DataISO;
  pagoAte?: DataISO;
  busca?: string;
}

export async function listarHistorico(supabase: ClienteSupabase, opcoes: OpcoesHistorico): Promise<ResultadoListagem> {
  const limite = LIMITES.itensListaMax;
  let consulta = supabase.from('lancamentos').select(COLUNAS_LANCAMENTO).eq('status', 'pago');
  if (opcoes.empresaId) consulta = consulta.eq('empresa_id', opcoes.empresaId);
  if (opcoes.fornecedorId) consulta = consulta.eq('fornecedor_id', opcoes.fornecedorId);
  if (opcoes.pagoDe) consulta = consulta.gte('pago_em', instanteInicioDoDia(opcoes.pagoDe));
  if (opcoes.pagoAte) consulta = consulta.lt('pago_em', instanteInicioDoDia(adicionarDias(opcoes.pagoAte, 1)));
  const busca = await filtroBusca(supabase, opcoes.busca);
  if (busca) consulta = consulta.or(busca);

  const { data, error } = await consulta
    .order('pago_em', { ascending: false })
    .limit(limite + 1)
    .overrideTypes<LinhaLancamentoComFornecedor[], { merge: false }>();
  if (error) falharConsulta(error, 'carregar histórico');
  const linhas = data ?? [];
  return { lancamentos: linhas.slice(0, limite).map(paraLancamento), truncado: linhas.length > limite };
}

export async function listarLancamentosDoMes(supabase: ClienteSupabase, mes: ChaveMes, empresaId?: string): Promise<Lancamento[]> {
  const linhas = await buscarTodasAsPaginas<LinhaLancamentoComFornecedor>(
    (de, ate) =>
      (empresaId ? supabase.from('lancamentos').select(COLUNAS_LANCAMENTO).eq('empresa_id', empresaId) : supabase.from('lancamentos').select(COLUNAS_LANCAMENTO))
        .gte('vencimento', primeiroDiaDaChave(mes))
        .lte('vencimento', ultimoDiaDaChave(mes))
        .order('vencimento', { ascending: true })
        .order('id', { ascending: true })
        .range(de, ate)
        .overrideTypes<LinhaLancamentoComFornecedor[], { merge: false }>(),
    'carregar mês',
  );
  return linhas.map(paraLancamento);
}

export interface OpcoesFornecedor {
  empresaId?: string;
  status?: StatusLancamento;
  vencimentoDe?: DataISO;
  vencimentoAte?: DataISO;
}

export async function listarLancamentosDoFornecedor(
  supabase: ClienteSupabase,
  fornecedorId: string,
  hoje: DataISO,
  opcoes: OpcoesFornecedor,
): Promise<Lancamento[]> {
  const linhas = await buscarTodasAsPaginas<LinhaLancamentoComFornecedor>((de, ate) => {
    let consulta = supabase.from('lancamentos').select(COLUNAS_LANCAMENTO).eq('fornecedor_id', fornecedorId);
    if (opcoes.empresaId) consulta = consulta.eq('empresa_id', opcoes.empresaId);
    if (opcoes.status === 'pago') consulta = consulta.eq('status', 'pago');
    if (opcoes.status === 'pendente') consulta = consulta.eq('status', 'pendente').gte('vencimento', hoje);
    if (opcoes.status === 'atrasado') consulta = consulta.eq('status', 'pendente').lt('vencimento', hoje);
    if (opcoes.vencimentoDe) consulta = consulta.gte('vencimento', opcoes.vencimentoDe);
    if (opcoes.vencimentoAte) consulta = consulta.lte('vencimento', opcoes.vencimentoAte);
    return consulta
      .order('vencimento', { ascending: true })
      .order('id', { ascending: true })
      .range(de, ate)
      .overrideTypes<LinhaLancamentoComFornecedor[], { merge: false }>();
  }, 'carregar boletos do fornecedor');
  return linhas.map(paraLancamento);
}
