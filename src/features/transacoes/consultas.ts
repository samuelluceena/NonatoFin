import 'server-only';
/**
 * Transações (leitura). Não existe tabela própria: a lista é composta a
 * partir de lançamentos, movimentos de conta e compras no cartão, sempre com
 * o cliente do usuário (RLS aplicada em todas as consultas).
 *
 * Cada fonte é buscada já filtrada e ordenada no banco (mais recente
 * primeiro), limitada a LIMITES.itensListaMax; a mescla cronológica e os
 * totais ficam em lib/domain/transacoes.ts. Número fixo de consultas por
 * página (sem N+1): até 4 fontes + 1 para completar transferências + 1 para a
 * busca por fornecedor.
 */
import { LIMITES } from '@/lib/config';
import { adicionarDias, instanteInicioDoDia, type DataISO } from '@/lib/domain/datas';
import { SEM_CONTA, SEM_EMPRESA, sanitizarBusca } from '@/lib/domain/filtros';
import {
  empresaDaConsulta,
  mesclarFontes,
  planoDasTransacoes,
  transacaoDaCompra,
  transacaoDaTransferencia,
  transacaoDoLancamento,
  transacaoDoMovimento,
  type ContaDoMovimento,
  type FiltrosTransacoes,
  type FonteTransacoes,
  type PlanoTransacoes,
} from '@/lib/domain/transacoes';
import { falharConsulta } from '@/lib/supabase/consultas';
import { primeiroEmbutido, type Embutido } from '@/lib/supabase/embutidos';
import type { ClienteSupabase } from '@/lib/supabase/server';
import { COLUNAS_COMPRA, paraCompra, type LinhaCompraEmbutida } from '@/features/cartoes/consultas';
import { COLUNAS_MOVIMENTO, paraMovimento, type LinhaMovimento } from '@/features/contas/consultas';
import { consultaFiltrada, filtroBusca, type OpcoesListagem } from '@/features/lancamentos/consultas';
import { paraLancamento, type LinhaLancamentoComFornecedor } from '@/features/lancamentos/mapeadores';

const LIMITE_FONTE = LIMITES.itensListaMax;

interface Contexto {
  supabase: ClienteSupabase;
  plano: PlanoTransacoes;
  filtros: FiltrosTransacoes;
  empresaId?: string;
  busca: string;
  hoje: DataISO;
}

/** Linhas → fonte: separa o item extra (que só indica "tem mais"). */
function fonte<T>(linhas: T[] | null, montar: (linhas: T[]) => FonteTransacoes['itens']): FonteTransacoes {
  const todas = linhas ?? [];
  return { itens: montar(todas.slice(0, LIMITE_FONTE)), truncado: todas.length > LIMITE_FONTE };
}

// -------------------------------------------------------------- lançamentos --

function opcoesLancamentos(c: Contexto, criterio: OpcoesListagem['criterio']): OpcoesListagem {
  return {
    criterio,
    empresaId: c.empresaId === SEM_EMPRESA ? undefined : c.empresaId,
    semEmpresa: c.empresaId === SEM_EMPRESA || undefined,
    categoriaId: c.filtros.categoriaId || undefined,
    fornecedorId: c.filtros.fornecedorId || undefined,
    contaId: c.filtros.contaId || undefined,
  };
}

