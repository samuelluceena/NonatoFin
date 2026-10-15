'use client';

/**
 * Lançamentos sem empresa com seleção e atribuição em lote: marca alguns (ou
 * "todos os N do filtro", resolvidos no servidor), escolhe a empresa e,
 * opcionalmente, a conta padrão dela nos pendentes.
 */
import Link from 'next/link';
import { Building2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Botao } from '@/components/ui/botao';
import { Seletor } from '@/components/ui/campo';
import { Selo } from '@/components/ui/selo';
import { SeloStatus } from '@/components/ui/selo-status';
import { Valor } from '@/components/ui/valor';
import { formatarData, type DataISO } from '@/lib/domain/datas';
import { calcularStatus } from '@/lib/domain/status';
import { cn } from '@/lib/utils/cn';
import { atribuirEmpresa } from '../acoes';
import type { LancamentoSemEmpresa } from '../consultas';
import type { FiltroSemEmpresa } from '../esquemas';

export interface EmpresaParaAtribuir {
  id: string;
  apelido: string;
  /** Apelido da conta padrão ativa (null = a empresa não tem). */
  contaPadrao: string | null;
}

interface Props {
  lancamentos: LancamentoSemEmpresa[];
  /** Total de lançamentos que atendem ao filtro (pode ser maior que a lista exibida). */
  quantidade: number;
  totalCentavos: number;
  filtro: FiltroSemEmpresa;
  empresas: EmpresaParaAtribuir[];
  hoje: DataISO;
}

