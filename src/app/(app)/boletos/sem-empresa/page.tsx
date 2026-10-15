import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Building2, CheckCircle2, Search } from 'lucide-react';
import { Botao, LinkBotao } from '@/components/ui/botao';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { Entrada } from '@/components/ui/campo';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { LinkVoltar } from '@/components/ui/link-voltar';
import { Valor } from '@/components/ui/valor';
import { listarTodasAsContas } from '@/features/contas/consultas';
import { AvisoSemEmpresa } from '@/features/empresas/componentes/aviso-sem-empresa';
import { listarCategorias, obterContextoEmpresas } from '@/features/empresas/consultas';
import { ListaSemEmpresa } from '@/features/importacao/componentes/lista-sem-empresa';
import { categoriasSemEmpresa, contarSemEmpresa, contasDeOrigemSemEmpresa, listarSemEmpresa } from '@/features/importacao/consultas';
import { esquemaFiltroSemEmpresa, type FiltroSemEmpresa } from '@/features/importacao/esquemas';
import { exigirUsuario } from '@/lib/auth/sessao';
import { hojeISO } from '@/lib/domain/datas';
import { idOuVazio, sanitizarBusca, texto, type ParametrosUrl } from '@/lib/domain/filtros';
import { rotuloConta } from '@/lib/domain/saldos';
import { cn } from '@/lib/utils/cn';

export const metadata: Metadata = { title: 'Lançamentos sem empresa' };

const LIMITE_EXIBIDO = 200;

function lerFiltro(p: ParametrosUrl): FiltroSemEmpresa {
  return esquemaFiltroSemEmpresa.parse({
    busca: sanitizarBusca(texto(p.q)),
    contaOrigem: texto(p.conta).slice(0, 120),
    categoriaId: idOuVazio(p.categoria),
    importacaoId: idOuVazio(p.lote),
    estimados: texto(p.estimados) === '1',
  });
}

function link(f: FiltroSemEmpresa, mudar: Partial<FiltroSemEmpresa>): string {
  const n = { ...f, ...mudar };
  const p = new URLSearchParams();
  if (n.busca) p.set('q', n.busca);
  if (n.contaOrigem) p.set('conta', n.contaOrigem);
  if (n.categoriaId) p.set('categoria', n.categoriaId);
  if (n.importacaoId) p.set('lote', n.importacaoId);
  if (n.estimados) p.set('estimados', '1');
  const qs = p.toString();
  return `/boletos/sem-empresa${qs ? `?${qs}` : ''}`;
}

function Chip({ href, ativo, children, testId }: { href: string; ativo: boolean; children: ReactNode; testId?: string }) {
  return (
    <Link
      href={href}
      aria-current={ativo ? 'true' : undefined}
      scroll={false}
      data-testid={testId}
      className={cn(
        'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm whitespace-nowrap transition-colors',
        ativo ? 'border-primary bg-primary-soft font-medium text-primary-soft-fg' : 'border-border bg-surface text-fg-2 hover:border-border-strong hover:text-fg',
      )}
    >
      {children}
    </Link>
  );
}