/** Contas a pagar em aberto (obrigações), pelo vencimento — mesma consulta da lista de Boletos. */
async function buscarPendentes(c: Contexto, buscaOr: string | null): Promise<FonteTransacoes> {
  if (!c.plano.pendentes) return { itens: [], truncado: false };
  const { data, error } = await consultaFiltrada(c.supabase, opcoesLancamentos(c, c.plano.pendentes), buscaOr)
    .order('vencimento', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(LIMITE_FONTE + 1)
    .overrideTypes<LinhaLancamentoComFornecedor[], { merge: false }>();
  if (error) falharConsulta(error, 'listar contas a pagar');
  return fonte(data, (linhas) => linhas.map((l) => transacaoDoLancamento(paraLancamento(l), c.hoje)));
}

/** Pagamentos realizados, pela data do pagamento (mesma regra do Histórico). */
async function buscarPagos(c: Contexto, buscaOr: string | null): Promise<FonteTransacoes> {
  const faixa = c.plano.pagos;
  if (!faixa) return { itens: [], truncado: false };
  let consulta = consultaFiltrada(c.supabase, opcoesLancamentos(c, { status: 'pago', ordem: 'desc' }), buscaOr);
  if (faixa.de) consulta = consulta.gte('pago_em', instanteInicioDoDia(faixa.de));
  if (faixa.ate) consulta = consulta.lt('pago_em', instanteInicioDoDia(adicionarDias(faixa.ate, 1)));
  const { data, error } = await consulta
    .order('pago_em', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(LIMITE_FONTE + 1)
    .overrideTypes<LinhaLancamentoComFornecedor[], { merge: false }>();
  if (error) falharConsulta(error, 'listar pagamentos');
  return fonte(data, (linhas) => linhas.map((l) => transacaoDoLancamento(paraLancamento(l), c.hoje)));
}

// --------------------------------------------------------------- movimentos --

const CONTA_DO_MOVIMENTO = 'conta:contas_bancarias!movimentos_conta_fk{inner}(id, apelido, final, created_at, empresa_id, empresa:empresas!contas_empresa_fk(id, apelido))';

type LinhaMovimentoComConta = LinhaMovimento & {
  conta: Embutido<{ id: string; apelido: string; final: string | null; created_at: string; empresa_id: string; empresa: Embutido<{ id: string; apelido: string }> }>;
};

function contaDaLinha(l: LinhaMovimentoComConta): ContaDoMovimento {
  const c = primeiroEmbutido(l.conta);
  if (!c) return { id: l.conta_id, apelido: '(conta)', final: null, empresa: null, criadaEm: '' };
  return { id: c.id, apelido: c.apelido, final: c.final, empresa: primeiroEmbutido(c.empresa), criadaEm: c.created_at };
}

function colunasMovimento(filtrarPelaConta: boolean): string {
  // `!inner` só quando é preciso filtrar pela empresa da conta.
  return `${COLUNAS_MOVIMENTO}, ${CONTA_DO_MOVIMENTO.replace('{inner}', filtrarPelaConta ? '!inner' : '')}`;
}

async function buscarMovimentos(c: Contexto): Promise<FonteTransacoes> {
  const plano = c.plano.movimentos;
  if (!plano) return { itens: [], truncado: false };
  let consulta = c.supabase
    .from('movimentos_conta')
    .select(colunasMovimento(Boolean(c.empresaId)))
    .in('tipo', plano.tipos)
    // Conferência sem diferença não mexe no saldo: não é movimentação.
    .or('tipo.neq.conferencia,valor_centavos.neq.0');
  if (plano.confirmado !== undefined) consulta = consulta.eq('confirmado', plano.confirmado);
  if (plano.de) consulta = consulta.gte('data', plano.de);
  if (plano.ate) consulta = consulta.lte('data', plano.ate);
  if (c.filtros.contaId && c.filtros.contaId !== SEM_CONTA) consulta = consulta.eq('conta_id', c.filtros.contaId);
  if (c.empresaId) consulta = consulta.eq('conta.empresa_id', c.empresaId);
  if (c.busca) consulta = consulta.ilike('descricao', `%${c.busca}%`);
  const { data, error } = await consulta
    .order('data', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(LIMITE_FONTE + 1)
    .overrideTypes<LinhaMovimentoComConta[], { merge: false }>();
  if (error) falharConsulta(error, 'listar movimentos');
  const linhas = (data ?? []).slice(0, LIMITE_FONTE);
  const truncado = (data ?? []).length > LIMITE_FONTE;

  // Transferências: completa o outro lado quando ele ficou fora do filtro
  // (outra conta/empresa) — uma única consulta para todos.
  const lados = new Map<string, LinhaMovimentoComConta[]>();
  for (const l of linhas) {
    if (l.tipo !== 'transferencia' || !l.transferencia_id) continue;
    lados.set(l.transferencia_id, [...(lados.get(l.transferencia_id) ?? []), l]);
  }
  const incompletas = [...lados.entries()].filter(([, ls]) => ls.length < 2).map(([id]) => id);
  if (incompletas.length > 0) {
    const r = await c.supabase
      .from('movimentos_conta')
      .select(colunasMovimento(false))
      .in('transferencia_id', incompletas)
      .overrideTypes<LinhaMovimentoComConta[], { merge: false }>();
    if (r.error) falharConsulta(r.error, 'completar transferências');
    for (const l of r.data ?? []) {
      const atuais = lados.get(l.transferencia_id!) ?? [];
      if (!atuais.some((a) => a.id === l.id)) lados.set(l.transferencia_id!, [...atuais, l]);
    }
  }

  const itens: FonteTransacoes['itens'] = [];
  const vistas = new Set<string>();
  for (const l of linhas) {
    if (l.tipo === 'transferencia' && l.transferencia_id) {
      if (vistas.has(l.transferencia_id)) continue;
      vistas.add(l.transferencia_id);
      const par = lados.get(l.transferencia_id) ?? [l];
      itens.push(transacaoDaTransferencia(par.map((p) => ({ movimento: paraMovimento(p), conta: contaDaLinha(p) }))));
    } else {
      itens.push(transacaoDoMovimento(paraMovimento(l), contaDaLinha(l)));
    }
  }
  return { itens, truncado };
}

// ------------------------------------------------------------------ compras --

type LinhaCompraComCartao = LinhaCompraEmbutida & {
  created_at: string;
  cartao: Embutido<{ id: string; nome: string; final: string | null; empresa: Embutido<{ id: string; apelido: string }> }>;
};

async function buscarCompras(c: Contexto): Promise<FonteTransacoes> {
  const faixa = c.plano.compras;
  if (!faixa) return { itens: [], truncado: false };
  const inner = c.empresaId ? '!inner' : '';
  let consulta = c.supabase
    .from('compras_cartao')
    .select(`${COLUNAS_COMPRA}, created_at, cartao:cartoes!compras_cartao_fk${inner}(id, nome, final, empresa_id, empresa:empresas!cartoes_empresa_fk(id, apelido))`);
  if (faixa.de) consulta = consulta.gte('data_compra', faixa.de);
  if (faixa.ate) consulta = consulta.lte('data_compra', faixa.ate);
  if (c.filtros.categoriaId) consulta = consulta.eq('categoria_id', c.filtros.categoriaId);
  if (c.empresaId) consulta = consulta.eq('cartao.empresa_id', c.empresaId);
  if (c.busca) consulta = consulta.or(`descricao.ilike."*${c.busca}*",observacao.ilike."*${c.busca}*"`);
  const { data, error } = await consulta
    .order('data_compra', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(LIMITE_FONTE + 1)
    .overrideTypes<LinhaCompraComCartao[], { merge: false }>();
  if (error) falharConsulta(error, 'listar compras no cartão');
  return fonte(data, (linhas) =>
    linhas.map((l) => {
      const cartao = primeiroEmbutido(l.cartao);
      return transacaoDaCompra(
        { ...paraCompra(l), createdAt: l.created_at },
        cartao
          ? { id: cartao.id, nome: cartao.nome, final: cartao.final, empresa: primeiroEmbutido(cartao.empresa) }
          : { id: l.cartao_id, nome: '(cartão)', final: null, empresa: null },
      );
    }),
  );
}

// -------------------------------------------------------------------- lista --

export interface ResultadoTransacoes extends FonteTransacoes {
  /** Fontes consultadas (para explicar filtros que excluem tipos). */
  plano: PlanoTransacoes;
}

/**
 * Transações que atendem aos filtros, da mais recente para a mais antiga.
 * `empresaDoTopo` = empresa escolhida no seletor do topo (undefined = todas).
 */
export async function listarTransacoes(
  supabase: ClienteSupabase,
  filtros: FiltrosTransacoes,
  hoje: DataISO,
  empresaDoTopo?: string,
): Promise<ResultadoTransacoes> {
  const plano = planoDasTransacoes(filtros, hoje);
  const empresaId = empresaDaConsulta(empresaDoTopo, filtros.empresaId);
  if (empresaId === null) return { itens: [], truncado: false, plano };

  const c: Contexto = { supabase, plano, filtros, empresaId, busca: sanitizarBusca(filtros.busca), hoje };
  // Busca por fornecedor (sem acento) resolvida uma vez para as duas consultas de lançamentos.
  const buscaOr = plano.pendentes || plano.pagos ? await filtroBusca(supabase, c.busca) : null;
  const fontes = await Promise.all([buscarPendentes(c, buscaOr), buscarPagos(c, buscaOr), buscarMovimentos(c), buscarCompras(c)]);
  return { ...mesclarFontes(fontes), plano };
}