export function ListaSemEmpresa({ lancamentos, quantidade, totalCentavos, filtro, empresas, hoje }: Props) {
  const router = useRouter();
  const id = useId();
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [todosDoFiltro, setTodosDoFiltro] = useState(false);
  const [empresaId, setEmpresaId] = useState(empresas.length === 1 ? empresas[0].id : '');
  const [usarContaPadrao, setUsarContaPadrao] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const emAndamento = useRef(false);

  const empresa = empresas.find((e) => e.id === empresaId);
  const todosVisiveisMarcados = lancamentos.length > 0 && lancamentos.every((l) => selecionados.has(l.id));
  const quantidadeSelecionada = todosDoFiltro ? quantidade : selecionados.size;

  function alternar(idLancamento: string) {
    setTodosDoFiltro(false);
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(idLancamento)) novo.delete(idLancamento);
      else novo.add(idLancamento);
      return novo;
    });
  }

  function alternarVisiveis() {
    setTodosDoFiltro(false);
    setSelecionados(todosVisiveisMarcados ? new Set() : new Set(lancamentos.map((l) => l.id)));
  }

  async function atribuir() {
    if (emAndamento.current || !empresaId || quantidadeSelecionada === 0) return;
    emAndamento.current = true;
    setSalvando(true);
    try {
      const r = await atribuirEmpresa({
        empresaId,
        aplicarContaPadrao: usarContaPadrao && Boolean(empresa?.contaPadrao),
        ...(todosDoFiltro ? { filtro } : { ids: [...selecionados] }),
      });
      if (!r.ok) {
        toast.error(r.erro);
        return;
      }
      toast.success(`${r.mensagem} (${empresa?.apelido})`);
      setSelecionados(new Set());
      setTodosDoFiltro(false);
      router.refresh();
    } catch {
      toast.error('Erro de conexão. Recarregue a página para ver o estado atual.');
    } finally {
      emAndamento.current = false;
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm text-fg-2">
          <input type="checkbox" checked={todosVisiveisMarcados} onChange={alternarVisiveis} className="size-4.5 accent-primary" data-testid="marcar-visiveis" />
          Marcar {lancamentos.length === quantidade ? 'todos' : `os ${lancamentos.length} exibidos`}
        </label>
        {quantidade > lancamentos.length && (
          <button
            type="button"
            onClick={() => {
              setTodosDoFiltro(true);
              setSelecionados(new Set(lancamentos.map((l) => l.id)));
            }}
            className={cn('text-sm font-medium hover:underline', todosDoFiltro ? 'text-fg' : 'text-primary-text')}
            aria-pressed={todosDoFiltro}
            data-testid="marcar-todos-filtro"
          >
            {todosDoFiltro ? `Todos os ${quantidade} do filtro marcados` : `Marcar todos os ${quantidade} do filtro`}
          </button>
        )}
      </div>

      <ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border bg-surface" data-testid="lista-sem-empresa">
        {lancamentos.map((l) => {
          const marcado = todosDoFiltro || selecionados.has(l.id);
          const meta = [l.categoria.nome, l.origem?.contaOrigem ? `Conta original: ${l.origem.contaOrigem}` : null].filter(Boolean).join(' · ');
          return (
            <li key={l.id} className={cn('flex gap-3 px-4 py-3 transition-colors', marcado && 'bg-primary-soft/40')} data-testid="item-sem-empresa">
              <input
                type="checkbox"
                checked={marcado}
                onChange={() => alternar(l.id)}
                aria-label={`Selecionar ${l.fornecedor.nome}, ${l.descricao}, vence ${formatarData(l.vencimento)}`}
                className="mt-1 size-4.5 shrink-0 accent-primary"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <Link href={`/boletos/${l.id}`} className="min-w-0 truncate text-sm font-medium text-fg hover:text-primary-text" title={l.descricao}>
                    {l.descricao}
                  </Link>
                  <Valor centavos={l.valorCentavos} className="numeros shrink-0 text-sm font-semibold text-fg" />
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-fg-3">
                  <span className="min-w-0 truncate">
                    <span className="numeros text-fg-2">{formatarData(l.vencimento)}</span> · {meta}
                  </span>
                  {l.origem?.valorEstimado && <Selo tom="aviso">Valor estimado</Selo>}
                  {l.status === 'pago' && <SeloStatus status={calcularStatus(l, hoje)} />}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {quantidade > lancamentos.length && (
        <p className="px-1 text-meta text-fg-3">
          Mostrando os primeiros {lancamentos.length} de {quantidade} (<Valor centavos={totalCentavos} />). Refine os filtros ou use &quot;Marcar todos do filtro&quot;.
        </p>
      )}

      <div
        className="sticky bottom-[calc(var(--altura-barra-inferior)+env(safe-area-inset-bottom))] z-10 -mx-4 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border sm:bg-surface sm:px-5 lg:bottom-4"
        data-testid="barra-atribuir"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1">
            <p className="mb-1.5 text-sm font-medium text-fg-2" aria-live="polite">
              {quantidadeSelecionada === 0 ? 'Nenhum selecionado' : `${quantidadeSelecionada} ${quantidadeSelecionada === 1 ? 'selecionado' : 'selecionados'}`}
            </p>
            <label htmlFor={`${id}-empresa`} className="sr-only">
              Empresa
            </label>
            <Seletor
              id={`${id}-empresa`}
              value={empresaId}
              onChange={(e) => setEmpresaId(e.target.value)}
              placeholder="Escolha a empresa"
              opcoes={empresas.map((e) => ({ valor: e.id, rotulo: e.apelido }))}
              data-testid="empresa-atribuir"
            />
          </div>
          <label className={cn('flex min-h-11 items-center gap-2.5 text-sm lg:max-w-64', empresa && !empresa.contaPadrao ? 'text-fg-3' : 'text-fg-2')}>
            <input
              type="checkbox"
              checked={usarContaPadrao && Boolean(empresa?.contaPadrao ?? true)}
              disabled={Boolean(empresa && !empresa.contaPadrao)}
              onChange={(e) => setUsarContaPadrao(e.target.checked)}
              className="size-4.5 shrink-0 accent-primary"
              data-testid="usar-conta-padrao"
            />
            <span>
              {empresa && !empresa.contaPadrao ? 'Empresa sem conta padrão (ficam sem conta)' : `Debitar da conta padrão${empresa?.contaPadrao ? ` (${empresa.contaPadrao})` : ''} nos pendentes`}
            </span>
          </label>
          <Botao
            onClick={atribuir}
            disabled={!empresaId || quantidadeSelecionada === 0}
            carregando={salvando}
            textoCarregando="Salvando..."
            icone={<Building2 className="size-4.5" aria-hidden="true" />}
            className="w-full lg:w-auto"
            data-testid="atribuir-empresa"
          >
            Definir empresa
          </Botao>
        </div>
      </div>
    </div>
  );
}
