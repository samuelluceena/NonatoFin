import type { Metadata } from 'next';
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
import { listarContas, saldosDasContas } from '@/features/contas/consultas';
import { ContasResumo } from '@/features/dashboard/componentes/contas-resumo';
import { DestaqueSaldo } from '@/features/dashboard/componentes/destaque-saldo';
import { type Compromisso, ListaCompromissos } from '@/features/dashboard/componentes/lista-compromissos';
import { carregarBaseRelatorios } from '@/features/dashboard/dados';
import { AvisoSemEmpresa } from '@/features/empresas/componentes/aviso-sem-empresa';
import { listarCategorias, obterContextoEmpresas } from '@/features/empresas/consultas';
import { AvisoLancamentosSemEmpresa } from '@/features/importacao/componentes/aviso-lancamentos-sem-empresa';
import { contarSemEmpresa } from '@/features/importacao/consultas';
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
 * 1. saldo disponível (principal), o que ele cobre até o fim do mês e atrasados;
 * 2. saldo por conta (contexto); 3. próximos compromissos e composição por status;
 * 4. resumo (pago no mês, futuro, quantidades); 5. tendência por mês; 6. distribuição.
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

  const [contas, saldos, semEmpresa] = await Promise.all([
    listarContas(supabase, { empresaId, somenteAtivas: true }),
    saldosDasContas(supabase),
    contarSemEmpresa(supabase),
  ]);
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
  // Lançamentos sem empresa (importados) formam um grupo próprio ('' = sem empresa).
  const porEmpresa =
    !selecionada && (empresas.length > 1 || semEmpresa.quantidade > 0)
      ? resumoPorGrupo(
          resumos,
          [...empresas.map((e) => ({ id: e.id, nome: e.apelido })), { id: '', nome: 'Sem empresa definida' }],
          (b) => b.empresaId,
          hoje,
        ).map((r) => ({ id: r.id || 'sem-empresa', nome: r.nome, href: r.id ? undefined : '/boletos/sem-empresa', resumo: r }))
      : [];
  const mesAtual = chaveDoMes(hoje);
  const meses = serieMensal(resumos, hoje, adicionarMesesNaChave(mesAtual, -1), 8);

  const compromissos: Compromisso[] = [
    { rotulo: 'Hoje', detalhe: qtd(ind.hoje.quantidade), totalCentavos: ind.hoje.totalCentavos, href: '/', testId: 'kpi-hoje' },
    { rotulo: 'Amanhã', detalhe: qtd(ind.amanha.quantidade), totalCentavos: ind.amanha.totalCentavos, href: linkDaLista({ periodo: { tipo: 'amanha' } }), testId: 'kpi-amanha' },
    { rotulo: 'Esta semana', detalhe: `${qtd(ind.semana.quantidade)} até domingo`, totalCentavos: ind.semana.totalCentavos, href: linkDaLista({ periodo: { tipo: 'semana' } }), testId: 'kpi-semana' },
    { rotulo: 'Este mês', detalhe: `${qtd(ind.mes.quantidade)} até o fim do mês`, totalCentavos: ind.mes.totalCentavos, href: linkDaLista({ periodo: { tipo: 'mes' } }), testId: 'kpi-mes' },
    { rotulo: 'Próximo mês', detalhe: qtd(ind.proximoMes.quantidade), totalCentavos: ind.proximoMes.totalCentavos, href: linkDaLista({ periodo: { tipo: 'proximo-mes' } }), testId: 'kpi-proximo-mes' },
  ];

  return (
    <>
      <CabecalhoPagina
        titulo="Dashboard"
        subtitulo={`${selecionada ? `${selecionada.apelido} · ` : empresas.length > 1 ? 'Todas as empresas · ' : ''}Situação em ${formatarData(hoje)}`}
      />
      <div className="flex flex-col gap-8 lg:gap-10">
        <AvisoLancamentosSemEmpresa
          contagem={semEmpresa}
          className="-mb-4 lg:-mb-6"
          complemento={
            selecionada
              ? `Não entram nos números de ${selecionada.apelido} até receberem uma empresa.`
              : 'Entram nos totais gerais, mas não em nenhuma conta nem empresa até você definir.'
          }
        />

        {/* 1. Posição financeira: saldo (principal), o que ele cobre e atrasados */}
        <DestaqueSaldo
          quantidadeContas={contas.length}
          saldoCentavos={saldo.totalCentavos}
          aPagar={{
            totalCentavos: aPagarAteFimDoMes,
            detalhe: `${qtd(quantidadeAteFimDoMes)}${ind.atrasados.quantidade > 0 ? ' · inclui atrasados' : ''}`,
            href: linkAteFimDoMes,
          }}
          cobertura={coberturaDoMes}
          atrasados={{
            totalCentavos: ind.atrasados.totalCentavos,
            quantidade: ind.atrasados.quantidade,
            detalhe: ind.atrasados.quantidade > 0 ? `${qtd(ind.atrasados.quantidade)} vencidos e não pagos` : 'Nenhum boleto atrasado',
            href: LINK_ATRASADOS,
          }}
        />

        {/* 2. Contas: contexto secundário do saldo */}
        <ContasResumo contas={saldo.empresas.flatMap((e) => e.contas)} />

        {/* 3. Próximos compromissos e composição por status */}
        <div className="grid gap-8 lg:grid-cols-5 lg:gap-6">
          <section aria-labelledby="titulo-compromissos" className="min-w-0 lg:col-span-3">
            <CabecalhoSecao id="titulo-compromissos" titulo="Próximos compromissos" detalhe="Em aberto, sem os atrasados" />
            <ListaCompromissos itens={compromissos} />
          </section>
          <section aria-labelledby="titulo-composicao" className="min-w-0 lg:col-span-2">
            <CabecalhoSecao id="titulo-composicao" titulo="Pago × pendente × atrasado" detalhe="Todos os boletos" />
            <Cartao className="p-4 sm:p-5">
              <ComposicaoStatus resumo={geral} />
            </Cartao>
          </section>
        </div>

        {/* 4. Resumo: indicadores secundários */}
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

        {/* 5. Tendência */}
        <section aria-labelledby="titulo-meses" className="min-w-0">
          <CabecalhoSecao id="titulo-meses" titulo="Valores por mês" link={{ href: '/meses', rotulo: 'Ver meses' }} />
          <Cartao className="p-4 sm:p-5">
            <GraficoMensal meses={meses} mesAtual={mesAtual} />
          </Cartao>
        </section>

        {/* 6. Distribuição */}
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
