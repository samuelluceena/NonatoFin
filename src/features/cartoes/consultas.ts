import 'server-only';
/**
 * Consultas de cartões, compras e parcelas (leitura, sempre com RLS).
 */
import type { ChaveMes, DataISO } from '@/lib/domain/datas';
import type { Lancamento, Cartao, CompraCartao, ParcelaCartao } from '@/lib/domain/tipos';
import type { ClienteSupabase } from '@/lib/supabase/server';
import { falharConsulta } from '@/lib/supabase/consultas';
import { primeiroEmbutido as primeiro, type Embutido } from '@/lib/supabase/embutidos';
import { COLUNAS_LANCAMENTO, paraLancamento, type LinhaLancamentoComFornecedor } from '@/features/lancamentos/mapeadores';


const COLUNAS_CARTAO =
  'id, nome, final, dia_fechamento, dia_vencimento, ativo, categoria_fatura_id, conta_id, ' +
  'empresa:empresas!cartoes_empresa_fk(id, apelido), emissor:fornecedores!cartoes_fornecedor_fk(id, nome)';

interface LinhaCartao {
  id: string;
  nome: string;
  final: string | null;
  dia_fechamento: number;
  dia_vencimento: number;
  ativo: boolean;
  categoria_fatura_id: string;
  conta_id: string | null;
  empresa: Embutido<{ id: string; apelido: string }>;
  emissor: Embutido<{ id: string; nome: string }>;
}

function paraCartao(l: LinhaCartao): Cartao {
  return {
    id: l.id,
    nome: l.nome,
    final: l.final,
    diaFechamento: l.dia_fechamento,
    diaVencimento: l.dia_vencimento,
    ativo: l.ativo,
    categoriaFaturaId: l.categoria_fatura_id,
    contaId: l.conta_id,
    empresa: primeiro(l.empresa) ?? { id: '', apelido: '(sem empresa)' },
    emissor: primeiro(l.emissor) ?? { id: '', nome: '(sem emissor)' },
  };
}

export async function listarCartoes(
  supabase: ClienteSupabase,
  opcoes: { empresaId?: string; somenteAtivos?: boolean } = {},
): Promise<Cartao[]> {
  let q = supabase.from('cartoes').select(COLUNAS_CARTAO).order('nome_normalizado', { ascending: true });
  if (opcoes.empresaId) q = q.eq('empresa_id', opcoes.empresaId);
  if (opcoes.somenteAtivos) q = q.eq('ativo', true);
  const { data, error } = await q.overrideTypes<LinhaCartao[], { merge: false }>();
  if (error) falharConsulta(error, 'listar cartões');
  return (data ?? []).map(paraCartao);
}

export async function obterCartao(supabase: ClienteSupabase, id: string): Promise<Cartao | null> {
  const { data, error } = await supabase
    .from('cartoes')
    .select(COLUNAS_CARTAO)
    .eq('id', id)
    .maybeSingle()
    .overrideTypes<LinhaCartao, { merge: false }>();
  if (error) falharConsulta(error, 'obter cartão');
  return data ? paraCartao(data) : null;
}

export interface ResumoFaturasCartao {
  proxima: { mes: ChaveMes; vencimento: DataISO; valorCentavos: number; lancamentoId: string } | null;
  pendenteCentavos: number;
  faturasPendentes: number;
}

/** Próxima fatura em aberto e total pendente de cada cartão. */
export async function resumirFaturasPendentes(
  supabase: ClienteSupabase,
  cartaoIds: string[],
): Promise<Map<string, ResumoFaturasCartao>> {
  const mapa = new Map<string, ResumoFaturasCartao>(
    cartaoIds.map((id) => [id, { proxima: null, pendenteCentavos: 0, faturasPendentes: 0 }]),
  );
  if (cartaoIds.length === 0) return mapa;
  const { data, error } = await supabase
    .from('lancamentos')
    .select('id, cartao_id, fatura_mes, vencimento, valor_centavos')
    .in('cartao_id', cartaoIds)
    .eq('status', 'pendente')
    .order('fatura_mes', { ascending: true })
    .limit(2000);
  if (error) falharConsulta(error, 'resumir faturas');
  for (const b of data ?? []) {
    const r = b.cartao_id ? mapa.get(b.cartao_id) : undefined;
    if (!r || !b.fatura_mes) continue;
    const valor = Number(b.valor_centavos);
    r.pendenteCentavos += valor;
    r.faturasPendentes += 1;
    if (!r.proxima) r.proxima = { mes: b.fatura_mes, vencimento: b.vencimento, valorCentavos: valor, lancamentoId: b.id };
  }
  return mapa;
}

