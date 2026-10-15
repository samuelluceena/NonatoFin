'use client';

/**
 * Prévia da importação: números principais, linhas em conferência (com a
 * decisão de cada uma), o que será importado (com busca e opção de tirar
 * linhas) e o que ficou de fora, agrupado pelo motivo. Só apresentação: as
 * regras vêm de lib/domain/importacao.ts.
 */
import { AlertTriangle, Check, ChevronDown, CircleSlash, Search, X } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Botao } from '@/components/ui/botao';
import { Entrada } from '@/components/ui/campo';
import { Metrica, PainelMetricas } from '@/components/ui/metrica';
import { Selo } from '@/components/ui/selo';
import { Valor } from '@/components/ui/valor';
import { formatarData } from '@/lib/domain/datas';
import { normalizarNome } from '@/lib/domain/fornecedores';
import { ROTULOS_MOTIVO, type LinhaImportacao, type MotivoConferencia, type MotivoExclusao, type ResumoImportacao } from '@/lib/domain/importacao';
import { cn } from '@/lib/utils/cn';

/** Decisão explícita por chave: true = importar, false = não importar. */
export type Decisoes = Map<string, boolean>;

interface Props {
  linhas: readonly LinhaImportacao[];
  resumo: ResumoImportacao;
  decisoes: Decisoes;
  aoDecidir: (d: Decisoes) => void;
  semDecisao: number;
}

const POR_PAGINA = 100;

const DESCRICAO_MOTIVO: Partial<Record<MotivoConferencia, string>> = {
  'duplicada-no-arquivo': 'Linhas idênticas (data, valor, descrição e conta). Sugestão: importar só a primeira.',
  'provavel-duplicada': 'Mesma data, valor e conta, com fornecedor parecido. Sugestão: manter a linha com código de barras.',
  'possivel-fatura-cartao': 'Podem ser faturas já controladas no módulo Cartões. Não entram, a menos que você marque; ficam registradas no histórico.',
  'coincide-com-existente': 'Já existe no NonatoFin um lançamento com o mesmo vencimento e valor. Decida cada uma.',
};

