import type { Metadata } from 'next';
import { Plus, SearchX } from 'lucide-react';
import { LinkBotao } from '@/components/ui/botao';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { Valor } from '@/components/ui/valor';
import { listarTodasAsContas } from '@/features/contas/consultas';
import { BotoesExportar } from '@/features/exportacao/botoes-exportar';
import { listarLancamentos, opcoesDosFiltros } from '@/features/lancamentos/consultas';
import { FiltrosLancamentos } from '@/features/lancamentos/componentes/filtros-lancamentos';
import { ListaLancamentos } from '@/features/lancamentos/componentes/lista-lancamentos';
import { listarCategorias, obterContextoEmpresas } from '@/features/empresas/consultas';
import { listarFornecedores } from '@/features/fornecedores/consultas';
import { exigirUsuario } from '@/lib/auth/sessao';
import { hojeISO } from '@/lib/domain/datas';
import { somarCentavos } from '@/lib/domain/dinheiro';
import { lerFiltros, parametrosDosFiltros, periodoEstaNaUrl, rotuloDoPeriodo, rotuloDoStatus } from '@/lib/domain/filtros';
import { rotuloConta } from '@/lib/domain/saldos';

export const metadata: Metadata = { title: 'Boletos' };

export default async function PaginaBoletos({ searchParams }: PageProps<'/boletos'>) {
  const { supabase } = await exigirUsuario();
  const params = await searchParams;
  const hoje = hojeISO();
  // Filtros vêm da URL; valores inválidos são ignorados (lib/domain/filtros.ts).
  const filtros = lerFiltros(params, hoje);

  const { empresas, empresaId } = await obterContextoEmpresas();
  const [fornecedores, categorias, contas, { lancamentos, truncado }] = await Promise.all([
    listarFornecedores(supabase),
    listarCategorias(),
    listarTodasAsContas(),
    listarLancamentos(supabase, opcoesDosFiltros(filtros, hoje, empresaId)),
  ]);
  const total = somarCentavos(lancamentos.map((b) => b.valorCentavos));
  // Com todas as empresas visíveis, o nome da empresa diferencia contas de mesmo apelido.
  const mostrarEmpresa = !empresaId && empresas.length > 1;
  const opcoesContas = contas
    .filter((c) => !empresaId || c.empresa.id === empresaId)
    .map((c) => ({ id: c.id, rotulo: `${rotuloConta(c)}${mostrarEmpresa ? ` · ${c.empresa.apelido}` : ''}${c.ativa ? '' : ' (inativa)'}` }));
  const filtrado = Object.keys(parametrosDosFiltros(filtros)).length > 0;
  const resumo = [rotuloDoPeriodo(filtros.periodo), filtros.status === 'todos' ? null : rotuloDoStatus(filtros.status)].filter(Boolean).join(' · ');

  return (
    <>
      <CabecalhoPagina
        titulo="Boletos"
        subtitulo={
          <span data-testid="resumo-lista">
            {resumo} · {lancamentos.length} {lancamentos.length === 1 ? 'boleto' : 'boletos'} · <Valor centavos={total} />
          </span>
        }
        acoes={
          <div className="hidden sm:block">
            <LinkBotao href="/boletos/novo" icone={<Plus className="size-5" aria-hidden="true" />}>
              Novo boleto
            </LinkBotao>
          </div>
        }
      />
      <FiltrosLancamentos
        filtros={filtros}
        periodoExplicito={periodoEstaNaUrl(params, hoje)}
        hoje={hoje}
        fornecedores={fornecedores.map((f) => ({ id: f.id, rotulo: f.nome }))}
        categorias={categorias.map((c) => ({ id: c.id, rotulo: c.nome }))}
        contas={opcoesContas}
      />
      {lancamentos.length === 0 ? (
        <EstadoVazio
          icone={<SearchX />}
          titulo="Nenhum boleto encontrado"
          descricao={filtrado ? 'Nenhum boleto corresponde aos filtros aplicados.' : 'Não há boletos neste período.'}
          acao={
            <div className="flex flex-wrap justify-center gap-2">
              {filtrado && (
                <LinkBotao href="/boletos" variante="secundario">
                  Limpar filtros
                </LinkBotao>
              )}
              <LinkBotao href="/boletos/novo" variante="suave" icone={<Plus aria-hidden="true" />}>
                Novo boleto
              </LinkBotao>
            </div>
          }
        />
      ) : (
        <>
          <ListaLancamentos lancamentos={lancamentos} hoje={hoje} />
          {truncado && (
            <p className="mt-6 text-center text-sm text-fg-3">
              Mostrando os primeiros {lancamentos.length} resultados. Refine os filtros para ver os demais (a exportação traz todos).
            </p>
          )}
          <section aria-labelledby="exportar-lista" className="mt-8 border-t border-border pt-5">
            <h2 id="exportar-lista" className="mb-3 text-sm font-medium text-fg-2">
              Exportar esta lista
            </h2>
            <BotoesExportar filtros={new URLSearchParams(parametrosDosFiltros(filtros)).toString()} compacto />
          </section>
        </>
      )}
    </>
  );
}
