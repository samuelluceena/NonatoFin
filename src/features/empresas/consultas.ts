import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { mensagemDeErro } from '@/lib/acoes/erros';
import type { Categoria, Empresa } from '@/lib/domain/tipos';
import { criarClienteServidor, type ClienteSupabase } from '@/lib/supabase/server';
import { ErroConsulta } from '@/lib/supabase/consultas';
import { COOKIE_EMPRESA } from './constantes';

export async function listarEmpresas(supabase: ClienteSupabase): Promise<Empresa[]> {
  const { data, error } = await supabase
    .from('empresas')
    .select('id, apelido, razao_social, cnpj')
    .order('apelido_normalizado', { ascending: true });
  if (error) throw new ErroConsulta(mensagemDeErro(error, 'listar empresas'));
  return (data ?? []).map((e) => ({ id: e.id, apelido: e.apelido, razaoSocial: e.razao_social, cnpj: e.cnpj }));
}

export interface ContextoEmpresas {
  empresas: Empresa[];
  /** Empresa escolhida no seletor do topo (null = todas). */
  selecionada: Empresa | null;
  /** Atalho para filtros: id da selecionada ou undefined. */
  empresaId: string | undefined;
}

/**
 * Empresas do usuário + a selecionada no topo (cookie). Carregado uma vez por
 * requisição. Com uma única empresa, não há filtro (equivale a "todas").
 */
export const obterContextoEmpresas = cache(async (): Promise<ContextoEmpresas> => {
  const supabase = await criarClienteServidor();
  const empresas = await listarEmpresas(supabase);
  const idCookie = (await cookies()).get(COOKIE_EMPRESA)?.value;
  const selecionada = empresas.length > 1 ? (empresas.find((e) => e.id === idCookie) ?? null) : null;
  return { empresas, selecionada, empresaId: selecionada?.id };
});

/**
 * Categorias do usuário. Na primeira vez cria as categorias padrão
 * (Boleto de fornecedor, Empréstimo, Despesa fixa, Despesa variada, Cartão de crédito).
 */
export const listarCategorias = cache(async (): Promise<Categoria[]> => {
  const supabase = await criarClienteServidor();
  const buscar = () =>
    supabase.from('categorias').select('id, nome, ordem').order('ordem').order('nome_normalizado');
  const { data, error } = await buscar();
  if (error) throw new ErroConsulta(mensagemDeErro(error, 'listar categorias'));
  if (data.length > 0) return data;
  // Primeiro uso: cria as padrão. A função já devolve a lista (uma 2ª leitura
  // idêntica seria reaproveitada da memória da renderização e viria vazia).
  const r = await supabase.rpc('garantir_categorias_padrao');
  if (r.error) throw new ErroConsulta(mensagemDeErro(r.error, 'criar categorias padrão'));
  return r.data ?? [];
});
