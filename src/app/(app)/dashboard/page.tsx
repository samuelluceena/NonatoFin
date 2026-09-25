import type { Metadata } from 'next';
import { AlertTriangle, CheckCircle2, CircleAlert, Landmark } from 'lucide-react';
import { BarrasComparativas } from '@/components/graficos/barras-comparativas';
import { BarrasFornecedores } from '@/components/graficos/barras-fornecedores';
import { ComposicaoStatus } from '@/components/graficos/composicao-status';
import { GraficoMensal } from '@/components/graficos/grafico-mensal';
import { LinkBotao } from '@/components/ui/botao';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { CabecalhoSecao } from '@/components/ui/cabecalho-secao';
import { Cartao } from '@/components/ui/cartao';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { Metrica, PainelMetricas } from '@/components/ui/metrica';
import { Selo } from '@/components/ui/selo';
import { Valor } from '@/components/ui/valor';
import { listarContas, saldosDasContas } from '@/features/contas/consultas';
import { carregarBaseRelatorios } from '@/features/dashboard/dados';
import { AvisoSemEmpresa } from '@/features/empresas/componentes/aviso-sem-empresa';
import { listarCategorias, obterContextoEmpresas } from '@/features/empresas/consultas';
import { exigirUsuario } from '@/lib/auth/sessao';
import { adicionarMesesNaChave, chaveDoMes, fimDoMes, formatarData, hojeISO } from '@/lib/domain/datas';
import { somarCentavos } from '@/lib/domain/dinheiro';
import { linkDaLista } from '@/lib/domain/filtros';
import { calcularIndicadores, resumirStatus, resumoPorFornecedor, resumoPorGrupo, serieMensal } from '@/lib/domain/indicadores';
import { agruparSaldos, cobertura } from '@/lib/domain/saldos';

export const metadata: Metadata = { title: 'Dashboard' };

const LINK_ATRASADOS = linkDaLista({ periodo: { tipo: 'todos' }, status: 'atrasados' });
const LINK_A_VENCER = linkDaLista({ periodo: { tipo: 'todos' }, status: 'pendentes' });

const qtd = (n: number) => `${n} ${n === 1 ? 'boleto' : 'boletos'}`;

/**
 * Dashboard em níveis de importância:
 * 1. situação atual (saldo, o que vence até o fim do mês, atrasados);
 * 2. próximos compromissos; 3. resumo (pago no mês, futuro, quantidades);
 * 4. tendência por mês e composição por status; 5. distribuição.
 * Só apresentação: os números vêm de lib/domain/indicadores.ts e saldos.ts.
 */
