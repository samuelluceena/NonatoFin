'use server';
/**
 * Server Actions de boletos (escrita).
 * Toda ação: 1) exige usuário autenticado; 2) valida a entrada com Zod;
 * 3) grava via cliente com sessão (RLS aplicada); 4) revalida as páginas.
 */
import { errosDeCampos, mensagemDeErro } from '@/lib/acoes/erros';
import { falha, sucesso, type ResultadoAcao } from '@/lib/acoes/resultado';
import { revalidarTudo } from '@/lib/acoes/revalidar';
import { exigirUsuario } from '@/lib/auth/sessao';
import { normalizarCodigo } from '@/lib/domain/codigo-barras';
import { limparNome } from '@/lib/domain/fornecedores';
import { gerarLancamentosSerie } from '@/lib/domain/recorrencia';
import type { EscopoSerie } from '@/lib/domain/tipos';
import type { ClienteSupabase } from '@/lib/supabase/server';
import {
  codigoOuNulo,
  esquemaCodigo,
  esquemaEdicaoLancamento,
  esquemaEscopo,
  esquemaId,
  esquemaNovoLancamento,
  textoOuNulo,
} from './esquemas';


async function obterFornecedorId(supabase: ClienteSupabase, nome: string): Promise<string> {
  const { data, error } = await supabase.rpc('obter_ou_criar_fornecedor', { p_nome: limparNome(nome) });
  if (error || !data) throw error ?? new Error('Fornecedor não retornado.');
  return data;
}

export async function criarLancamento(entrada: unknown): Promise<ResultadoAcao<{ quantidade: number; primeiroId: string }>> {
  const { supabase } = await exigirUsuario();
  const validacao = esquemaNovoLancamento.safeParse(entrada);
  if (!validacao.success) return falha('Revise os campos destacados.', errosDeCampos(validacao.error));
  const d = validacao.data;

  try {
    const fornecedorId = await obterFornecedorId(supabase, d.fornecedorNome);
    const base = {
      empresa_id: d.empresaId,
      categoria_id: d.categoriaId,
      conta_id: d.contaId || null,
      fornecedor_id: fornecedorId,
      descricao: d.descricao.trim(),
      observacao: textoOuNulo(d.observacao),
    };

    const linhas =
      d.tipo === 'unico'
        ? [{ ...base, valor_centavos: d.valorCentavos, vencimento: d.vencimento, codigo_barras: codigoOuNulo(d.codigoBarras) }]
        : (() => {
            const serieId = crypto.randomUUID();
            return gerarLancamentosSerie({
              primeiroVencimento: d.vencimento,
              quantidade: d.quantidade,
              valorCentavos: d.valorCentavos,
              codigoBarras: codigoOuNulo(d.codigoBarras),
              mesmoCodigoEmTodos: d.mesmoCodigoEmTodos,
            }).map((l) => ({
              ...base,
              valor_centavos: l.valorCentavos,
              vencimento: l.vencimento,
              codigo_barras: l.codigoBarras,
              serie_id: serieId,
              parcela: l.parcela,
              total_parcelas: l.totalParcelas,
            }));
          })();

    // Um único INSERT com várias linhas é atômico: cria todas ou nenhuma.
    const { data, error } = await supabase.from('lancamentos').insert(linhas).select('id, vencimento, parcela');
    if (error) throw error;

    revalidarTudo();
    const ordenados = [...(data ?? [])].sort((a, b) => (a.parcela ?? 0) - (b.parcela ?? 0));
    const mensagem = linhas.length === 1 ? 'Boleto salvo!' : `${linhas.length} lançamentos criados!`;
    return sucesso({ quantidade: linhas.length, primeiroId: ordenados[0]?.id ?? '' }, mensagem);
  } catch (erro) {
    return falha(mensagemDeErro(erro, 'criar boleto'));
  }
}

