'use server';
/**
 * Empresas, categorias e empresa selecionada no topo.
 */
import { cookies } from 'next/headers';
import { z } from 'zod';
import { errosDeCampos, mensagemDeErro } from '@/lib/acoes/erros';
import { falha, sucesso, type ResultadoAcao } from '@/lib/acoes/resultado';
import { revalidarTudo } from '@/lib/acoes/revalidar';
import { esquemaId } from '@/lib/validacao';
import { exigirUsuario } from '@/lib/auth/sessao';
import { normalizarCnpj } from '@/lib/domain/cnpj';
import { COOKIE_EMPRESA, TODAS_EMPRESAS } from './constantes';
import { esquemaCategoria, esquemaEmpresa } from './esquemas';

const EMPRESA_EM_USO = 'Esta empresa tem lançamentos, cartões ou contas bancárias e não pode ser excluída.';
const CATEGORIA_EM_USO =
  'Esta categoria está em uso (lançamentos, compras ou cartões) e não pode ser excluída. Você pode renomeá-la.';

function linhaEmpresa(d: z.infer<typeof esquemaEmpresa>) {
  return {
    apelido: d.apelido,
    razao_social: d.razaoSocial === '' ? null : d.razaoSocial,
    cnpj: normalizarCnpj(d.cnpj) || null,
  };
}

export async function criarEmpresa(entrada: unknown): Promise<ResultadoAcao<{ id: string }>> {
  const { supabase } = await exigirUsuario();
  const v = esquemaEmpresa.safeParse(entrada);
  if (!v.success) return falha('Revise os campos destacados.', errosDeCampos(v.error));
  const { data, error } = await supabase.from('empresas').insert(linhaEmpresa(v.data)).select('id').single();
  if (error) return falha(mensagemDeErro(error, 'criar empresa'));
  revalidarTudo();
  return sucesso({ id: data.id }, 'Empresa cadastrada!');
}

export async function atualizarEmpresa(id: unknown, entrada: unknown): Promise<ResultadoAcao> {
  const { supabase } = await exigirUsuario();
  const idOk = esquemaId.safeParse(id);
  const v = esquemaEmpresa.safeParse(entrada);
  if (!idOk.success) return falha('Empresa inválida.');
  if (!v.success) return falha('Revise os campos destacados.', errosDeCampos(v.error));
  const { data, error } = await supabase.from('empresas').update(linhaEmpresa(v.data)).eq('id', idOk.data).select('id');
  if (error) return falha(mensagemDeErro(error, 'atualizar empresa'));
  if (!data?.length) return falha('Empresa não encontrada.');
  revalidarTudo();
  return sucesso(undefined, 'Empresa atualizada!');
}

export async function excluirEmpresa(id: unknown): Promise<ResultadoAcao> {
  const { supabase } = await exigirUsuario();
  const idOk = esquemaId.safeParse(id);
  if (!idOk.success) return falha('Empresa inválida.');
  const { data, error } = await supabase.from('empresas').delete().eq('id', idOk.data).select('id');
  if (error) return falha(mensagemDeErro(error, 'excluir empresa', { emUso: EMPRESA_EM_USO }));
  if (!data?.length) return falha('Empresa não encontrada.');
  revalidarTudo();
  return sucesso(undefined, 'Empresa excluída.');
}

/** Guarda a empresa escolhida no topo (cookie de 1 ano). */
export async function selecionarEmpresa(valor: unknown): Promise<ResultadoAcao> {
  await exigirUsuario();
  const escolha = valor === TODAS_EMPRESAS ? TODAS_EMPRESAS : esquemaId.safeParse(valor).data;
  if (!escolha) return falha('Empresa inválida.');
  (await cookies()).set(COOKIE_EMPRESA, escolha, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidarTudo();
  return sucesso(undefined);
}

// ------------------------------------------------------------- categorias ---

export async function criarCategoria(nome: unknown): Promise<ResultadoAcao<{ id: string }>> {
  const { supabase } = await exigirUsuario();
  const v = esquemaCategoria.safeParse(nome);
  if (!v.success) return falha(v.error.issues[0]?.message ?? 'Nome inválido.');
  const { data, error } = await supabase.from('categorias').insert({ nome: v.data }).select('id').single();
  if (error) return falha(mensagemDeErro(error, 'criar categoria'));
  revalidarTudo();
  return sucesso({ id: data.id }, 'Categoria criada!');
}

export async function renomearCategoria(id: unknown, nome: unknown): Promise<ResultadoAcao> {
  const { supabase } = await exigirUsuario();
  const idOk = esquemaId.safeParse(id);
  const v = esquemaCategoria.safeParse(nome);
  if (!idOk.success) return falha('Categoria inválida.');
  if (!v.success) return falha(v.error.issues[0]?.message ?? 'Nome inválido.');
  const { data, error } = await supabase.from('categorias').update({ nome: v.data }).eq('id', idOk.data).select('id');
  if (error) return falha(mensagemDeErro(error, 'renomear categoria'));
  if (!data?.length) return falha('Categoria não encontrada.');
  revalidarTudo();
  return sucesso(undefined, 'Categoria renomeada!');
}

export async function excluirCategoria(id: unknown): Promise<ResultadoAcao> {
  const { supabase } = await exigirUsuario();
  const idOk = esquemaId.safeParse(id);
  if (!idOk.success) return falha('Categoria inválida.');
  const { data, error } = await supabase.from('categorias').delete().eq('id', idOk.data).select('id');
  if (error) return falha(mensagemDeErro(error, 'excluir categoria', { emUso: CATEGORIA_EM_USO }));
  if (!data?.length) return falha('Categoria não encontrada.');
  revalidarTudo();
  return sucesso(undefined, 'Categoria excluída.');
}
