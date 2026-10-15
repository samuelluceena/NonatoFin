import 'server-only';
/**
 * Consultas da importação de planilhas e dos lançamentos sem empresa.
 * Todas com o cliente da sessão do usuário (RLS aplicada).
 */
import type { DataISO } from '@/lib/domain/datas';
import type { LancamentoExistente } from '@/lib/domain/importacao';
import type { Lancamento } from '@/lib/domain/tipos';
import { statusDoBanco } from '@/lib/domain/status';
import { buscarTodasAsPaginas, falharConsulta } from '@/lib/supabase/consultas';
import { primeiroEmbutido, type Embutido } from '@/lib/supabase/embutidos';
import type { ClienteSupabase } from '@/lib/supabase/server';
import { filtroBusca } from '@/features/lancamentos/consultas';
import { COLUNAS_LANCAMENTO, paraLancamento, type LinhaLancamentoComFornecedor } from '@/features/lancamentos/mapeadores';
import type { FiltroSemEmpresa } from './esquemas';

// ------------------------------------------------------------- prévia --

/** Chaves de todas as linhas já importadas (e cujo lançamento ainda existe). */
export async function chavesJaImportadas(supabase: ClienteSupabase): Promise<Set<string>> {
  const linhas = await buscarTodasAsPaginas<{ chave: string }>(
    (de, ate) => supabase.from('importacao_itens').select('chave').order('id').range(de, ate),
    'ler importações anteriores',
  );
  return new Set(linhas.map((l) => l.chave));
}

/** Lançamentos do NonatoFin com vencimento no intervalo (para achar coincidências). */
export async function lancamentosNoIntervalo(supabase: ClienteSupabase, de: DataISO, ate: DataISO): Promise<LancamentoExistente[]> {
  type Linha = { id: string; vencimento: string; valor_centavos: number; descricao: string; status: string; fornecedor: Embutido<{ nome: string }> };
  const linhas = await buscarTodasAsPaginas<Linha>(
    (i, f) =>
      supabase
        .from('lancamentos')
        .select('id, vencimento, valor_centavos, descricao, status, fornecedor:fornecedores!lancamentos_fornecedor_fk(nome)')
        .gte('vencimento', de)
        .lte('vencimento', ate)
        .order('id')
        .range(i, f)
        .overrideTypes<Linha[], { merge: false }>(),
    'ler lançamentos existentes',
  );
  return linhas.map((l) => ({
    id: l.id,
    vencimento: l.vencimento,
    valorCentavos: Number(l.valor_centavos),
    descricao: l.descricao,
    fornecedor: primeiroEmbutido(l.fornecedor)?.nome ?? '',
    status: statusDoBanco(l.status),
  }));
}

export async function nomesDosCartoes(supabase: ClienteSupabase): Promise<string[]> {
  const { data, error } = await supabase.from('cartoes').select('nome');
  if (error) falharConsulta(error, 'listar cartões');
  return (data ?? []).map((c) => c.nome);
}

// ------------------------------------------------------------ histórico --

export interface Importacao {
  id: string;
  arquivoNome: string;
  periodoDe: DataISO;
  periodoAte: DataISO;
  linhasArquivo: number;
  importados: number;
  totalCentavos: number;
  status: 'concluida' | 'desfeita';
  removidos: number;
  criadoEm: string;
  desfeitaEm: string | null;
  /** Lançamentos do lote que ainda existem. */
  ativos: number;
  resumo: ResumoGravado;
}

/** Linha que ficou de fora do lote (separada para conferência ou recusada na prévia). */
export interface LinhaSeparada {
  numero: number;
  vencimento: DataISO | null;
  descricao: string;
  valorCentavos: number;
  contaOrigem: string;
  motivo: string;
  detalhe: string | null;
}

export interface ResumoGravado {
  motivos?: { motivo: string; rotulo: string; quantidade: number; totalCentavos: number }[];
  separadas?: LinhaSeparada[];
  incluidasNaConferencia?: number;
  valoresEstimados?: number;
}

type LinhaImportacaoBanco = {
  id: string;
  arquivo_nome: string;
  periodo_de: string;
  periodo_ate: string;
  linhas_arquivo: number;
  importados: number;
  total_centavos: number;
  status: string;
  removidos: number;
  criado_em: string;
  desfeita_em: string | null;
  resumo: unknown;
  importacao_itens: { count: number }[] | null;
};

const COLUNAS_IMPORTACAO =
  'id, arquivo_nome, periodo_de, periodo_ate, linhas_arquivo, importados, total_centavos, status, removidos, criado_em, desfeita_em, resumo, importacao_itens(count)';