export async function atualizarLancamento(id: unknown, entrada: unknown): Promise<ResultadoAcao<{ alterados: number }>> {
  const { supabase } = await exigirUsuario();
  const idValido = esquemaId.safeParse(id);
  if (!idValido.success) return falha('Boleto inválido.');
  const validacao = esquemaEdicaoLancamento.safeParse(entrada);
  if (!validacao.success) return falha('Revise os campos destacados.', errosDeCampos(validacao.error));
  const d = validacao.data;

  try {
    const fornecedorId = await obterFornecedorId(supabase, d.fornecedorNome);
    const { data, error } = await supabase.rpc('atualizar_lancamento', {
      p_id: idValido.data,
      p_escopo: d.escopo,
      p_empresa_id: d.empresaId,
      p_categoria_id: d.categoriaId,
      p_conta_id: d.contaId || null,
      p_fornecedor_id: fornecedorId,
      p_descricao: d.descricao.trim(),
      p_valor_centavos: d.valorCentavos,
      p_vencimento: d.vencimento,
      p_codigo_barras: codigoOuNulo(d.codigoBarras),
      p_observacao: textoOuNulo(d.observacao),
      p_status: d.status,
    });
    if (error) throw error;
    revalidarTudo();
    const alterados = Number(data ?? 1);
    return sucesso({ alterados }, alterados > 1 ? `${alterados} boletos atualizados!` : 'Boleto atualizado!');
  } catch (erro) {
    return falha(mensagemDeErro(erro, 'atualizar boleto'));
  }
}

/**
 * Marca como pago (ou desfaz). `contaId` informa por qual conta foi pago
 * ("paguei pelo Bradesco"); sem ele, vale a conta prevista no lançamento.
 */
export async function definirPagamento(id: unknown, pago: boolean, contaId?: unknown): Promise<ResultadoAcao> {
  const { supabase } = await exigirUsuario();
  const idValido = esquemaId.safeParse(id);
  const contaValida = contaId === undefined ? null : esquemaId.safeParse(contaId);
  if (!idValido.success || typeof pago !== 'boolean' || (contaValida && !contaValida.success)) return falha('Dados inválidos.');
  const { error } = await supabase.rpc('definir_pagamento', {
    p_id: idValido.data,
    p_pago: pago,
    ...(contaValida?.success ? { p_conta_id: contaValida.data } : {}),
  });
  if (error) return falha(mensagemDeErro(error, 'definir pagamento'));
  revalidarTudo();
  return sucesso(undefined, pago ? 'Boleto marcado como pago!' : 'Pagamento desfeito.');
}

export async function definirCodigo(id: unknown, codigo: unknown): Promise<ResultadoAcao> {
  const { supabase } = await exigirUsuario();
  const idValido = esquemaId.safeParse(id);
  const codigoValido = esquemaCodigo.safeParse(codigo);
  if (!idValido.success) return falha('Boleto inválido.');
  if (!codigoValido.success) return falha(codigoValido.error.issues[0]?.message ?? 'Código inválido.');
  const { data, error } = await supabase
    .from('lancamentos')
    .update({ codigo_barras: normalizarCodigo(codigoValido.data) })
    .eq('id', idValido.data)
    .select('id');
  if (error) return falha(mensagemDeErro(error, 'salvar código'));
  if (!data || data.length === 0) return falha('Boleto não encontrado.');
  revalidarTudo();
  return sucesso(undefined, 'Código salvo!');
}

export async function excluirLancamento(id: unknown, escopo: unknown): Promise<ResultadoAcao<{ excluidos: number }>> {
  const { supabase } = await exigirUsuario();
  const idValido = esquemaId.safeParse(id);
  const escopoValido = esquemaEscopo.safeParse(escopo);
  if (!idValido.success || !escopoValido.success) return falha('Dados inválidos.');
  const { data, error } = await supabase.rpc('excluir_lancamento', {
    p_id: idValido.data,
    p_escopo: escopoValido.data satisfies EscopoSerie,
  });
  if (error) return falha(mensagemDeErro(error, 'excluir boleto'));
  revalidarTudo();
  const excluidos = Number(data ?? 1);
  return sucesso({ excluidos }, excluidos > 1 ? `${excluidos} boletos excluídos.` : 'Boleto excluído.');
}
