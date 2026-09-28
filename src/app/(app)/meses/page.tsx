import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, CalendarRange, ChevronRight } from 'lucide-react';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { LinkBotao } from '@/components/ui/botao';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { Valor } from '@/components/ui/valor';
import { carregarBaseRelatorios } from '@/features/dashboard/dados';
import { exigirUsuario } from '@/lib/auth/sessao';
import { chaveDoMes, formatarMes, hojeISO } from '@/lib/domain/datas';
import { resumoPorMes } from '@/lib/domain/indicadores';
import { cn } from '@/lib/utils/cn';

export const metadata: Metadata = { title: 'Contas por mês' };

export default async function PaginaMeses() {
  await exigirUsuario();
  const hoje = hojeISO();
  const mesAtual = chaveDoMes(hoje);
  const { resumos } = await carregarBaseRelatorios();
  const meses = resumoPorMes(resumos, hoje);

  return (
    <>
      <CabecalhoPagina titulo="Contas por mês" subtitulo="Agrupadas pelo mês de vencimento." />
      {meses.length === 0 ? (
        <EstadoVazio icone={<CalendarRange />} titulo="Nenhum boleto cadastrado" descricao="Os meses aparecem aqui assim que houver boletos com vencimento." acao={<LinkBotao href="/boletos/novo">Novo boleto</LinkBotao>} />
      ) : (
        <ol className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {meses.map((m) => {
            const aberto = m.pendenteCentavos + m.atrasadoCentavos;
            const pct = m.totalCentavos > 0 ? Math.round((m.pagoCentavos / m.totalCentavos) * 100) : 0;
            return (
              <li key={m.mes}>
                <Link
                  href={`/meses/${m.mes}`}
                  data-testid="cartao-mes"
                  className={cn(
                    'group block rounded-lg border bg-surface p-4 transition-colors hover:border-border-strong',
                    m.mes === mesAtual ? 'border-info-border' : 'border-border',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-fg group-hover:text-primary-text">
                        {formatarMes(m.mes)}
                        {m.mes === mesAtual && <span className="ml-2 rounded-sm bg-primary-soft px-1.5 py-0.5 text-caption text-primary-soft-fg normal-case">mês atual</span>}
                      </h2>
                      <p className="text-sm text-fg-2">
                        {m.quantidadeTotal} {m.quantidadeTotal === 1 ? 'boleto' : 'boletos'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Valor centavos={m.totalCentavos} className="text-lg font-semibold text-fg" />
                      <ChevronRight className="size-4 text-fg-3" aria-hidden="true" />
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-[4px] bg-chart-track" aria-hidden="true">
                    <div className="h-full rounded-[4px] bg-chart-2" style={{ width: `${pct}%` }} />
                  </div>
                  <dl className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-meta">
                    <div className="flex gap-1"><dt className="text-fg-3">Pago</dt><dd><Valor centavos={m.pagoCentavos} className="text-fg-2" /></dd></div>
                    <div className="flex gap-1"><dt className="text-fg-3">Em aberto</dt><dd><Valor centavos={aberto} className="text-fg-2" /></dd></div>
                    {m.quantidadeAtrasada > 0 && (
                      <div className="flex items-center gap-1 text-danger">
                        <AlertTriangle className="size-3.5" aria-hidden="true" />
                        <dt>Atrasado</dt>
                        <dd><Valor centavos={m.atrasadoCentavos} /></dd>
                      </div>
                    )}
                  </dl>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
