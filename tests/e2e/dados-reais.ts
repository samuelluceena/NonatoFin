/**
 * Lê os boletos do usuário E2E direto do banco (via service role, somente
 * no teste) para conferir se o que a tela mostra bate exatamente com os dados.
 */
import { createClient } from '@supabase/supabase-js';
import { dataNoFuso } from '../../src/lib/domain/datas';
import type { LancamentoResumo, Fornecedor } from '../../src/lib/domain/tipos';

export async function dadosDoUsuarioE2E(): Promise<{ resumos: LancamentoResumo[]; fornecedores: Fornecedor[] }> {
  const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: usuarios } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const id = usuarios.users.find((u) => u.email === process.env.E2E_EMAIL)!.id;
  const { data: boletos, error } = await admin
    .from('lancamentos')
    .select('id, fornecedor_id, empresa_id, categoria_id, conta_id, valor_centavos, vencimento, status, pago_em')
    .eq('user_id', id)
    .limit(10000);
  if (error) throw error;
  const { data: fornecedores } = await admin.from('fornecedores').select('id, nome').eq('user_id', id);
  return {
    resumos: (boletos ?? []).map((b) => ({
      id: b.id,
      fornecedorId: b.fornecedor_id,
      empresaId: b.empresa_id,
      categoriaId: b.categoria_id,
      contaId: b.conta_id,
      valorCentavos: Number(b.valor_centavos),
      vencimento: b.vencimento,
      status: b.status,
      dataPagamento: b.pago_em ? dataNoFuso(b.pago_em) : null,
    })),
    fornecedores: fornecedores ?? [],
  };
}
