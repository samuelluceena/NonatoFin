'use server';
/**
 * Server Actions de cartões e compras parceladas.
 * Compras são gravadas por RPC (parcelas e faturas são geradas no banco,
 * na mesma transação). Toda ação exige sessão e valida com Zod.
 */
import { errosDeCampos, mensagemDeErro } from '@/lib/acoes/erros';
import { falha, sucesso, type ResultadoAcao } from '@/lib/acoes/resultado';
import { revalidarTudo } from '@/lib/acoes/revalidar';
import { esquemaId, textoOuNulo } from '@/lib/validacao';
import { exigirUsuario } from '@/lib/auth/sessao';
import { limparNome } from '@/lib/domain/fornecedores';
import type { ClienteSupabase } from '@/lib/supabase/server';
import { esquemaAjuste, esquemaCartao, esquemaCompra, type ValoresCompra } from './esquemas';

const CARTAO_EM_USO = 'Este cartão tem compras ou faturas e não pode ser excluído. Desative-o para escondê-lo.';

async function obterEmissorId(supabase: ClienteSupabase, nome: string): Promise<string> {
  const { data, error } = await supabase.rpc('obter_ou_criar_fornecedor', { p_nome: limparNome(nome) });
  if (error || !data) throw error ?? new Error('Emissor não retornado.');
  return data;
}

export async function criarCartao(entrada: unknown): Promise<ResultadoAcao<{ id: string }>> {
  const { supabase } = await exigirUsuario();
  const v = esquemaCartao.safeParse(entrada);
  if (!v.success) return falha('Revise os campos destacados.', errosDeCampos(v.error));
  const d = v.data;
  try {
    const emissorId = await obterEmissorId(supabase, d.emissorNome);
    const { data, error } = await supabase
      .from('cartoes')
      .insert({
        empresa_id: d.empresaId,
        fornecedor_id: emissorId,
        categoria_fatura_id: d.categoriaFaturaId,
        conta_id: d.contaId || null,
        nome: d.nome.trim(),
        final: textoOuNulo(d.final),
        dia_fechamento: d.diaFechamento,
        dia_vencimento: d.diaVencimento,
        ativo: d.ativo,
      })
      .select('id')
      .single();
    if (error) throw error;
    revalidarTudo();
    return sucesso({ id: data.id }, 'Cartão cadastrado.');
  } catch (erro) {
    return falha(mensagemDeErro(erro, 'criar cartão'));
  }
}

export async function atualizarCartao(id: unknown, entrada: unknown): Promise<ResultadoAcao> {
  const { supabase } = await exigirUsuario();
  const idOk = esquemaId.safeParse(id);
  const v = esquemaCartao.safeParse(entrada);
  if (!idOk.success) return falha('Cartão inválido.');
  if (!v.success) return falha('Revise os campos destacados.', errosDeCampos(v.error));
  const d = v.data;
  try {
    const emissorId = await obterEmissorId(supabase, d.emissorNome);
    // O gatilho do banco atualiza as faturas EM ABERTO (empresa, emissor,
    // categoria, descrição e vencimento). Faturas pagas ficam como estão.
    const { data, error } = await supabase
      .from('cartoes')
      .update({
        empresa_id: d.empresaId,
        fornecedor_id: emissorId,
        categoria_fatura_id: d.categoriaFaturaId,
        conta_id: d.contaId || null,
        nome: d.nome.trim(),
        final: textoOuNulo(d.final),
        dia_fechamento: d.diaFechamento,
        dia_vencimento: d.diaVencimento,
        ativo: d.ativo,
      })
      .eq('id', idOk.data)
      .select('id');
    if (error) throw error;
    if (!data?.length) return falha('Cartão não encontrado.');
    revalidarTudo();
    return sucesso(undefined, 'Cartão atualizado.');
  } catch (erro) {
    return falha(mensagemDeErro(erro, 'atualizar cartão'));
  }
}