function paraImportacao(l: LinhaImportacaoBanco): Importacao {
  return {
    id: l.id,
    arquivoNome: l.arquivo_nome,
    periodoDe: l.periodo_de,
    periodoAte: l.periodo_ate,
    linhasArquivo: l.linhas_arquivo,
    importados: l.importados,
    totalCentavos: Number(l.total_centavos),
    status: l.status === 'desfeita' ? 'desfeita' : 'concluida',
    removidos: l.removidos,
    criadoEm: l.criado_em,
    desfeitaEm: l.desfeita_em,
    ativos: l.importacao_itens?.[0]?.count ?? 0,
    resumo: (l.resumo && typeof l.resumo === 'object' ? l.resumo : {}) as ResumoGravado,
  };
}

export async function listarImportacoes(supabase: ClienteSupabase): Promise<Importacao[]> {
  const { data, error } = await supabase
    .from('importacoes')
    .select(COLUNAS_IMPORTACAO)
    .order('criado_em', { ascending: false })
    .limit(50)
    .overrideTypes<LinhaImportacaoBanco[], { merge: false }>();
  if (error) falharConsulta(error, 'listar importações');
  return (data ?? []).map(paraImportacao);
}

export async function obterImportacao(supabase: ClienteSupabase, id: string): Promise<Importacao | null> {
  const { data, error } = await supabase
    .from('importacoes')
    .select(COLUNAS_IMPORTACAO)
    .eq('id', id)
    .maybeSingle()
    .overrideTypes<LinhaImportacaoBanco, { merge: false }>();
  if (error) falharConsulta(error, 'obter importação');
  return data ? paraImportacao(data) : null;
}

export interface SituacaoDoLote {
  pendentes: number;
  pagos: number;
  semEmpresa: number;
  estimados: number;
}

/** Como estão hoje os lançamentos de um lote. */
export async function situacaoDoLote(supabase: ClienteSupabase, importacaoId: string): Promise<SituacaoDoLote> {
  type Linha = { valor_estimado: boolean; lancamento: Embutido<{ status: string; empresa_id: string | null }> };
  const linhas = await buscarTodasAsPaginas<Linha>(
    (de, ate) =>
      supabase
        .from('importacao_itens')
        .select('valor_estimado, lancamento:lancamentos!importacao_itens_lancamento_fk(status, empresa_id)')
        .eq('importacao_id', importacaoId)
        .order('id')
        .range(de, ate)
        .overrideTypes<Linha[], { merge: false }>(),
    'ler situação da importação',
  );
  const s: SituacaoDoLote = { pendentes: 0, pagos: 0, semEmpresa: 0, estimados: 0 };
  for (const l of linhas) {
    const lanc = primeiroEmbutido(l.lancamento);
    if (!lanc) continue;
    if (lanc.status === 'pago') s.pagos++;
    else s.pendentes++;
    if (!lanc.empresa_id) s.semEmpresa++;
    if (l.valor_estimado) s.estimados++;
  }
  return s;
}

// ------------------------------------------------- lançamentos sem empresa --

export interface OrigemImportacao {
  importacaoId: string;
  contaOrigem: string | null;
  valorEstimado: boolean;
}

export interface LancamentoSemEmpresa extends Lancamento {
  origem: OrigemImportacao | null;
}

type LinhaSemEmpresa = LinhaLancamentoComFornecedor & {
  importacao_itens: Embutido<{ importacao_id: string; conta_origem: string | null; valor_estimado: boolean }>;
};

/** Consulta dos lançamentos sem empresa com os filtros da tela (sem ordem/limite). */
function consultaSemEmpresa(supabase: ClienteSupabase, colunas: string, filtro: FiltroSemEmpresa, buscaOr: string | null) {
  const porOrigem = Boolean(filtro.contaOrigem || filtro.importacaoId || filtro.estimados);
  const item = `importacao_itens!importacao_itens_lancamento_fk${porOrigem ? '!inner' : ''}(importacao_id, conta_origem, valor_estimado)`;
  let q = supabase.from('lancamentos').select(`${colunas}, ${item}`).is('empresa_id', null);
  if (filtro.categoriaId) q = q.eq('categoria_id', filtro.categoriaId);
  if (filtro.contaOrigem) q = q.eq('importacao_itens.conta_origem', filtro.contaOrigem);
  if (filtro.importacaoId) q = q.eq('importacao_itens.importacao_id', filtro.importacaoId);
  if (filtro.estimados) q = q.eq('importacao_itens.valor_estimado', true);
  if (buscaOr) q = q.or(buscaOr);
  return q;
}

export interface ResultadoSemEmpresa {
  /** Primeiros lançamentos (para exibir). */
  lancamentos: LancamentoSemEmpresa[];
  /** Todos os que atendem ao filtro. */
  quantidade: number;
  totalCentavos: number;
}