export default async function PaginaDashboard() {
  const { supabase } = await exigirUsuario();
  const hoje = hojeISO();
  const [{ resumos, fornecedores }, { empresas, selecionada, empresaId }, categorias] = await Promise.all([
    carregarBaseRelatorios(),
    obterContextoEmpresas(),
    listarCategorias(),
  ]);

  if (empresas.length === 0) {
    return (
      <>
        <CabecalhoPagina titulo="Dashboard" />
        <AvisoSemEmpresa />
      </>
    );
  }

  if (resumos.length === 0) {
    return (
      <>
        <CabecalhoPagina titulo="Dashboard" />
        <EstadoVazio
          titulo="Ainda não há boletos"
          descricao="Cadastre seu primeiro boleto para ver os indicadores."
          acao={<LinkBotao href="/boletos/novo">Novo boleto</LinkBotao>}
        />
      </>
    );
  }

  const [contas, saldos] = await Promise.all([listarContas(supabase, { empresaId, somenteAtivas: true }), saldosDasContas(supabase)]);
  const saldo = agruparSaldos(contas, saldos);
  const ind = calcularIndicadores(resumos, hoje);
  // Até o fim do mês = o que vence de hoje até o fim do mês + o que já venceu (mesma soma da tela Contas).
  const aPagarAteFimDoMes = somarCentavos([ind.mes.totalCentavos, ind.atrasados.totalCentavos]);
  const quantidadeAteFimDoMes = ind.mes.quantidade + ind.atrasados.quantidade;
  const coberturaDoMes = cobertura(saldo.totalCentavos, aPagarAteFimDoMes);
  // Lista com exatamente o mesmo conjunto: em aberto com vencimento até o fim do mês.
  const linkAteFimDoMes = linkDaLista({ periodo: { tipo: 'intervalo', de: '', ate: fimDoMes(hoje) }, status: 'em-aberto' });

  const geral = resumirStatus(resumos, hoje);
  const porFornecedor = resumoPorFornecedor(resumos, fornecedores, hoje);
  const porCategoria = resumoPorGrupo(resumos, categorias, (b) => b.categoriaId, hoje).map((r) => ({
    id: r.id,
    nome: r.nome,
    href: linkDaLista({ periodo: { tipo: 'todos' }, categoriaId: r.id }),
    resumo: r,
  }));
  const porEmpresa =
    !selecionada && empresas.length > 1
      ? resumoPorGrupo(
          resumos,
          empresas.map((e) => ({ id: e.id, nome: e.apelido })),
          (b) => b.empresaId,
          hoje,
        ).map((r) => ({ id: r.id, nome: r.nome, resumo: r }))
      : [];
  const mesAtual = chaveDoMes(hoje);
  const meses = serieMensal(resumos, hoje, adicionarMesesNaChave(mesAtual, -1), 8);

  return (
    <>
      <CabecalhoPagina
        titulo="Dashboard"
        subtitulo={`${selecionada ? `${selecionada.apelido} · ` : empresas.length > 1 ? 'Todas as empresas · ' : ''}Situação em ${formatarData(hoje)}`}
      />
      <div className="flex flex-col gap-8">

        {/* 1. Situação atual */}
        <PainelMetricas rotulo="Situação atual" className="grid-cols-1 sm:grid-cols-3">
          {contas.length > 0 ? (
            <Metrica
              nivel="destaque"
              rotulo="Saldo disponível"
              icone={<Landmark aria-hidden="true" />}
              valor={saldo.totalCentavos}
              tom="saldo"
              detalhe={`${contas.length} ${contas.length === 1 ? 'conta ativa' : 'contas ativas'}`}
              href="/contas"
              testId="kpi-saldo"
            />
          ) : (
            <div className="flex flex-col justify-between gap-3 bg-surface p-5">
              <p className="text-meta font-medium text-fg-3">Saldo disponível</p>
              <p className="text-sm text-fg-2">Cadastre as contas bancárias para acompanhar o saldo aqui.</p>
              <LinkBotao href="/contas/nova" variante="secundario" tamanho="sm" className="self-start">
                Cadastrar conta
              </LinkBotao>
            </div>
          )}
          <Metrica
            nivel="destaque"
            rotulo="A pagar até o fim do mês"
            valor={aPagarAteFimDoMes}
            detalhe={`${qtd(quantidadeAteFimDoMes)}${ind.atrasados.quantidade > 0 ? ' · inclui atrasados' : ''}`}
            href={linkAteFimDoMes}
            testId="kpi-ate-fim-do-mes"
            extra={
              contas.length > 0 &&
              (coberturaDoMes.cobre ? (
                <Selo tom="sucesso" data-testid="cobertura-mes">
                  <CheckCircle2 aria-hidden="true" /> Saldo cobre
                </Selo>
              ) : (
                <Selo tom="aviso" data-testid="cobertura-mes">
                  <CircleAlert aria-hidden="true" /> Faltam <Valor centavos={coberturaDoMes.faltaCentavos} />
                </Selo>
              ))
            }
          />
          <Metrica
            nivel="destaque"
            rotulo="Atrasados"
            icone={ind.atrasados.quantidade > 0 ? <AlertTriangle className="text-danger" aria-hidden="true" /> : undefined}
            valor={ind.atrasados.totalCentavos}
            tom="perigo"
            detalhe={ind.atrasados.quantidade > 0 ? `${qtd(ind.atrasados.quantidade)} vencidos e não pagos` : 'Nenhum boleto atrasado'}
            href={LINK_ATRASADOS}
            testId="kpi-atrasados"
          />
        </PainelMetricas>

        {/* 2. Próximos compromissos */}
        <section aria-labelledby="titulo-compromissos">
          <CabecalhoSecao id="titulo-compromissos" titulo="Próximos compromissos" detalhe="Em aberto, sem os atrasados" />
          <PainelMetricas rotulo="Próximos compromissos" className="grid-cols-2 lg:grid-cols-5">
            <Metrica rotulo="Hoje" valor={ind.hoje.totalCentavos} detalhe={qtd(ind.hoje.quantidade)} href="/" testId="kpi-hoje" />
            <Metrica rotulo="Amanhã" valor={ind.amanha.totalCentavos} detalhe={qtd(ind.amanha.quantidade)} href={linkDaLista({ periodo: { tipo: 'amanha' } })} testId="kpi-amanha" />
            <Metrica rotulo="Esta semana" valor={ind.semana.totalCentavos} detalhe={`${qtd(ind.semana.quantidade)} até domingo`} href={linkDaLista({ periodo: { tipo: 'semana' } })} testId="kpi-semana" />
            <Metrica rotulo="Este mês" valor={ind.mes.totalCentavos} detalhe={`${qtd(ind.mes.quantidade)} até o fim do mês`} href={linkDaLista({ periodo: { tipo: 'mes' } })} testId="kpi-mes" />
            <Metrica
              rotulo="Próximo mês"
              valor={ind.proximoMes.totalCentavos}
              detalhe={qtd(ind.proximoMes.quantidade)}
              href={linkDaLista({ periodo: { tipo: 'proximo-mes' } })}
              testId="kpi-proximo-mes"
              className="col-span-2 lg:col-span-1"
            />
          </PainelMetricas>
        </section>

        {/* 3. Resumo */}
        <PainelMetricas rotulo="Resumo" className="grid-cols-2 lg:grid-cols-4">
          <Metrica nivel="compacta" rotulo="Pago no mês" valor={ind.pagoNoMes.totalCentavos} detalhe={qtd(ind.pagoNoMes.quantidade)} href="/historico" testId="kpi-pago-mes" />
          <Metrica nivel="compacta" rotulo="Total futuro a pagar" valor={ind.futuro.totalCentavos} detalhe={qtd(ind.futuro.quantidade)} href={LINK_A_VENCER} testId="kpi-futuro" />
          <Metrica nivel="compacta" rotulo="Boletos pendentes" valor={ind.pendentes} tipo="contagem" detalhe="A vencer" href={LINK_A_VENCER} testId="kpi-qtd-pendentes" />
          <Metrica
            nivel="compacta"
            rotulo="Boletos atrasados"
            valor={ind.atrasadosQuantidade}
            tipo="contagem"
            tom="perigo"
            detalhe="Vencidos"
            href={LINK_ATRASADOS}
            testId="kpi-qtd-atrasados"
          />
        </PainelMetricas>

        {/* 4. Tendência e composição */}
        <div className="grid gap-6 lg:grid-cols-5">
          <section aria-labelledby="titulo-meses" className="min-w-0 lg:col-span-3">
            <CabecalhoSecao id="titulo-meses" titulo="Valores por mês" link={{ href: '/meses', rotulo: 'Ver meses' }} />
            <Cartao className="p-4 sm:p-5">
              <GraficoMensal meses={meses} mesAtual={mesAtual} />
            </Cartao>
          </section>
          <section aria-labelledby="titulo-composicao" className="min-w-0 lg:col-span-2">
            <CabecalhoSecao id="titulo-composicao" titulo="Pago × pendente × atrasado" detalhe="Todos os boletos" />
            <Cartao className="p-4 sm:p-5">
              <ComposicaoStatus resumo={geral} />
            </Cartao>
          </section>
        </div>

        {/* 5. Distribuição */}
        <div className="grid gap-6 lg:grid-cols-2">
          <section aria-labelledby="titulo-fornecedores" className="min-w-0">
            <CabecalhoSecao id="titulo-fornecedores" titulo="Por fornecedor" link={{ href: '/fornecedores', rotulo: 'Ver todos' }} />
            <Cartao className="p-4 sm:p-5">
              <BarrasFornecedores resumos={porFornecedor} />
            </Cartao>
          </section>
          <section aria-labelledby="titulo-categorias" data-testid="secao-por-categoria" className="min-w-0">
            <CabecalhoSecao id="titulo-categorias" titulo="Por categoria" link={{ href: '/configuracoes/categorias', rotulo: 'Categorias' }} />
            <Cartao className="p-4 sm:p-5">
              <BarrasComparativas nome="metrica-categoria" rotulo="Comparar categorias por" itens={porCategoria} />
            </Cartao>
          </section>
          {porEmpresa.length > 0 && (
            <section aria-labelledby="titulo-empresas" data-testid="secao-por-empresa" className="min-w-0">
              <CabecalhoSecao id="titulo-empresas" titulo="Por empresa" />
              <Cartao className="p-4 sm:p-5">
                <BarrasComparativas nome="metrica-empresa" rotulo="Comparar empresas por" itens={porEmpresa} />
              </Cartao>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