export async function excluirCartao(id: unknown): Promise<ResultadoAcao> {
  const { supabase } = await exigirUsuario();
  const idOk = esquemaId.safeParse(id);
  if (!idOk.success) return falha('Cartão inválido.');
  const { data, error } = await supabase.from('cartoes').delete().eq('id', idOk.data).select('id');
  if (error) return falha(mensagemDeErro(error, 'excluir cartão', { emUso: CARTAO_EM_USO }));
  if (!data?.length) return falha('Cartão não encontrado.');
  revalidarTudo();
  return sucesso(undefined, 'Cartão excluído.');
}

function argsCompra(d: ValoresCompra) {
  return {
    p_cartao_id: d.cartaoId,
    p_categoria_id: d.categoriaId,
    p_descricao: d.descricao.trim(),
    p_data_compra: d.dataCompra,
    p_valor_total: d.valorTotalCentavos,
    p_parcelas: d.parcelas,
    p_primeira_fatura_mes: d.primeiraFaturaMes,
    p_observacao: textoOuNulo(d.observacao),
  };
}

export async function registrarCompra(entrada: unknown): Promise<ResultadoAcao<{ id: string }>> {
  const { supabase } = await exigirUsuario();
  const v = esquemaCompra.safeParse(entrada);
  if (!v.success) return falha('Revise os campos destacados.', errosDeCampos(v.error));
  const { data, error } = await supabase.rpc('registrar_compra_cartao', argsCompra(v.data));
  if (error || !data) return falha(mensagemDeErro(error, 'registrar compra'));
  revalidarTudo();
  const n = v.data.parcelas;
  return sucesso({ id: data }, n === 1 ? 'Compra lançada.' : `Compra lançada em ${n} parcelas.`);
}

export async function atualizarCompra(id: unknown, entrada: unknown): Promise<ResultadoAcao> {
  const { supabase } = await exigirUsuario();
  const idOk = esquemaId.safeParse(id);
  const v = esquemaCompra.safeParse(entrada);
  if (!idOk.success) return falha('Compra inválida.');
  if (!v.success) return falha('Revise os campos destacados.', errosDeCampos(v.error));
  const { error } = await supabase.rpc('atualizar_compra_cartao', { p_id: idOk.data, ...argsCompra(v.data) });
  if (error) return falha(mensagemDeErro(error, 'atualizar compra'));
  revalidarTudo();
  return sucesso(undefined, 'Compra atualizada.');
}

export async function excluirCompra(id: unknown): Promise<ResultadoAcao> {
  const { supabase } = await exigirUsuario();
  const idOk = esquemaId.safeParse(id);
  if (!idOk.success) return falha('Compra inválida.');
  const { error } = await supabase.rpc('excluir_compra_cartao', { p_id: idOk.data });
  if (error) return falha(mensagemDeErro(error, 'excluir compra'));
  revalidarTudo();
  return sucesso(undefined, 'Compra excluída.');
}

/** Ajuste manual da fatura (juros, anuidade, estorno, crédito...). */
export async function definirAjusteFatura(lancamentoId: unknown, entrada: unknown): Promise<ResultadoAcao> {
  const { supabase } = await exigirUsuario();
  const idOk = esquemaId.safeParse(lancamentoId);
  const v = esquemaAjuste.safeParse(entrada);
  if (!idOk.success) return falha('Fatura inválida.');
  if (!v.success) return falha('Revise os campos destacados.', errosDeCampos(v.error));
  const { error } = await supabase.rpc('definir_ajuste_fatura', {
    p_id: idOk.data,
    p_ajuste: v.data.ajusteCentavos,
    p_observacao: textoOuNulo(v.data.observacao),
  });
  if (error) return falha(mensagemDeErro(error, 'ajustar fatura'));
  revalidarTudo();
  return sucesso(undefined, 'Fatura ajustada.');
}