/** Faturas do cartão (lançamentos a pagar), da mais recente para a mais antiga. */
export async function listarFaturasDoCartao(supabase: ClienteSupabase, cartaoId: string): Promise<Lancamento[]> {
  const { data, error } = await supabase
    .from('lancamentos')
    .select(COLUNAS_LANCAMENTO)
    .eq('cartao_id', cartaoId)
    .order('fatura_mes', { ascending: false })
    .limit(240)
    .overrideTypes<LinhaLancamentoComFornecedor[], { merge: false }>();
  if (error) falharConsulta(error, 'listar faturas');
  return (data ?? []).map(paraLancamento);
}

const COLUNAS_COMPRA =
  'id, cartao_id, descricao, data_compra, valor_total_centavos, parcelas, primeira_fatura_mes, observacao, ' +
  'categoria:categorias!compras_categoria_fk(id, nome)';

interface LinhaCompraEmbutida {
  id: string;
  cartao_id: string;
  descricao: string;
  data_compra: string;
  valor_total_centavos: number;
  parcelas: number;
  primeira_fatura_mes: string;
  observacao: string | null;
  categoria: Embutido<{ id: string; nome: string }>;
}

function paraCompra(l: LinhaCompraEmbutida): CompraCartao {
  return {
    id: l.id,
    cartaoId: l.cartao_id,
    categoria: primeiro(l.categoria) ?? { id: '', nome: '(sem categoria)' },
    descricao: l.descricao,
    dataCompra: l.data_compra,
    valorTotalCentavos: Number(l.valor_total_centavos),
    parcelas: l.parcelas,
    primeiraFaturaMes: l.primeira_fatura_mes,
    observacao: l.observacao,
  };
}

export async function listarComprasDoCartao(supabase: ClienteSupabase, cartaoId: string, limite = 300): Promise<CompraCartao[]> {
  const { data, error } = await supabase
    .from('compras_cartao')
    .select(COLUNAS_COMPRA)
    .eq('cartao_id', cartaoId)
    .order('data_compra', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limite)
    .overrideTypes<LinhaCompraEmbutida[], { merge: false }>();
  if (error) falharConsulta(error, 'listar compras');
  return (data ?? []).map(paraCompra);
}

export async function obterCompra(supabase: ClienteSupabase, id: string): Promise<CompraCartao | null> {
  const { data, error } = await supabase
    .from('compras_cartao')
    .select(COLUNAS_COMPRA)
    .eq('id', id)
    .maybeSingle()
    .overrideTypes<LinhaCompraEmbutida, { merge: false }>();
  if (error) falharConsulta(error, 'obter compra');
  return data ? paraCompra(data) : null;
}

interface LinhaParcela {
  id: string;
  compra_id: string;
  cartao_id: string;
  numero: number;
  total: number;
  valor_centavos: number;
  fatura_mes: string;
  compra: Embutido<{ descricao: string; data_compra: string }>;
}

/** Parcelas que compõem uma fatura (ordenadas pela data da compra). */
export async function listarParcelasDaFatura(
  supabase: ClienteSupabase,
  cartaoId: string,
  mes: ChaveMes,
): Promise<(ParcelaCartao & { dataCompra: DataISO })[]> {
  const { data, error } = await supabase
    .from('parcelas_cartao')
    .select('id, compra_id, cartao_id, numero, total, valor_centavos, fatura_mes, compra:compras_cartao!parcelas_compra_fk(descricao, data_compra)')
    .eq('cartao_id', cartaoId)
    .eq('fatura_mes', mes)
    .limit(1000)
    .overrideTypes<LinhaParcela[], { merge: false }>();
  if (error) falharConsulta(error, 'listar parcelas da fatura');
  return (data ?? [])
    .map((p) => {
      const compra = primeiro(p.compra);
      return {
        id: p.id,
        compraId: p.compra_id,
        cartaoId: p.cartao_id,
        numero: p.numero,
        total: p.total,
        valorCentavos: Number(p.valor_centavos),
        faturaMes: p.fatura_mes,
        compraDescricao: compra?.descricao ?? '(compra)',
        dataCompra: compra?.data_compra ?? '',
      };
    })
    .sort((a, b) => a.dataCompra.localeCompare(b.dataCompra) || a.compraDescricao.localeCompare(b.compraDescricao, 'pt-BR'));
}