export function PreviaDaImportacao({ linhas, resumo, decisoes, aoDecidir, semDecisao }: Props) {
  const conferir = linhas.filter((l) => l.situacao === 'conferir');
  const excluidas = linhas.filter((l) => l.situacao === 'excluida');
  const paraImportar = linhas.filter((l) => l.situacao === 'importar');

  function decidir(chaves: readonly string[], valor: boolean | null) {
    const nova = new Map(decisoes);
    for (const c of chaves) {
      if (valor === null) nova.delete(c);
      else nova.set(c, valor);
    }
    aoDecidir(nova);
  }

  const grupos = agruparPorMotivo(conferir);
  const gruposFora = agruparPorMotivo(excluidas);

  return (
    <>
      <PainelMetricas rotulo="Resumo da prévia" className="grid-cols-2 lg:grid-cols-[minmax(0,1.7fr)_repeat(3,minmax(0,1fr))]">
        <Metrica
          rotulo="Serão importados"
          valor={resumo.importar.totalCentavos}
          nivel="destaque"
          className="col-span-2 lg:col-span-1"
          detalhe={`${resumo.importar.quantidade} ${resumo.importar.quantidade === 1 ? 'lançamento' : 'lançamentos'}`}
          testId="previa-total"
        />
        <Metrica
          rotulo="Para conferir"
          valor={resumo.conferir.quantidade}
          tipo="contagem"
          detalhe={semDecisao > 0 ? `${semDecisao} sem decisão` : <Valor centavos={resumo.conferir.totalCentavos} />}
          testId="previa-conferir"
        />
        <Metrica
          rotulo="Fora da importação"
          valor={excluidas.length}
          tipo="contagem"
          detalhe="Pagos, vencidos, zero…"
          testId="previa-fora"
        />
        <Metrica rotulo="Valores estimados" valor={resumo.valoresEstimados} tipo="contagem" detalhe="Marcados para revisar" testId="previa-estimados" />
      </PainelMetricas>

      {grupos.length > 0 && (
        <section aria-labelledby="titulo-conferir" className="flex flex-col gap-3">
          <div>
            <h2 id="titulo-conferir" className="text-lead font-semibold text-fg">
              Conferir antes de importar
            </h2>
            <p className="text-sm text-fg-2">Nenhuma destas linhas é descartada: o que não for importado fica registrado no histórico da importação.</p>
          </div>
          {grupos.map(([motivo, itens]) => (
            <div key={motivo} className="overflow-hidden rounded-lg border border-border bg-surface" data-testid={`grupo-${motivo}`}>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-bg-subtle px-4 py-3">
                <div className="min-w-0">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
                    <AlertTriangle className="size-4 text-warning" aria-hidden="true" />
                    {ROTULOS_MOTIVO[motivo]}
                    <Selo tom="aviso">{itens.length}</Selo>
                  </h3>
                  {DESCRICAO_MOTIVO[motivo as MotivoConferencia] && (
                    <p className="mt-0.5 text-meta text-fg-2">{DESCRICAO_MOTIVO[motivo as MotivoConferencia]}</p>
                  )}
                </div>
                {itens.length > 1 && (
                  <div className="flex gap-1.5">
                    <Botao variante="fantasma" tamanho="sm" onClick={() => decidir(itens.map((l) => l.chave), true)}>
                      Importar todas
                    </Botao>
                    <Botao variante="fantasma" tamanho="sm" onClick={() => decidir(itens.map((l) => l.chave), false)}>
                      Não importar
                    </Botao>
                  </div>
                )}
              </div>
              <ul className="divide-y divide-border-subtle">
                {itens.map((l) => {
                  const d = decisoes.has(l.chave) ? decisoes.get(l.chave)! : l.sugestao === null ? null : l.sugestao === 'importar';
                  return (
                    <LinhaPrevia
                      key={l.chave}
                      linha={l}
                      testId="linha-conferir"
                      detalhe={l.detalhe}
                      acao={<DecisaoLinha valor={d} aoMudar={(v) => decidir([l.chave], v)} rotulo={l.descricao} />}
                    />
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      )}

      <ListaImportar linhas={paraImportar} decisoes={decisoes} aoDecidir={decidir} />

      {resumo.porConta.length > 0 && (
        <section aria-labelledby="titulo-por-conta">
          <h2 id="titulo-por-conta" className="mb-2 text-sm font-medium text-fg-2">
            Por conta original (da planilha)
          </h2>
          <ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border bg-surface">
            {resumo.porConta.map((g) => (
              <li key={g.rotulo} className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0 truncate text-fg">{g.rotulo}</span>
                <span className="shrink-0 text-fg-2">
                  <span className="numeros">{g.quantidade}</span> · <Valor centavos={g.totalCentavos} className="numeros font-medium text-fg" />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {gruposFora.length > 0 && (
        <section aria-labelledby="titulo-fora" className="flex flex-col gap-2">
          <h2 id="titulo-fora" className="text-sm font-medium text-fg-2">
            Fora da importação
          </h2>
          {gruposFora.map(([motivo, itens]) => (
            <details key={motivo} className="group overflow-hidden rounded-lg border border-border bg-surface" data-testid={`fora-${motivo}`}>
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-surface-2/60 [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2 text-fg">
                  <CircleSlash className="size-4 text-fg-3" aria-hidden="true" />
                  {ROTULOS_MOTIVO[motivo]}
                </span>
                <span className="flex items-center gap-2 text-fg-2">
                  <span className="numeros">{itens.length}</span>
                  <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
                </span>
              </summary>
              <ul className="divide-y divide-border-subtle border-t border-border">
                {itens.slice(0, 200).map((l) => (
                  <LinhaPrevia key={l.chave} linha={l} detalhe={l.detalhe} apagada />
                ))}
                {itens.length > 200 && <li className="px-4 py-2.5 text-meta text-fg-3">E mais {itens.length - 200}…</li>}
              </ul>
            </details>
          ))}
        </section>
      )}
    </>
  );
}

function agruparPorMotivo(linhas: readonly LinhaImportacao[]): [MotivoExclusao | MotivoConferencia, LinhaImportacao[]][] {
  const mapa = new Map<MotivoExclusao | MotivoConferencia, LinhaImportacao[]>();
  for (const l of linhas) if (l.motivo) mapa.set(l.motivo, [...(mapa.get(l.motivo) ?? []), l]);
  const ordem = Object.keys(ROTULOS_MOTIVO);
  return [...mapa].sort((a, b) => ordem.indexOf(a[0]) - ordem.indexOf(b[0]));
}

/** "Serão importados": busca, paginação e opção de tirar linhas. */
function ListaImportar({
  linhas,
  decisoes,
  aoDecidir,
}: {
  linhas: readonly LinhaImportacao[];
  decisoes: Decisoes;
  aoDecidir: (chaves: readonly string[], valor: boolean | null) => void;
}) {
  const [busca, setBusca] = useState('');
  const [limite, setLimite] = useState(POR_PAGINA);
  const filtradas = useMemo(() => {
    const termo = normalizarNome(busca);
    if (!termo) return linhas;
    return linhas.filter((l) => normalizarNome(`${l.descricao} ${l.contaOrigem} ${l.categoria}`).includes(termo));
  }, [linhas, busca]);
  const retiradas = linhas.filter((l) => decisoes.get(l.chave) === false).length;

  return (
    <section aria-labelledby="titulo-importar" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="titulo-importar" className="text-lead font-semibold text-fg">
            Serão importados
          </h2>
          <p className="text-sm text-fg-2">
            {linhas.length - retiradas} de {linhas.length} marcados
            {retiradas > 0 && (
              <>
                {' '}
                ·{' '}
                <button type="button" className="font-medium text-primary-text hover:underline" onClick={() => aoDecidir(linhas.map((l) => l.chave), null)}>
                  marcar todos de novo
                </button>
              </>
            )}
          </p>
        </div>
        <label className="relative w-full sm:w-72">
          <span className="sr-only">Pesquisar na prévia</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-3" aria-hidden="true" />
          <Entrada
            type="search"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setLimite(POR_PAGINA);
            }}
            placeholder="Descrição, conta ou categoria"
            className="pl-9"
            data-testid="busca-previa"
          />
        </label>
      </div>
      {filtradas.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface px-4 py-6 text-center text-sm text-fg-2">Nada encontrado.</p>
      ) : (
        <ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border bg-surface" data-testid="lista-importar">
          {filtradas.slice(0, limite).map((l) => {
            const marcada = decisoes.get(l.chave) !== false;
            return (
              <LinhaPrevia
                key={l.chave}
                linha={l}
                apagada={!marcada}
                testId="linha-importar"
                inicio={
                  <input
                    type="checkbox"
                    checked={marcada}
                    onChange={(e) => aoDecidir([l.chave], e.target.checked ? null : false)}
                    aria-label={`Importar ${l.descricao}, ${formatarData(l.vencimento!)}`}
                    className="mt-1 size-4.5 shrink-0 accent-primary"
                  />
                }
              />
            );
          })}
        </ul>
      )}
      {filtradas.length > limite && (
        <Botao variante="secundario" onClick={() => setLimite((n) => n + POR_PAGINA)} className="self-center">
          Mostrar mais ({filtradas.length - limite})
        </Botao>
      )}
    </section>
  );
}

function LinhaPrevia({
  linha: l,
  inicio,
  acao,
  detalhe,
  apagada,
  testId,
}: {
  linha: LinhaImportacao;
  inicio?: ReactNode;
  acao?: ReactNode;
  detalhe?: string | null;
  apagada?: boolean;
  testId?: string;
}) {
  const meta = [l.categoria, l.contaOrigem ? `Conta: ${l.contaOrigem}` : null, `Linha ${l.numero}`].filter(Boolean).join(' · ');
  return (
    <li className={cn('flex gap-3 px-4 py-3', apagada && 'opacity-60')} data-testid={testId} data-linha={l.numero}>
      {inicio}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="min-w-0 truncate text-sm font-medium text-fg" title={l.descricao}>
            {l.descricao || '(sem descrição)'}
          </p>
          <span className="shrink-0 text-sm font-semibold text-fg">{l.valorCentavos > 0 ? <Valor centavos={l.valorCentavos} className="numeros" /> : '—'}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-fg-3">
          <span className="min-w-0 truncate">
            <span className="numeros text-fg-2">{l.vencimento ? formatarData(l.vencimento) : 'Sem data'}</span> · {meta}
          </span>
          {l.valorEstimado && <Selo tom="aviso">Valor estimado</Selo>}
          {l.codigoBarras && <Selo tom="info">Código de barras</Selo>}
        </div>
        {detalhe && <p className="mt-1 text-meta text-fg-2">{detalhe}</p>}
        {acao && <div className="mt-2">{acao}</div>}
      </div>
    </li>
  );
}

/** Importar / Não importar (sem decisão = nenhum dos dois marcado). */
function DecisaoLinha({ valor, aoMudar, rotulo }: { valor: boolean | null; aoMudar: (v: boolean) => void; rotulo: string }) {
  const opcao = (v: boolean, texto: string, icone: ReactNode) => (
    <button
      type="button"
      aria-pressed={valor === v}
      onClick={() => aoMudar(v)}
      className={cn(
        'inline-flex min-h-9 items-center gap-1.5 rounded-sm px-3 text-sm font-medium transition-colors [&_svg]:size-4',
        valor === v ? (v ? 'bg-surface text-success shadow-sm ring-1 ring-border dark:bg-surface-3' : 'bg-surface text-fg shadow-sm ring-1 ring-border dark:bg-surface-3') : 'text-fg-2 hover:text-fg',
      )}
      data-testid={v ? 'decidir-importar' : 'decidir-nao-importar'}
    >
      {icone}
      {texto}
    </button>
  );
  return (
    <div role="group" aria-label={`Decisão: ${rotulo}`} className={cn('inline-flex gap-0.5 rounded-md border bg-surface-2 p-0.5', valor === null ? 'border-warning-border' : 'border-border')}>
      {opcao(true, 'Importar', <Check aria-hidden="true" />)}
      {opcao(false, 'Não importar', <X aria-hidden="true" />)}
    </div>
  );
}
