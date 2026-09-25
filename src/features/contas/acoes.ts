'use server';
/**
 * Server Actions de contas bancárias e movimentos.
 * Saldo nunca é gravado direto: conferência e transferência são funções SQL
 * (cálculo e par de movimentos na mesma transação).
 */
import { z } from 'zod';
import { errosDeCampos, mensagemDeErro } from '@/lib/acoes/erros';
import { falha, sucesso, type ResultadoAcao } from '@/lib/acoes/resultado';
import { revalidarTudo } from '@/lib/acoes/revalidar';
import { exigirUsuario } from '@/lib/auth/sessao';
import { hojeISO } from '@/lib/domain/datas';
import { entradaNasceConfirmada } from '@/lib/domain/saldos';
import type { ContaBancaria, ContaResumida } from '@/lib/domain/tipos';
import { ErroConsulta } from '@/lib/supabase/consultas';
import { esquemaId, textoOuNulo } from '@/lib/validacao';
import { obterContextoEmpresas } from '@/features/empresas/consultas';
import { listarContas } from './consultas';
import {
  esquemaConferencia,
  esquemaConta,
  esquemaEntrada,
  esquemaNovaConta,
  esquemaTransferencia,
  type ValoresConta,
} from './esquemas';

const CONTA_EM_USO = 'Esta conta está ligada a lançamentos ou cartões e não pode ser excluída. Desative-a para escondê-la.';

function linhaConta(d: ValoresConta) {
  return {
    empresa_id: d.empresaId,
    apelido: d.apelido.trim(),
    banco: d.banco.trim(),
    final: textoOuNulo(d.final),
    // Conta inativa não pode ser a padrão (regra também no banco).
    padrao: d.padrao && d.ativa,
    ativa: d.ativa,
  };
}

export async function criarConta(entrada: unknown): Promise<ResultadoAcao<{ id: string }>> {
  const { supabase } = await exigirUsuario();
  const v = esquemaNovaConta.safeParse(entrada);
  if (!v.success) return falha('Revise os campos destacados.', errosDeCampos(v.error));
  const { data, error } = await supabase.from('contas_bancarias').insert(linhaConta(v.data)).select('id').single();
  if (error) return falha(mensagemDeErro(error, 'criar conta'));
  // O saldo de hoje vira a primeira conferência ("Saldo inicial" no extrato).
  const conferencia = await supabase.rpc('conferir_saldo', { p_conta_id: data.id, p_saldo_informado: v.data.saldoInicialCentavos });
  if (conferencia.error) return falha(mensagemDeErro(conferencia.error, 'saldo inicial'));
  revalidarTudo();
  return sucesso({ id: data.id }, 'Conta cadastrada.');
}

export async function atualizarConta(id: unknown, entrada: unknown): Promise<ResultadoAcao> {
  const { supabase } = await exigirUsuario();
  const idOk = esquemaId.safeParse(id);
  const v = esquemaConta.safeParse(entrada);
  if (!idOk.success) return falha('Conta inválida.');
  if (!v.success) return falha('Revise os campos destacados.', errosDeCampos(v.error));
  const { data, error } = await supabase.from('contas_bancarias').update(linhaConta(v.data)).eq('id', idOk.data).select('id');
  if (error) {
    const mensagem =
      error.code === '23503'
        ? 'Esta conta tem lançamentos ou cartões de outra empresa. Mude a empresa deles antes.'
        : mensagemDeErro(error, 'atualizar conta');
    return falha(mensagem);
  }
  if (!data?.length) return falha('Conta não encontrada.');
  revalidarTudo();
  return sucesso(undefined, 'Conta atualizada.');
}

export async function excluirConta(id: unknown): Promise<ResultadoAcao> {
  const { supabase } = await exigirUsuario();
  const idOk = esquemaId.safeParse(id);
  if (!idOk.success) return falha('Conta inválida.');
  const { data, error } = await supabase.from('contas_bancarias').delete().eq('id', idOk.data).select('id');
  if (error) return falha(mensagemDeErro(error, 'excluir conta', { emUso: CONTA_EM_USO }));
  if (!data?.length) return falha('Conta não encontrada.');
  revalidarTudo();
  return sucesso(undefined, 'Conta excluída.');
}

