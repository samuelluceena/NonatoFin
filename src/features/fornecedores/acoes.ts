'use server';
/**
 * Server Actions de fornecedores (escrita): criar, renomear e excluir.
 */
import { z } from 'zod';
import { LIMITES } from '@/lib/config';
import { mensagemDeErro } from '@/lib/acoes/erros';
import { falha, sucesso, type ResultadoAcao } from '@/lib/acoes/resultado';
import { revalidarTudo } from '@/lib/acoes/revalidar';
import { esquemaId } from '@/lib/validacao';
import { exigirUsuario } from '@/lib/auth/sessao';
import { limparNome, normalizarNome } from '@/lib/domain/fornecedores';

const esquemaNome = z
  .string()
  .transform(limparNome)
  .pipe(
    z
      .string()
      .min(1, 'Informe o nome do fornecedor.')
      .max(LIMITES.fornecedorNomeMax, `Máximo de ${LIMITES.fornecedorNomeMax} caracteres.`),
  );

const FORNECEDOR_EM_USO = 'Este fornecedor possui boletos e não pode ser excluído. Exclua ou mova os boletos antes.';

export async function criarFornecedor(nome: unknown): Promise<ResultadoAcao<{ id: string; existente: boolean }>> {
  const { supabase } = await exigirUsuario();
  const validacao = esquemaNome.safeParse(nome);
  if (!validacao.success) return falha(validacao.error.issues[0]?.message ?? 'Nome inválido.');

  // Verifica antes para informar se já existia (sem duplicar).
  const { data: existentes } = await supabase.from('fornecedores').select('id').eq('nome_normalizado', normalizarNome(validacao.data)).limit(1);
  const { data, error } = await supabase.rpc('obter_ou_criar_fornecedor', { p_nome: validacao.data });
  if (error || !data) return falha(mensagemDeErro(error, 'criar fornecedor'));
  revalidarTudo();
  const jaExistia = (existentes?.length ?? 0) > 0;
  return sucesso({ id: data, existente: jaExistia }, jaExistia ? 'Fornecedor já cadastrado.' : 'Fornecedor cadastrado!');
}

export async function renomearFornecedor(id: unknown, nome: unknown): Promise<ResultadoAcao> {
  const { supabase } = await exigirUsuario();
  const idValido = esquemaId.safeParse(id);
  const validacao = esquemaNome.safeParse(nome);
  if (!idValido.success) return falha('Fornecedor inválido.');
  if (!validacao.success) return falha(validacao.error.issues[0]?.message ?? 'Nome inválido.');
  const { data, error } = await supabase
    .from('fornecedores')
    .update({ nome: validacao.data })
    .eq('id', idValido.data)
    .select('id');
  if (error) return falha(mensagemDeErro(error, 'renomear fornecedor'));
  if (!data?.length) return falha('Fornecedor não encontrado.');
  revalidarTudo();
  return sucesso(undefined, 'Fornecedor atualizado!');
}

export async function excluirFornecedor(id: unknown): Promise<ResultadoAcao> {
  const { supabase } = await exigirUsuario();
  const idValido = esquemaId.safeParse(id);
  if (!idValido.success) return falha('Fornecedor inválido.');
  const { data, error } = await supabase.from('fornecedores').delete().eq('id', idValido.data).select('id');
  if (error) return falha(mensagemDeErro(error, 'excluir fornecedor', { emUso: FORNECEDOR_EM_USO }));
  if (!data?.length) return falha('Fornecedor não encontrado.');
  revalidarTudo();
  return sucesso(undefined, 'Fornecedor excluído.');
}