export async function listarSemEmpresa(supabase: ClienteSupabase, filtro: FiltroSemEmpresa, limite: number): Promise<ResultadoSemEmpresa> {
  const buscaOr = await filtroBusca(supabase, filtro.busca);
  const [todos, primeiros] = await Promise.all([
    buscarTodasAsPaginas<{ id: string; valor_centavos: number }>(
      (de, ate) =>
        consultaSemEmpresa(supabase, 'id, valor_centavos', filtro, buscaOr)
          .order('id')
          .range(de, ate)
          .overrideTypes<{ id: string; valor_centavos: number }[], { merge: false }>(),
      'somar lançamentos sem empresa',
    ),
    consultaSemEmpresa(supabase, COLUNAS_LANCAMENTO, filtro, buscaOr)
      .order('vencimento', { ascending: true })
      .order('id', { ascending: true })
      .limit(limite)
      .overrideTypes<LinhaSemEmpresa[], { merge: false }>(),
  ]);
  if (primeiros.error) falharConsulta(primeiros.error, 'listar lançamentos sem empresa');
  return {
    lancamentos: (primeiros.data ?? []).map((l) => {
      const item = primeiroEmbutido(l.importacao_itens);
      return {
        ...paraLancamento(l),
        origem: item ? { importacaoId: item.importacao_id, contaOrigem: item.conta_origem, valorEstimado: item.valor_estimado } : null,
      };
    }),
    quantidade: todos.length,
    totalCentavos: todos.reduce((s, l) => s + Number(l.valor_centavos), 0),
  };
}

/** Ids de todos os lançamentos sem empresa que atendem ao filtro (ação "todos do filtro"). */
export async function idsSemEmpresa(supabase: ClienteSupabase, filtro: FiltroSemEmpresa): Promise<string[]> {
  const buscaOr = await filtroBusca(supabase, filtro.busca);
  const linhas = await buscarTodasAsPaginas<{ id: string }>(
    (de, ate) =>
      consultaSemEmpresa(supabase, 'id', filtro, buscaOr)
        .order('id')
        .range(de, ate)
        .overrideTypes<{ id: string }[], { merge: false }>(),
    'selecionar lançamentos sem empresa',
  );
  return linhas.map((l) => l.id);
}

export interface ContagemSemEmpresa {
  quantidade: number;
  totalCentavos: number;
}

/** Quantos lançamentos estão sem empresa (avisos em Boletos e Dashboard). */
export async function contarSemEmpresa(supabase: ClienteSupabase): Promise<ContagemSemEmpresa> {
  const linhas = await buscarTodasAsPaginas<{ valor_centavos: number }>(
    (de, ate) => supabase.from('lancamentos').select('valor_centavos').is('empresa_id', null).order('id').range(de, ate),
    'contar lançamentos sem empresa',
  );
  return { quantidade: linhas.length, totalCentavos: linhas.reduce((s, l) => s + Number(l.valor_centavos), 0) };
}

/** Contas de origem (da planilha) dos lançamentos ainda sem empresa, com quantidades. */
export async function contasDeOrigemSemEmpresa(supabase: ClienteSupabase): Promise<{ conta: string; quantidade: number }[]> {
  type Linha = { conta_origem: string | null };
  const linhas = await buscarTodasAsPaginas<Linha>(
    (de, ate) =>
      supabase
        .from('importacao_itens')
        .select('conta_origem, lancamentos!importacao_itens_lancamento_fk!inner(empresa_id)')
        .is('lancamentos.empresa_id', null)
        .order('id')
        .range(de, ate)
        .overrideTypes<Linha[], { merge: false }>(),
    'agrupar contas de origem',
  );
  const mapa = new Map<string, number>();
  for (const l of linhas) if (l.conta_origem) mapa.set(l.conta_origem, (mapa.get(l.conta_origem) ?? 0) + 1);
  return [...mapa].map(([conta, quantidade]) => ({ conta, quantidade })).sort((a, b) => b.quantidade - a.quantidade);
}

/** Categorias dos lançamentos ainda sem empresa, com quantidades. */
export async function categoriasSemEmpresa(supabase: ClienteSupabase): Promise<{ categoriaId: string; quantidade: number }[]> {
  const linhas = await buscarTodasAsPaginas<{ categoria_id: string }>(
    (de, ate) => supabase.from('lancamentos').select('categoria_id').is('empresa_id', null).order('id').range(de, ate),
    'agrupar categorias sem empresa',
  );
  const mapa = new Map<string, number>();
  for (const l of linhas) mapa.set(l.categoria_id, (mapa.get(l.categoria_id) ?? 0) + 1);
  return [...mapa].map(([categoriaId, quantidade]) => ({ categoriaId, quantidade })).sort((a, b) => b.quantidade - a.quantidade);
}