export default async function PaginaSemEmpresa({ searchParams }: PageProps<'/boletos/sem-empresa'>) {
  const { supabase } = await exigirUsuario();
  const filtro = lerFiltro(await searchParams);
  const hoje = hojeISO();
  const { empresas } = await obterContextoEmpresas();
  if (empresas.length === 0) return <AvisoSemEmpresa />;

  const [geral, resultado, origens, usoCategorias, categorias, contas] = await Promise.all([
    contarSemEmpresa(supabase),
    listarSemEmpresa(supabase, filtro, LIMITE_EXIBIDO),
    contasDeOrigemSemEmpresa(supabase),
    categoriasSemEmpresa(supabase),
    listarCategorias(),
    listarTodasAsContas(),
  ]);
  const filtrado = Boolean(filtro.busca || filtro.contaOrigem || filtro.categoriaId || filtro.importacaoId || filtro.estimados);
  const empresasParaAtribuir = empresas.map((e) => {
    const padrao = contas.find((c) => c.empresa.id === e.id && c.padrao && c.ativa);
    return { id: e.id, apelido: e.apelido, contaPadrao: padrao ? rotuloConta(padrao) : null };
  });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <CabecalhoPagina
        voltar={<LinkVoltar href="/boletos">Boletos</LinkVoltar>}
        titulo="Lançamentos sem empresa"
        subtitulo={
          <span data-testid="resumo-sem-empresa">
            {geral.quantidade} {geral.quantidade === 1 ? 'lançamento' : 'lançamentos'} · <Valor centavos={geral.totalCentavos} /> · defina a empresa (e a conta) em lote
          </span>
        }
        className="mb-0"
      />

      {geral.quantidade === 0 ? (
        <EstadoVazio
          icone={<CheckCircle2 />}
          titulo="Todos os lançamentos têm empresa"
          descricao="Nada para atribuir. Lançamentos importados de planilhas aparecem aqui até receberem uma empresa."
          acao={<LinkBotao href="/boletos">Ver boletos</LinkBotao>}
        />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <form action="/boletos/sem-empresa" className="flex gap-2" role="search">
              {filtro.contaOrigem && <input type="hidden" name="conta" value={filtro.contaOrigem} />}
              {filtro.categoriaId && <input type="hidden" name="categoria" value={filtro.categoriaId} />}
              {filtro.importacaoId && <input type="hidden" name="lote" value={filtro.importacaoId} />}
              {filtro.estimados && <input type="hidden" name="estimados" value="1" />}
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Pesquisar</span>
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-3" aria-hidden="true" />
                <Entrada type="search" name="q" defaultValue={filtro.busca} placeholder="Fornecedor, descrição ou observação" className="pl-9" data-testid="busca-sem-empresa" />
              </label>
              <Botao type="submit" variante="secundario">
                Pesquisar
              </Botao>
            </form>

            {origens.length > 0 && (
              <div>
                <p className="mb-1.5 px-1 text-meta font-medium text-fg-3">Conta original (planilha)</p>
                <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
                  <Chip href={link(filtro, { contaOrigem: '' })} ativo={!filtro.contaOrigem}>
                    Todas
                  </Chip>
                  {origens.map((o) => (
                    <Chip key={o.conta} href={link(filtro, { contaOrigem: o.conta })} ativo={filtro.contaOrigem === o.conta} testId="chip-conta-origem">
                      {o.conta} <span className="numeros text-fg-3">{o.quantidade}</span>
                    </Chip>
                  ))}
                </div>
              </div>
            )}

            {usoCategorias.length > 1 && (
              <div>
                <p className="mb-1.5 px-1 text-meta font-medium text-fg-3">Categoria</p>
                <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
                  <Chip href={link(filtro, { categoriaId: '' })} ativo={!filtro.categoriaId}>
                    Todas
                  </Chip>
                  {usoCategorias.map((u) => (
                    <Chip key={u.categoriaId} href={link(filtro, { categoriaId: u.categoriaId })} ativo={filtro.categoriaId === u.categoriaId} testId="chip-categoria">
                      {categorias.find((c) => c.id === u.categoriaId)?.nome ?? 'Categoria'} <span className="numeros text-fg-3">{u.quantidade}</span>
                    </Chip>
                  ))}
                </div>
              </div>
            )}

            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
              <Chip href={link(filtro, { estimados: !filtro.estimados })} ativo={filtro.estimados} testId="chip-estimados">
                Valores estimados
              </Chip>
              {filtro.importacaoId && (
                <Chip href={link(filtro, { importacaoId: '' })} ativo>
                  Desta importação ✕
                </Chip>
              )}
              {filtrado && (
                <Link href="/boletos/sem-empresa" className="inline-flex min-h-9 items-center px-2 text-sm font-medium text-primary-text hover:underline">
                  Limpar filtros
                </Link>
              )}
            </div>
          </div>

          {resultado.quantidade === 0 ? (
            <EstadoVazio icone={<Building2 />} titulo="Nada neste filtro" descricao="Nenhum lançamento sem empresa corresponde aos filtros." />
          ) : (
            <ListaSemEmpresa
              key={JSON.stringify(filtro)}
              lancamentos={resultado.lancamentos}
              quantidade={resultado.quantidade}
              totalCentavos={resultado.totalCentavos}
              filtro={filtro}
              empresas={empresasParaAtribuir}
              hoje={hoje}
            />
          )}
        </>
      )}
    </div>
  );
}