/** Entrada de dinheiro. Data futura = prevista (confirma-se no dia). */
export async function registrarEntrada(entrada: unknown): Promise<ResultadoAcao> {
  const { supabase } = await exigirUsuario();
  const v = esquemaEntrada.safeParse(entrada);
  if (!v.success) return falha('Revise os campos destacados.', errosDeCampos(v.error));
  const confirmado = entradaNasceConfirmada(v.data.data, hojeISO());
  const { error } = await supabase.from('movimentos_conta').insert({
    conta_id: v.data.contaId,
    tipo: 'entrada',
    data: v.data.data,
    valor_centavos: v.data.valorCentavos,
    descricao: v.data.descricao.trim(),
    confirmado,
  });
  if (error) return falha(mensagemDeErro(error, 'registrar entrada'));
  revalidarTudo();
  return sucesso(undefined, confirmado ? 'Entrada adicionada.' : 'Entrada prevista adicionada.');
}

/** Entrada prevista que se confirmou: passa a contar no saldo, na data de hoje. */
export async function confirmarEntrada(id: unknown): Promise<ResultadoAcao> {
  const { supabase } = await exigirUsuario();
  const idOk = esquemaId.safeParse(id);
  if (!idOk.success) return falha('Entrada inválida.');
  const { data, error } = await supabase
    .from('movimentos_conta')
    .update({ confirmado: true, data: hojeISO() })
    .eq('id', idOk.data)
    .eq('tipo', 'entrada')
    .select('id');
  if (error) return falha(mensagemDeErro(error, 'confirmar entrada'));
  if (!data?.length) return falha('Entrada não encontrada.');
  revalidarTudo();
  return sucesso(undefined, 'Entrada confirmada.');
}

/** Exclui uma entrada ou conferência (transferências: excluirTransferencia). */
export async function excluirMovimento(id: unknown): Promise<ResultadoAcao> {
  const { supabase } = await exigirUsuario();
  const idOk = esquemaId.safeParse(id);
  if (!idOk.success) return falha('Movimento inválido.');
  const { data, error } = await supabase.from('movimentos_conta').delete().eq('id', idOk.data).neq('tipo', 'transferencia').select('id');
  if (error) return falha(mensagemDeErro(error, 'excluir movimento'));
  if (!data?.length) return falha('Movimento não encontrado.');
  revalidarTudo();
  return sucesso(undefined, 'Movimento excluído.');
}

export async function transferir(entrada: unknown): Promise<ResultadoAcao> {
  const { supabase } = await exigirUsuario();
  const v = esquemaTransferencia.safeParse(entrada);
  if (!v.success) return falha('Revise os campos destacados.', errosDeCampos(v.error));
  const { error } = await supabase.rpc('transferir_entre_contas', {
    p_origem_id: v.data.origemId,
    p_destino_id: v.data.destinoId,
    p_valor: v.data.valorCentavos,
    p_data: v.data.data,
    p_descricao: textoOuNulo(v.data.descricao),
  });
  if (error) return falha(mensagemDeErro(error, 'transferir'));
  revalidarTudo();
  return sucesso(undefined, 'Transferência concluída.');
}

export async function excluirTransferencia(transferenciaId: unknown): Promise<ResultadoAcao> {
  const { supabase } = await exigirUsuario();
  const idOk = esquemaId.safeParse(transferenciaId);
  if (!idOk.success) return falha('Transferência inválida.');
  const { error } = await supabase.rpc('excluir_transferencia', { p_transferencia_id: idOk.data });
  if (error) return falha(mensagemDeErro(error, 'excluir transferência'));
  revalidarTudo();
  return sucesso(undefined, 'Transferência excluída.');
}

/** Conferência com o extrato: grava o ajuste (saldo do banco − calculado). */
export async function conferirSaldo(entrada: unknown): Promise<ResultadoAcao<{ ajusteCentavos: number }>> {
  const { supabase } = await exigirUsuario();
  const v = esquemaConferencia.safeParse(entrada);
  if (!v.success) return falha('Revise os campos destacados.', errosDeCampos(v.error));
  const { data, error } = await supabase.rpc('conferir_saldo', { p_conta_id: v.data.contaId, p_saldo_informado: v.data.saldoCentavos });
  if (error || !data) return falha(mensagemDeErro(error, 'conferir saldo'));
  revalidarTudo();
  const ajuste = Number(data.valor_centavos);
  return sucesso({ ajusteCentavos: ajuste }, ajuste === 0 ? 'Saldo conferido: está certo.' : 'Saldo conferido e ajustado.');
}

