import type { Metadata } from 'next';
import Link from 'next/link';
import { SearchX, Tags } from 'lucide-react';
import { LinkBotao, classesBotao } from '@/components/ui/botao';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { listarTodasAsContas } from '@/features/contas/consultas';
import { AvisoSemEmpresa } from '@/features/empresas/componentes/aviso-sem-empresa';
import { listarCategorias, obterContextoEmpresas } from '@/features/empresas/consultas';
import { listarFornecedores } from '@/features/fornecedores/consultas';
import { FiltrosTransacoes } from '@/features/transacoes/componentes/filtros-transacoes';
import { ListaTransacoes } from '@/features/transacoes/componentes/lista-transacoes';
import { ResumoDasTransacoes } from '@/features/transacoes/componentes/resumo-transacoes';
import { listarTransacoes } from '@/features/transacoes/consultas';
import { exigirUsuario } from '@/lib/auth/sessao';
import { hojeISO } from '@/lib/domain/datas';
import { periodoEstaNaUrl, rotuloDoPeriodo } from '@/lib/domain/filtros';
import { rotuloConta } from '@/lib/domain/saldos';
import {
  ITENS_POR_PAGINA,
  PAGINAS_MAX,
  consultaDosFiltrosTransacoes,
  lerFiltrosTransacoes,
  parametrosDosFiltrosTransacoes,
  lerPagina,
  resumirTransacoes,
} from '@/lib/domain/transacoes';

export const metadata: Metadata = { title: 'Transações' };

export default async function PaginaTransacoes({ searchParams }: PageProps<'/transacoes'>) {
  const { supabase } = await exigirUsuario();
  const params = await searchParams;
  const hoje = hojeISO();
  // Filtros vêm da URL; valores inválidos são ignorados (lib/domain/transacoes.ts).
  const filtros = lerFiltrosTransacoes(params, hoje);
  const pagina = lerPagina(params);

  const { empresas, empresaId } = await obterContextoEmpresas();
  if (empresas.length === 0) return <AvisoSemEmpresa />;
  const [fornecedores, categorias, contas, resultado] = await Promise.all([
    listarFornecedores(supabase),
    listarCategorias(),
    listarTodasAsContas(),
    listarTransacoes(supabase, filtros, hoje, empresaId),
  ]);

  const { itens, truncado } = resultado;
  const visiveis = itens.slice(0, pagina * ITENS_POR_PAGINA);
  const resumo = resumirTransacoes(itens);
  // Com todas as empresas visíveis, a empresa diferencia itens e contas de mesmo apelido.
  const mostrarEmpresa = !empresaId && empresas.length > 1;
  const empresaDoFiltro = empresaId ?? (filtros.empresaId || undefined);
  const opcoesContas = contas
    .filter((c) => !empresaDoFiltro || c.empresa.id === empresaDoFiltro)
    .map((c) => ({ id: c.id, rotulo: `${rotuloConta(c)}${mostrarEmpresa ? ` · ${c.empresa.apelido}` : ''}${c.ativa ? '' : ' (inativa)'}` }));
  const quantidade = `${itens.length}${truncado ? '+' : ''} ${itens.length === 1 ? 'transação' : 'transações'}`;
  const filtrado = Object.keys(parametrosDosFiltrosTransacoes(filtros)).length > 0;
  const podeMostrarMais = visiveis.length < itens.length && pagina < PAGINAS_MAX;

  return (
    <>
      <CabecalhoPagina
        titulo="Transações"
        subtitulo={
          <span data-testid="resumo-lista">
            {rotuloDoPeriodo(filtros.periodo)} · {quantidade}
          </span>
        }
        acoes={
          <LinkBotao
            href="/configuracoes/categorias?origem=transacoes"
            variante="secundario"
            icone={<Tags className="size-4.5" aria-hidden="true" />}
            data-testid="link-categorias"
          >
            Categorias
          </LinkBotao>
        }
      />

      <FiltrosTransacoes
        filtros={filtros}
        periodoExplicito={periodoEstaNaUrl(params, hoje)}
        hoje={hoje}
        empresas={empresaId ? [] : empresas.map((e) => ({ id: e.id, rotulo: e.apelido }))}
        categorias={categorias.map((c) => ({ id: c.id, rotulo: c.nome }))}
        contas={opcoesContas}
        fornecedores={fornecedores.map((f) => ({ id: f.id, rotulo: f.nome }))}
      />

      {itens.length === 0 ? (
        <EstadoVazio
          icone={<SearchX />}
          titulo="Nenhuma transação encontrada"
          descricao={filtrado ? 'Nenhuma transação corresponde aos filtros aplicados.' : 'Não há movimentações neste período.'}
          acao={
            filtrado ? (
              <LinkBotao href="/transacoes" variante="secundario">
                Limpar filtros
              </LinkBotao>
            ) : undefined
          }
        />
      ) : (
        <>
          <ResumoDasTransacoes resumo={resumo} />
          <ListaTransacoes itens={visiveis} hoje={hoje} mostrarEmpresa={mostrarEmpresa} />
          <div className="mt-6 flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-fg-3" data-testid="contagem-transacoes">
              Mostrando {visiveis.length} de {itens.length}
              {truncado ? '+' : ''}
            </p>
            {podeMostrarMais && (
              <Link
                href={`/transacoes${consultaDosFiltrosTransacoes(filtros, { pagina: String(pagina + 1) })}`}
                scroll={false}
                replace
                className={classesBotao('secundario', 'md')}
                data-testid="mostrar-mais"
              >
                Mostrar mais
              </Link>
            )}
            {truncado && (
              <p className="max-w-md text-sm text-fg-3" role="note">
                Há mais transações antigas neste período. Escolha um período menor ou use os filtros para ver as demais; os totais consideram somente as listadas.
              </p>
            )}
          </div>
        </>
      )}
    </>
  );
}
