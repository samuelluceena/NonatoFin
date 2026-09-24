import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { BarrasComparativas } from '@/components/graficos/barras-comparativas';
import { BarrasFornecedores } from '@/components/graficos/barras-fornecedores';
import { ComposicaoStatus } from '@/components/graficos/composicao-status';
import { GraficoMensal } from '@/components/graficos/grafico-mensal';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { Cartao, TituloSecao } from '@/components/ui/cartao';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { Indicador } from '@/components/ui/indicador';
import { LinkBotao } from '@/components/ui/botao';
import { carregarBaseRelatorios } from '@/features/dashboard/dados';
import { AvisoSemEmpresa } from '@/features/empresas/componentes/aviso-sem-empresa';
import { listarCategorias, obterContextoEmpresas } from '@/features/empresas/consultas';
import { exigirUsuario } from '@/lib/auth/sessao';
import { adicionarMesesNaChave, chaveDoMes, formatarData, hojeISO } from '@/lib/domain/datas';
import { linkDaLista } from '@/lib/domain/filtros';
import { calcularIndicadores, resumirStatus, resumoPorFornecedor, resumoPorGrupo, serieMensal } from '@/lib/domain/indicadores';

export const metadata: Metadata = { title: 'Dashboard' };

const LINK_ATRASADOS = linkDaLista({ periodo: { tipo: 'todos' }, status: 'atrasados' });
const LINK_A_VENCER = linkDaLista({ periodo: { tipo: 'todos' }, status: 'pendentes' });

const qtd = (n: number) => `${n} ${n === 1 ? 'boleto' : 'boletos'}`;

export default async function PaginaDashboard() {
  await exigirUsuario();
  const hoje = hojeISO();
  const [{ resumos, fornecedores }, { empresas, selecionada }, categorias] = await Promise.all([
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

  const ind = calcularIndicadores(resumos, hoje);
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

      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Indicador rotulo="A pagar hoje" valor={ind.hoje.totalCentavos} detalhe={qtd(ind.hoje.quantidade)} href="/" tom="destaque" testId="kpi-hoje" />
        <Indicador rotulo="A pagar amanhã" valor={ind.amanha.totalCentavos} detalhe={qtd(ind.amanha.quantidade)} href={linkDaLista({ periodo: { tipo: 'amanha' } })} testId="kpi-amanha" />
        <Indicador rotulo="Esta semana" valor={ind.semana.totalCentavos} detalhe={`${qtd(ind.semana.quantidade)} até domingo`} href={linkDaLista({ periodo: { tipo: 'semana' } })} testId="kpi-semana" />
        <Indicador rotulo="Este mês" valor={ind.mes.totalCentavos} detalhe={`${qtd(ind.mes.quantidade)} até o fim do mês`} href={linkDaLista({ periodo: { tipo: 'mes' } })} testId="kpi-mes" />
        <Indicador rotulo="Próximo mês" valor={ind.proximoMes.totalCentavos} detalhe={qtd(ind.proximoMes.quantidade)} href={linkDaLista({ periodo: { tipo: 'proximo-mes' } })} testId="kpi-proximo-mes" />
        <Indicador
          rotulo="Atrasados"
          valor={ind.atrasados.totalCentavos}
          detalhe={qtd(ind.atrasados.quantidade)}
          href={LINK_ATRASADOS}
          tom="perigo"
          icone={<AlertTriangle className="size-3.5" aria-hidden="true" />}
          testId="kpi-atrasados"
        />
        <Indicador rotulo="Total futuro a pagar" valor={ind.futuro.totalCentavos} detalhe={qtd(ind.futuro.quantidade)} href={LINK_A_VENCER} testId="kpi-futuro" />
        <Indicador rotulo="Pago no mês" valor={ind.pagoNoMes.totalCentavos} detalhe={qtd(ind.pagoNoMes.quantidade)} href="/historico" testId="kpi-pago-mes" />
        <div className="col-span-2 grid grid-cols-2 gap-3 lg:col-span-1">
          <Indicador rotulo="Boletos pendentes" valor={ind.pendentes} tipo="contagem" href={LINK_A_VENCER} testId="kpi-qtd-pendentes" />
          <Indicador rotulo="Boletos atrasados" valor={ind.atrasadosQuantidade} tipo="contagem" tom="perigo" href={LINK_ATRASADOS} testId="kpi-qtd-atrasados" />
        </div>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="titulo-meses">
          <div className="mb-2 flex items-baseline justify-between px-1">
            <TituloSecao id="titulo-meses">Valores por mês</TituloSecao>
            <Link href="/meses" className="text-sm font-medium text-primary-text hover:underline">
              Ver meses
            </Link>
          </div>
          <Cartao className="p-4 sm:p-5">
            <GraficoMensal meses={meses} mesAtual={mesAtual} />
          </Cartao>
        </section>

        <section aria-labelledby="titulo-fornecedores">
          <div className="mb-2 flex items-baseline justify-between px-1">
            <TituloSecao id="titulo-fornecedores">Por fornecedor</TituloSecao>
            <Link href="/fornecedores" className="text-sm font-medium text-primary-text hover:underline">
              Ver todos
            </Link>
          </div>
          <Cartao className="p-4 sm:p-5">
            <BarrasFornecedores resumos={porFornecedor} />
          </Cartao>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {porEmpresa.length > 0 && (
          <section aria-labelledby="titulo-empresas" data-testid="secao-por-empresa">
            <TituloSecao id="titulo-empresas" className="mb-2 px-1">
              Por empresa
            </TituloSecao>
            <Cartao className="p-4 sm:p-5">
              <BarrasComparativas nome="metrica-empresa" rotulo="Comparar empresas por" itens={porEmpresa} />
            </Cartao>
          </section>
        )}
        <section aria-labelledby="titulo-categorias" data-testid="secao-por-categoria">
          <TituloSecao id="titulo-categorias" className="mb-2 px-1">
            Por categoria
          </TituloSecao>
          <Cartao className="p-4 sm:p-5">
            <BarrasComparativas nome="metrica-categoria" rotulo="Comparar categorias por" itens={porCategoria} />
          </Cartao>
        </section>
      </div>

      <section aria-labelledby="titulo-composicao" className="mt-6">
        <TituloSecao id="titulo-composicao" className="mb-2 px-1">
          Pago x pendente (todos os boletos)
        </TituloSecao>
        <Cartao className="p-4 sm:p-5">
          <ComposicaoStatus resumo={geral} />
        </Cartao>
      </section>
    </>
  );
}
