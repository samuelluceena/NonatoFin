import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Plus } from 'lucide-react';
import { LinkBotao } from '@/components/ui/botao';
import { Cartao, TituloSecao } from '@/components/ui/cartao';
import { ChipsFiltro } from '@/components/ui/chips-filtro';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { FiltroPeriodo } from '@/components/ui/filtro-periodo';
import { Metrica, PainelMetricas } from '@/components/ui/metrica';
import { Valor } from '@/components/ui/valor';
import { listarLancamentosDoFornecedor } from '@/features/lancamentos/consultas';
import { ListaLancamentos } from '@/features/lancamentos/componentes/lista-lancamentos';
import { carregarBaseRelatorios } from '@/features/dashboard/dados';
import { AcoesFornecedor } from '@/features/fornecedores/componentes/acoes-fornecedor';
import { obterFornecedor } from '@/features/fornecedores/consultas';
import { obterContextoEmpresas } from '@/features/empresas/consultas';
import { exigirUsuario } from '@/lib/auth/sessao';
import { ehDataISOValida, formatarData, hojeISO } from '@/lib/domain/datas';
import { somarCentavos } from '@/lib/domain/dinheiro';
import { resumirStatus } from '@/lib/domain/indicadores';
import type { StatusLancamento } from '@/lib/domain/tipos';
import { idDaRota } from '@/lib/parametros';

export const metadata: Metadata = { title: 'Fornecedor' };

const FILTROS: { valor: StatusLancamento | 'todos'; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'pendente', rotulo: 'Pendentes' },
  { valor: 'pago', rotulo: 'Pagos' },
  { valor: 'atrasado', rotulo: 'Atrasados' },
];

export default async function PaginaFornecedor({ params, searchParams }: PageProps<'/fornecedores/[id]'>) {
  const id = idDaRota((await params).id);
  const { supabase } = await exigirUsuario();
  const sp = await searchParams;
  const status = FILTROS.find((f) => f.valor === sp.status)?.valor ?? 'todos';
  const de = typeof sp.de === 'string' && ehDataISOValida(sp.de) ? sp.de : '';
  const ate = typeof sp.ate === 'string' && ehDataISOValida(sp.ate) ? sp.ate : '';

  const fornecedor = await obterFornecedor(supabase, id);
  if (!fornecedor) notFound();

  const hoje = hojeISO();
  const { empresaId } = await obterContextoEmpresas();
  const [{ resumos }, lancamentos] = await Promise.all([
    carregarBaseRelatorios(),
    listarLancamentosDoFornecedor(supabase, id, hoje, {
      empresaId,
      status: status === 'todos' ? undefined : status,
      vencimentoDe: de || undefined,
      vencimentoAte: ate || undefined,
    }),
  ]);
  const doFornecedor = resumos.filter((r) => r.fornecedorId === id);
  const resumo = resumirStatus(doFornecedor, hoje);
  const futuras = doFornecedor.filter((r) => r.status === 'pendente' && r.vencimento >= hoje);
  const proximo = futuras[0]?.vencimento ?? null; // resumos vêm ordenados por vencimento

  const url = (s: string) => {
    const q = new URLSearchParams();
    if (s !== 'todos') q.set('status', s);
    if (de) q.set('de', de);
    if (ate) q.set('ate', ate);
    const qs = q.toString();
    return `/fornecedores/${id}${qs ? `?${qs}` : ''}`;
  };

  return (
    <>
      <Link href="/fornecedores" className="mb-4 inline-flex h-10 items-center gap-1.5 text-sm font-medium text-fg-2 hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden="true" /> Fornecedores
      </Link>

      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-title font-semibold break-words text-fg">{fornecedor.nome}</h1>
          <p className="mt-1 text-body text-fg-2">
            {resumo.quantidadeTotal} {resumo.quantidadeTotal === 1 ? 'boleto' : 'boletos'}
            {proximo ? ` · próximo vencimento ${formatarData(proximo)}` : ' · sem vencimentos futuros'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkBotao href={`/boletos/novo?fornecedor=${id}`} icone={<Plus className="size-5" aria-hidden="true" />}>
            Novo boleto
          </LinkBotao>
          <AcoesFornecedor id={id} nome={fornecedor.nome} quantidadeLancamentos={resumo.quantidadeTotal} />
        </div>
      </header>

      <PainelMetricas rotulo="Totais do fornecedor" className="grid-cols-2 lg:grid-cols-4">
        <Metrica rotulo="Valor total" valor={resumo.totalCentavos} detalhe={`${resumo.quantidadeTotal} boletos`} testId="forn-total" />
        <Metrica rotulo="A pagar" valor={resumo.pendenteCentavos} detalhe={`${resumo.quantidadePendente} pendentes`} testId="forn-pendente" />
        <Metrica rotulo="Pago" valor={resumo.pagoCentavos} detalhe={`${resumo.quantidadePaga} pagos`} testId="forn-pago" />
        <Metrica rotulo="Atrasado" valor={resumo.atrasadoCentavos} detalhe={`${resumo.quantidadeAtrasada} atrasados`} tom="perigo" testId="forn-atrasado" />
      </PainelMetricas>

      <Cartao className="mt-4 flex items-center justify-between gap-3 p-4 text-sm">
        <span className="text-fg-2">Parcelas futuras em aberto</span>
        <span className="font-medium text-fg">
          {futuras.length} · <Valor centavos={somarCentavos(futuras.map((f) => f.valorCentavos))} />
        </span>
      </Cartao>

      <section aria-labelledby="titulo-contas" className="mt-8">
        <TituloSecao id="titulo-contas" className="mb-3 px-1">
          Contas
        </TituloSecao>
        <div className="mb-5 flex flex-col gap-3">
          <ChipsFiltro rotulo="Filtrar por status" chips={FILTROS.map((f) => ({ href: url(f.valor), rotulo: f.rotulo, ativo: f.valor === status }))} />
          <FiltroPeriodo
            acao={`/fornecedores/${id}`}
            de={de}
            ate={ate}
            manter={{ status: status === 'todos' ? '' : status }}
            rotuloDe="Vencimento de"
            rotuloAte="até"
          />
        </div>
        {lancamentos.length === 0 ? (
          <EstadoVazio titulo="Nenhum boleto para este filtro" descricao="Escolha outro status ou período para ver os boletos deste fornecedor." />
        ) : (
          <ListaLancamentos lancamentos={lancamentos} hoje={hoje} />
        )}
      </section>
    </>
  );
}