const esquemaConferenciasDoDia = z
  .array(esquemaConferencia)
  .min(1, 'Nenhuma conta para conferir.')
  .max(50, 'São contas demais para conferir de uma vez (máximo de 50).');

/**
 * Conferência do primeiro acesso do dia: grava uma conferência por conta
 * (mesmo sem diferença — é o registro de que foi conferida hoje).
 */
export async function conferirSaldosDoDia(entrada: unknown): Promise<ResultadoAcao<{ ajustadas: number }>> {
  const { supabase } = await exigirUsuario();
  const v = esquemaConferenciasDoDia.safeParse(entrada);
  if (!v.success) return falha('Revise os saldos informados.');
  let ajustadas = 0;
  for (const c of v.data) {
    const { data, error } = await supabase.rpc('conferir_saldo', { p_conta_id: c.contaId, p_saldo_informado: c.saldoCentavos });
    if (error || !data) return falha(mensagemDeErro(error, 'conferir saldos do dia'));
    if (Number(data.valor_centavos) !== 0) ajustadas += 1;
  }
  revalidarTudo();
  return sucesso(
    { ajustadas },
    ajustadas === 0 ? 'Saldos conferidos. Tudo certo.' : `Saldos conferidos (${ajustadas} ${ajustadas === 1 ? 'conta ajustada' : 'contas ajustadas'}).`,
  );
}

/** Coloca a conta padrão da empresa em todos os lançamentos em aberto sem conta. */
export async function aplicarContaPadrao(empresaId: unknown): Promise<ResultadoAcao<{ quantidade: number }>> {
  const { supabase } = await exigirUsuario();
  const idOk = esquemaId.safeParse(empresaId);
  if (!idOk.success) return falha('Empresa inválida.');
  const { data: conta, error: e1 } = await supabase
    .from('contas_bancarias')
    .select('id')
    .eq('empresa_id', idOk.data)
    .eq('padrao', true)
    .maybeSingle();
  if (e1) return falha(mensagemDeErro(e1, 'buscar conta padrão'));
  if (!conta) return falha('Esta empresa não tem conta padrão.');
  const { data, error } = await supabase
    .from('lancamentos')
    .update({ conta_id: conta.id })
    .eq('empresa_id', idOk.data)
    .eq('status', 'pendente')
    .is('conta_id', null)
    .is('cartao_id', null)
    .select('id');
  if (error) return falha(mensagemDeErro(error, 'aplicar conta padrão'));
  revalidarTudo();
  const n = data?.length ?? 0;
  return sucesso({ quantidade: n }, n === 1 ? '1 lançamento atualizado.' : `${n} lançamentos atualizados.`);
}

/**
 * Contas ativas para registrar uma entrada pelo botão "+" (fora da tela da
 * conta): as da empresa selecionada no topo, ou de todas.
 */
export async function contasParaEntrada(): Promise<ResultadoAcao<ContaBancaria[]>> {
  const { supabase } = await exigirUsuario();
  try {
    const { empresaId } = await obterContextoEmpresas();
    return sucesso(await listarContas(supabase, { empresaId, somenteAtivas: true }));
  } catch (erro) {
    return falha(erro instanceof ErroConsulta ? erro.message : mensagemDeErro(erro, 'listar contas para entrada'));
  }
}

/** Contas ativas de uma empresa (para escolher a conta na hora de pagar). */
export async function contasParaPagamento(empresaId: unknown): Promise<ResultadoAcao<ContaResumida[]>> {
  const { supabase } = await exigirUsuario();
  const idOk = esquemaId.safeParse(empresaId);
  if (!idOk.success) return falha('Empresa inválida.');
  const { data, error } = await supabase
    .from('contas_bancarias')
    .select('id, apelido, final')
    .eq('empresa_id', idOk.data)
    .eq('ativa', true)
    .order('padrao', { ascending: false })
    .order('apelido_normalizado');
  if (error) return falha(mensagemDeErro(error, 'listar contas'));
  return sucesso(data ?? []);
}
