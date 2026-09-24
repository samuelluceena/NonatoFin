import 'server-only';
import { cache } from 'react';
import { listarResumos } from '@/features/lancamentos/consultas';
import { listarFornecedores } from '@/features/fornecedores/consultas';
import { obterContextoEmpresas } from '@/features/empresas/consultas';
import { criarClienteServidor } from '@/lib/supabase/server';

/**
 * Carrega (uma única vez por requisição, via React cache) os dados enxutos
 * usados pelo dashboard, fornecedores e meses. Os cálculos ficam em
 * lib/domain/indicadores.ts (funções puras e testadas).
 * Chame somente depois de exigirUsuario().
 */
export const carregarBaseRelatorios = cache(async () => {
  const supabase = await criarClienteServidor();
  const { empresaId } = await obterContextoEmpresas();
  const [resumos, fornecedores] = await Promise.all([listarResumos(supabase, empresaId), listarFornecedores(supabase)]);
  return { resumos, fornecedores };
});
