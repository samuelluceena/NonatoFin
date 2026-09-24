import type { Metadata } from 'next';
import Link from 'next/link';
import { History } from 'lucide-react';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { Cartao } from '@/components/ui/cartao';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { FiltroPeriodo } from '@/components/ui/filtro-periodo';
import { Valor } from '@/components/ui/valor';
import { listarHistorico } from '@/features/lancamentos/consultas';
import { FiltrosHistorico } from '@/features/historico/filtros-historico';
import { obterContextoEmpresas } from '@/features/empresas/consultas';
import { listarFornecedores } from '@/features/fornecedores/consultas';
import { exigirUsuario } from '@/lib/auth/sessao';
import { ehDataISOValida, formatarData, formatarDataHora } from '@/lib/domain/datas';
import { somarCentavos } from '@/lib/domain/dinheiro';
import { idDaBusca, textoDaBusca } from '@/lib/parametros';

export const metadata: Metadata = { title: 'Histórico' };

export default async function PaginaHistorico({ searchParams }: PageProps<'/historico'>) {
  const { supabase } = await exigirUsuario();
  const sp = await searchParams;
  const busca = textoDaBusca(sp.q, 80);
  const fornecedorId = idDaBusca(sp.fornecedor);
  const de = ehDataISOValida(textoDaBusca(sp.de)) ? textoDaBusca(sp.de) : '';
  const ate = ehDataISOValida(textoDaBusca(sp.ate)) ? textoDaBusca(sp.ate) : '';

  const { empresaId } = await obterContextoEmpresas();
  const [fornecedores, { lancamentos, truncado }] = await Promise.all([
    listarFornecedores(supabase),
    listarHistorico(supabase, {
      empresaId,
      fornecedorId: fornecedorId || undefined,
      pagoDe: de || undefined,
      pagoAte: ate || undefined,
      busca,
    }),
  ]);
  const total = somarCentavos(lancamentos.map((b) => b.valorCentavos));

  return (
    <>
      <CabecalhoPagina
        titulo="Histórico de pagamentos"
        subtitulo={
          <span data-testid="resumo-historico">
            {lancamentos.length} {lancamentos.length === 1 ? 'pagamento' : 'pagamentos'} · <Valor centavos={total} />
          </span>
        }
      />
      <div className="mb-5 flex flex-col gap-3">
        <FiltrosHistorico busca={busca} fornecedorId={fornecedorId} fornecedores={fornecedores} de={de} ate={ate} />
        <FiltroPeriodo acao="/historico" de={de} ate={ate} manter={{ q: busca, fornecedor: fornecedorId }} rotuloDe="Pago de" rotuloAte="até" />
      </div>

      {lancamentos.length === 0 ? (
        <EstadoVazio icone={<History />} titulo="Nenhum pagamento encontrado" descricao="Boletos marcados como pagos aparecem aqui." />
      ) : (
        <Cartao className="divide-y divide-border" data-testid="lista-historico">
          {lancamentos.map((b) => (
            <Link key={b.id} href={`/boletos/${b.id}`} className="flex flex-col gap-1 px-4 py-3.5 hover:bg-surface-2 sm:flex-row sm:items-center sm:gap-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-fg">{b.fornecedor.nome}</p>
                <p className="truncate text-sm text-fg-2">
                  {b.descricao}
                  {b.recorrencia && ` · Parcela ${b.recorrencia.parcela}/${b.recorrencia.totalParcelas}`}
                </p>
              </div>
              <div className="flex items-baseline justify-between gap-4 sm:flex-col sm:items-end sm:gap-0.5">
                <Valor centavos={b.valorCentavos} className="text-[15px] font-semibold text-fg" />
                <p className="text-[13px] text-fg-3">
                  Venc. {formatarData(b.vencimento)}
                </p>
              </div>
              <p className="text-[13px] text-success sm:w-44 sm:text-right">{b.pagoEm ? `Pago em ${formatarDataHora(b.pagoEm)}` : 'Pago'}</p>
            </Link>
          ))}
        </Cartao>
      )}
      {truncado && <p className="mt-6 text-center text-sm text-fg-3">Mostrando os {lancamentos.length} pagamentos mais recentes. Use os filtros para refinar.</p>}
    </>
  );
}
