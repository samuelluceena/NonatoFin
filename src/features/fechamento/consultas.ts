import 'server-only';
/**
 * Dados do "Fechar o dia" (leitura, sempre com RLS). O texto em si é montado
 * por lib/domain/fechamento.ts — aqui só se busca e converte.
 */
import { listarContas, saldosDasContas } from '@/features/contas/consultas';
import { listarHistorico, listarLancamentos } from '@/features/lancamentos/consultas';
import { adicionarDias, type DataISO } from '@/lib/domain/datas';
import { proximoDiaUtil } from '@/lib/domain/dias-uteis';
import type { DadosFechamento, ItemFechamento } from '@/lib/domain/fechamento';
import { rotuloConta } from '@/lib/domain/saldos';
import type { Lancamento } from '@/lib/domain/tipos';
import type { ClienteSupabase } from '@/lib/supabase/server';

const paraItem = (l: Lancamento): ItemFechamento => ({
  fornecedor: l.fornecedor.nome,
  descricao: l.descricao,
  valorCentavos: l.valorCentavos,
  vencimento: l.vencimento,
  contaId: l.conta?.id ?? null,
});

export interface Fechamento {
  dados: DadosFechamento;
  /** Alguma lista passou do limite da tela (o texto ficaria incompleto). */
  truncado: boolean;
}

export async function carregarFechamento(
  supabase: ClienteSupabase,
  hoje: DataISO,
  empresa: { id: string; apelido: string } | null,
  mostrarEmpresaNaConta: boolean,
): Promise<Fechamento> {
  const empresaId = empresa?.id;
  const util = proximoDiaUtil(hoje);
  const [contas, saldos, pagas, pendentes, proximas] = await Promise.all([
    listarContas(supabase, { empresaId, somenteAtivas: true }),
    saldosDasContas(supabase),
    listarHistorico(supabase, { empresaId, pagoDe: hoje, pagoAte: hoje }),
    listarLancamentos(supabase, { criterio: { status: 'pendente', vencimentoAte: hoje, ordem: 'asc' }, empresaId }),
    // Inclui o que vence no fim de semana/feriado antes do próximo dia útil.
    listarLancamentos(supabase, { criterio: { status: 'pendente', vencimentoDe: adicionarDias(hoje, 1), vencimentoAte: util, ordem: 'asc' }, empresaId }),
  ]);
  return {
    dados: {
      hoje,
      proximoDiaUtil: util,
      empresa: empresa?.apelido ?? null,
      contas: contas.map((c) => ({
        id: c.id,
        rotulo: `${rotuloConta(c)}${mostrarEmpresaNaConta ? ` (${c.empresa.apelido})` : ''}`,
        saldoCentavos: saldos.get(c.id) ?? 0,
      })),
      // Pagas: do pagamento mais antigo para o mais recente (ordem do dia).
      pagasHoje: [...pagas.lancamentos].reverse().map(paraItem),
      pendentes: pendentes.lancamentos.map(paraItem),
      proximas: proximas.lancamentos.map(paraItem),
    },
    truncado: pagas.truncado || pendentes.truncado || proximas.truncado,
  };
}
