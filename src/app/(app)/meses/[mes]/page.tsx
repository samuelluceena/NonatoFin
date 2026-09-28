import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertTriangle, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { classesBotao } from '@/components/ui/botao';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { Metrica, PainelMetricas } from '@/components/ui/metrica';
import { listarLancamentosDoMes } from '@/features/lancamentos/consultas';
import { ListaLancamentos } from '@/features/lancamentos/componentes/lista-lancamentos';
import { exigirUsuario } from '@/lib/auth/sessao';
import { resumoDoLancamento } from '@/features/lancamentos/mapeadores';
import { obterContextoEmpresas } from '@/features/empresas/consultas';
import { adicionarMesesNaChave, ehChaveMesValida, formatarMes, hojeISO } from '@/lib/domain/datas';
import { resumirStatus } from '@/lib/domain/indicadores';

export async function generateMetadata({ params }: PageProps<'/meses/[mes]'>): Promise<Metadata> {
  const { mes } = await params;
  return { title: ehChaveMesValida(mes) ? formatarMes(mes) : 'Mês' };
}

export default async function PaginaMes({ params }: PageProps<'/meses/[mes]'>) {
  const { mes } = await params;
  if (!ehChaveMesValida(mes)) notFound();
  const { supabase } = await exigirUsuario();
  const hoje = hojeISO();
  const { empresaId } = await obterContextoEmpresas();
  const lancamentos = await listarLancamentosDoMes(supabase, mes, empresaId);
  const resumo = resumirStatus(lancamentos.map(resumoDoLancamento), hoje);
  const anterior = adicionarMesesNaChave(mes, -1);
  const proximo = adicionarMesesNaChave(mes, 1);

  return (
    <>
      <Link href="/meses" className="mb-4 inline-flex h-10 items-center gap-1.5 text-sm font-medium text-fg-2 hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden="true" /> Meses
      </Link>
      <CabecalhoPagina
        titulo={formatarMes(mes)}
        subtitulo={`${resumo.quantidadeTotal} ${resumo.quantidadeTotal === 1 ? 'boleto' : 'boletos'}`}
        acoes={
          <>
            <Link href={`/meses/${anterior}`} className={classesBotao('secundario', 'md')} aria-label={`Mês anterior: ${formatarMes(anterior)}`}>
              <ChevronLeft className="size-5" aria-hidden="true" /> Anterior
            </Link>
            <Link href={`/meses/${proximo}`} className={classesBotao('secundario', 'md')} aria-label={`Próximo mês: ${formatarMes(proximo)}`}>
              Próximo <ChevronRight className="size-5" aria-hidden="true" />
            </Link>
          </>
        }
      />
      <PainelMetricas rotulo="Totais do mês" className="grid-cols-2 lg:grid-cols-4">
        <Metrica rotulo="Total" valor={resumo.totalCentavos} detalhe={`${resumo.quantidadeTotal} boletos`} testId="mes-total" />
        <Metrica rotulo="Pendente" valor={resumo.pendenteCentavos} detalhe={`${resumo.quantidadePendente} boletos`} testId="mes-pendente" />
        <Metrica rotulo="Pago" valor={resumo.pagoCentavos} detalhe={`${resumo.quantidadePaga} boletos`} testId="mes-pago" />
        <Metrica
          rotulo="Atrasado"
          valor={resumo.atrasadoCentavos}
          detalhe={`${resumo.quantidadeAtrasada} boletos`}
          tom="perigo"
          icone={<AlertTriangle className="size-3.5" aria-hidden="true" />}
          testId="mes-atrasado"
        />
      </PainelMetricas>
      <div className="mt-8">
        {lancamentos.length === 0 ? <EstadoVazio titulo="Nenhum boleto neste mês" /> : <ListaLancamentos lancamentos={lancamentos} hoje={hoje} />}
      </div>
    </>
  );
}
