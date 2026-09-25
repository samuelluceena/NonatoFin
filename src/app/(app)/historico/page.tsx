import type { Metadata } from 'next';
import { CheckCircle2, History } from 'lucide-react';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { IconeLista, LinhaLista, ListaPainel } from '@/components/ui/lista-painel';
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
      <FiltrosHistorico busca={busca} fornecedorId={fornecedorId} fornecedores={fornecedores} de={de} ate={ate} />

      {lancamentos.length === 0 ? (
        <EstadoVazio
          icone={<History />}
          titulo="Nenhum pagamento encontrado"
          descricao={busca || fornecedorId || de || ate ? 'Nenhum pagamento corresponde aos filtros aplicados.' : 'Boletos marcados como pagos aparecem aqui.'}
        />
      ) : (
        <ListaPainel data-testid="lista-historico">
          {lancamentos.map((b) => (
            <LinhaLista
              key={b.id}
              href={`/boletos/${b.id}`}
              inicio={
                <IconeLista className="border-success-border bg-success-soft text-success">
                  <CheckCircle2 />
                </IconeLista>
              }
              titulo={b.fornecedor.nome}
              descricao={[b.descricao, b.recorrencia && `Parcela ${b.recorrencia.parcela}/${b.recorrencia.totalParcelas}`, `Vencimento ${formatarData(b.vencimento)}`]
                .filter(Boolean)
                .join(' · ')}
              fim={
                <>
                  <Valor centavos={b.valorCentavos} className="text-body font-semibold text-fg" />
                  <span className="text-meta text-fg-3">{b.pagoEm ? `Pago em ${formatarDataHora(b.pagoEm)}` : 'Pago'}</span>
                </>
              }
            />
          ))}
        </ListaPainel>
      )}
      {truncado && <p className="mt-6 text-center text-sm text-fg-3">Mostrando os {lancamentos.length} pagamentos mais recentes. Use os filtros para refinar.</p>}
    </>
  );
}
