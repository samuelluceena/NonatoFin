import 'server-only';
import { mensagemDeErro } from '@/lib/acoes/erros';
import type { Fornecedor } from '@/lib/domain/tipos';
import type { ClienteSupabase } from '@/lib/supabase/server';
import { ErroConsulta } from '@/lib/supabase/consultas';

export async function listarFornecedores(supabase: ClienteSupabase): Promise<Fornecedor[]> {
  const { data, error } = await supabase
    .from('fornecedores')
    .select('id, nome')
    .order('nome_normalizado', { ascending: true })
    .limit(5000);
  if (error) throw new ErroConsulta(mensagemDeErro(error, 'listar fornecedores'));
  return data ?? [];
}

export async function obterFornecedor(supabase: ClienteSupabase, id: string): Promise<Fornecedor | null> {
  const { data, error } = await supabase.from('fornecedores').select('id, nome').eq('id', id).maybeSingle();
  if (error) throw new ErroConsulta(mensagemDeErro(error, 'obter fornecedor'));
  return data;
}
