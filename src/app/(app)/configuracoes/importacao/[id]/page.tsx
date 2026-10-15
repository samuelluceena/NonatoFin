import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Building2, ChevronDown, ListChecks } from 'lucide-react';
import { LinkBotao } from '@/components/ui/botao';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { Aviso } from '@/components/ui/formulario';
import { LinkVoltar } from '@/components/ui/link-voltar';
import { Metrica, PainelMetricas } from '@/components/ui/metrica';
import { Selo } from '@/components/ui/selo';
import { Valor } from '@/components/ui/valor';
import { BotaoDesfazerImportacao } from '@/features/importacao/componentes/botao-desfazer-importacao';
import { obterImportacao, situacaoDoLote } from '@/features/importacao/consultas';
import { exigirUsuario } from '@/lib/auth/sessao';
import { formatarData, formatarDataHora } from '@/lib/domain/datas';
import { ROTULOS_MOTIVO, type MotivoConferencia, type MotivoExclusao } from '@/lib/domain/importacao';
import { idDaRota } from '@/lib/parametros';

export const metadata: Metadata = { title: 'Importação' };

const rotuloMotivo = (m: string) => ROTULOS_MOTIVO[m as MotivoExclusao | MotivoConferencia] ?? m;

export default async function PaginaImportacao({ params }: PageProps<'/configuracoes/importacao/[id]'>) {
  const id = idDaRota((await params).id);
  const { supabase } = await exigirUsuario();
  const importacao = await obterImportacao(supabase, id);
  if (!importacao) notFound();
  const situacao = await situacaoDoLote(supabase, id);
  const { resumo } = importacao;
  const separadas = resumo.separadas ?? [];
  const desfeita = importacao.status === 'desfeita';

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <CabecalhoPagina
        voltar={<LinkVoltar href="/configuracoes/importacao">Importações</LinkVoltar>}
        titulo={<span className="break-words">{importacao.arquivoNome}</span>}
        subtitulo={`Importado em ${formatarDataHora(importacao.criadoEm)} · vencimentos de ${formatarData(importacao.periodoDe)} a ${formatarData(importacao.periodoAte)}`}
        className="mb-0"
        acoes={desfeita ? <Selo className="text-sm">Desfeita</Selo> : <Selo tom="sucesso">Concluída</Selo>}
      />

      {desfeita && importacao.desfeitaEm && (
        <Aviso>
          Desfeita em {formatarDataHora(importacao.desfeitaEm)}: {importacao.removidos} {importacao.removidos === 1 ? 'lançamento removido' : 'lançamentos removidos'}
          {importacao.ativos > 0 && ` (${importacao.ativos} já pagos foram mantidos)`}.
        </Aviso>
      )}

      <PainelMetricas rotulo="Resultado da importação" className="grid-cols-2 lg:grid-cols-[minmax(0,1.7fr)_repeat(3,minmax(0,1fr))]">
        <Metrica
          rotulo="Importados"
          valor={importacao.totalCentavos}
          nivel="destaque"
          className="col-span-2 lg:col-span-1"
          detalhe={`${importacao.importados} lançamentos`}
          testId="importacao-total"
        />
        <Metrica rotulo="Ainda sem empresa" valor={situacao.semEmpresa} tipo="contagem" detalhe={`de ${importacao.ativos} no sistema`} testId="importacao-sem-empresa" />
        <Metrica rotulo="Pagos desde então" valor={situacao.pagos} tipo="contagem" detalhe={`${situacao.pendentes} pendentes`} />
        <Metrica rotulo="Valores estimados" valor={situacao.estimados} tipo="contagem" detalhe="Revisar antes de pagar" />
      </PainelMetricas>

      {!desfeita && importacao.ativos > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row">
          {situacao.semEmpresa > 0 && (
            <LinkBotao href={`/boletos/sem-empresa?lote=${importacao.id}`} icone={<Building2 className="size-4.5" aria-hidden="true" />} data-testid="atribuir-empresas-lote">
              Atribuir empresas
            </LinkBotao>
          )}
          {situacao.estimados > 0 && (
            <LinkBotao href={`/boletos/sem-empresa?lote=${importacao.id}&estimados=1`} variante="secundario" icone={<ListChecks className="size-4.5" aria-hidden="true" />}>
              Ver valores estimados
            </LinkBotao>
          )}
        </div>
      )}

      {(resumo.motivos?.length ?? 0) > 0 && (
        <section aria-labelledby="titulo-motivos">
          <h2 id="titulo-motivos" className="mb-2 px-1 text-sm font-medium text-fg-2">
            O que ficou de fora ou passou por conferência
          </h2>
          <ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border bg-surface">
            {resumo.motivos!.map((m) => (
              <li key={m.motivo} className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0 text-fg">{m.rotulo}</span>
                <span className="shrink-0 text-fg-2">
                  <span className="numeros">{m.quantidade}</span>
                  {m.totalCentavos > 0 && (
                    <>
                      {' '}
                      · <Valor centavos={m.totalCentavos} className="numeros" />
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {(resumo.incluidasNaConferencia ?? 0) > 0 && (
            <p className="mt-2 px-1 text-meta text-fg-3">{resumo.incluidasNaConferencia} linhas em conferência foram importadas por sua decisão.</p>
          )}
        </section>
      )}

      {separadas.length > 0 && (
        <details className="group" data-testid="secao-separadas">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm hover:bg-surface-2/60 group-open:rounded-b-none [&::-webkit-details-marker]:hidden">
            <span className="font-medium text-fg">Separadas para conferência (não importadas)</span>
            <span className="flex items-center gap-2 text-fg-2">
              <span className="numeros">{separadas.length}</span>
              <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
            </span>
          </summary>
          <p className="border-x border-border bg-surface px-4 pt-1 pb-3 text-meta text-fg-3">
            Continuam registradas aqui. Para incluir alguma depois, faça uma nova importação do mesmo arquivo e marque &quot;Importar&quot; na conferência: as linhas já
            importadas não se repetem.
          </p>
          <ul className="divide-y divide-border-subtle overflow-hidden rounded-b-lg border border-t-0 border-border bg-surface" data-testid="linhas-separadas">
            {separadas.map((l) => (
              <li key={`${l.numero}-${l.descricao}`} className="px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 truncate text-sm font-medium text-fg">{l.descricao}</p>
                  <Valor centavos={l.valorCentavos} className="numeros shrink-0 text-sm font-semibold text-fg" />
                </div>
                <p className="mt-0.5 text-meta text-fg-3">
                  <span className="numeros text-fg-2">{l.vencimento ? formatarData(l.vencimento) : 'Sem data'}</span> · {rotuloMotivo(l.motivo)}
                  {l.contaOrigem && ` · Conta: ${l.contaOrigem}`} · Linha {l.numero}
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}

      {!desfeita && (
        <section aria-labelledby="titulo-desfazer" className="border-t border-border pt-5">
          <h2 id="titulo-desfazer" className="text-sm font-medium text-fg-2">
            Desfazer
          </h2>
          <p className="mt-1 mb-3 text-meta text-fg-3">
            Remove os {situacao.pendentes} lançamentos deste lote que ainda estão pendentes. Os já pagos ficam.
          </p>
          <BotaoDesfazerImportacao importacaoId={importacao.id} pendentes={situacao.pendentes} pagos={situacao.pagos} />
        </section>
      )}
    </div>
  );
}
