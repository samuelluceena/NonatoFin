'use client';

/**
 * Peças comuns dos filtros de listas (Boletos, Transações): pesquisa com
 * atraso, detalhe do período (mês, dia ou intervalo) e etiquetas dos filtros
 * ativos com "Limpar filtros". Só apresentação: o significado de cada filtro
 * fica em lib/domain.
 */
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { adicionarDias, adicionarMesesNaChave, ehChaveMesValida, ehDataISOValida } from '@/lib/domain/datas';
import { sanitizarBusca, type Periodo } from '@/lib/domain/filtros';
import { Entrada, classeControle } from './campo';
import { Seletor } from './seletor';
import { Spinner } from './spinner';

interface PropsPesquisa {
  /** id do campo (padrão: "busca"). */
  id?: string;
  busca: string;
  pendente: boolean;
  aoPesquisar: (busca: string) => void;
  /** Rótulo acessível (o campo não tem rótulo visível). */
  rotulo?: string;
  placeholder?: string;
}

/** Pesquisa enquanto digita (com atraso para não consultar a cada tecla). */
export function CampoPesquisa({
  id = 'busca',
  busca,
  pendente,
  aoPesquisar,
  rotulo = 'Pesquisar por fornecedor, nome ou descrição',
  placeholder = 'Pesquisar fornecedor, nome ou descrição',
}: PropsPesquisa) {
  const [texto, setTexto] = useState(busca);
  // A pesquisa mudou por fora (ex.: "Limpar filtros"): acompanha o campo.
  const [ultimaBusca, setUltimaBusca] = useState(busca);
  if (busca !== ultimaBusca) {
    setUltimaBusca(busca);
    if (sanitizarBusca(texto) !== busca) setTexto(busca);
  }

  useEffect(() => {
    if (sanitizarBusca(texto) === busca) return; // nada novo para pesquisar
    const t = setTimeout(() => aoPesquisar(texto.trim()), 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dispara somente quando o texto muda
  }, [texto]);

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        aoPesquisar(texto.trim());
      }}
      className="relative"
    >
      <label htmlFor={id} className="sr-only">
        {rotulo}
      </label>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4.5 -translate-y-1/2 text-fg-3" aria-hidden="true" />
      <input
        id={id}
        type="search"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={placeholder}
        enterKeyHint="search"
        autoComplete="off"
        className={classeControle('h-11 pr-11 pl-10 lg:h-10 [&::-webkit-search-cancel-button]:hidden')}
      />
      <span className="absolute top-1/2 right-2 -translate-y-1/2">
        {pendente ? (
          <span className="grid size-9 place-items-center text-fg-3">
            <Spinner />
          </span>
        ) : (
          texto && (
            <button
              type="button"
              onClick={() => setTexto('')}
              className="grid size-8 place-items-center rounded-md text-fg-3 hover:bg-surface-2 hover:text-fg"
              aria-label="Limpar pesquisa"
            >
              <X className="size-4.5" aria-hidden="true" />
            </button>
          )
        )}
      </span>
    </form>
  );
}

const classeSeta =
  'grid size-11 shrink-0 place-items-center rounded-md border border-border-strong bg-input text-fg-2 shadow-xs transition-colors hover:bg-surface-2 hover:text-fg lg:size-10';

/**
 * Campos do período personalizado (mês, dia ou intervalo). Os campos não são
 * controlados: `key` recria o campo quando a URL muda, sem "piscar" enquanto
 * a navegação acontece.
 */
export function DetalhePeriodo({ periodo, aoMudar }: { periodo: Periodo; aoMudar: (p: Periodo) => void }) {
  if (periodo.tipo === 'mes-escolhido') {
    return (
      <div className="flex items-center gap-2">
        <button type="button" className={classeSeta} onClick={() => aoMudar({ ...periodo, mes: adicionarMesesNaChave(periodo.mes, -1) })} aria-label="Mês anterior">
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>
        <Entrada
          key={periodo.mes}
          type="month"
          aria-label="Mês"
          defaultValue={periodo.mes}
          onChange={(e) => ehChaveMesValida(e.target.value) && aoMudar({ ...periodo, mes: e.target.value })}
          className="h-11 min-w-0 flex-1"
        />
        <button type="button" className={classeSeta} onClick={() => aoMudar({ ...periodo, mes: adicionarMesesNaChave(periodo.mes, 1) })} aria-label="Próximo mês">
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>
      </div>
    );
  }
  if (periodo.tipo === 'dia') {
    return (
      <div className="flex items-center gap-2">
        <button type="button" className={classeSeta} onClick={() => aoMudar({ ...periodo, data: adicionarDias(periodo.data, -1) })} aria-label="Dia anterior">
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>
        <Entrada
          key={periodo.data}
          type="date"
          aria-label="Dia"
          defaultValue={periodo.data}
          onChange={(e) => ehDataISOValida(e.target.value) && aoMudar({ ...periodo, data: e.target.value })}
          className="h-11 min-w-0 flex-1"
        />
        <button type="button" className={classeSeta} onClick={() => aoMudar({ ...periodo, data: adicionarDias(periodo.data, 1) })} aria-label="Próximo dia">
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>
      </div>
    );
  }
  if (periodo.tipo === 'intervalo') {
    const mudarLimite = (campo: 'de' | 'ate', valor: string) => {
      if (valor === '' || ehDataISOValida(valor)) aoMudar({ ...periodo, [campo]: valor });
    };
    return (
      <div className="grid grid-cols-2 gap-2">
        <label className="flex min-w-0 flex-col gap-1 text-meta font-medium text-fg-2">
          De
          <Entrada key={`de-${periodo.de}`} type="date" aria-label="De" defaultValue={periodo.de} onChange={(e) => mudarLimite('de', e.target.value)} className="h-11" />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-meta font-medium text-fg-2">
          Até
          <Entrada key={`ate-${periodo.ate}`} type="date" aria-label="Até" defaultValue={periodo.ate} onChange={(e) => mudarLimite('ate', e.target.value)} className="h-11" />
        </label>
      </div>
    );
  }
  return null;
}

export interface EtiquetaFiltro {
  chave: string;
  rotulo: string;
  remover: () => void;
}

/** Filtros ativos como etiquetas removíveis + "Limpar filtros". */
export function FiltrosAtivos({ etiquetas, aoLimpar }: { etiquetas: EtiquetaFiltro[]; aoLimpar: () => void }) {
  return (
    <ul className="flex flex-wrap items-center gap-2" aria-label="Filtros ativos">
      {etiquetas.map((a) => (
        <li key={a.chave}>
          <button
            type="button"
            onClick={a.remover}
            className="inline-flex h-8 max-w-64 items-center gap-1 rounded-md border border-info-border bg-primary-soft pr-1.5 pl-2.5 text-sm text-primary-soft-fg transition-[filter] hover:brightness-95 dark:hover:brightness-125"
            aria-label={`Remover filtro: ${a.rotulo}`}
          >
            <span className="truncate">{a.rotulo}</span>
            <X className="size-4 shrink-0" aria-hidden="true" />
          </button>
        </li>
      ))}
      <li>
        <button type="button" onClick={aoLimpar} className="h-8 rounded-md px-2 text-sm font-medium text-primary-text hover:underline">
          Limpar filtros
        </button>
      </li>
    </ul>
  );
}

interface PropsSeletorFiltro {
  id: string;
  /** Nome do filtro (rótulo acessível; o valor escolhido aparece no próprio campo). */
  rotulo: string;
  valor: string;
  aoMudar: (valor: string) => void;
  opcoes: readonly { valor: string; rotulo: string }[];
  icone?: ReactNode;
  /** Destaca quando o valor difere do padrão (filtro aplicado). */
  ativo?: boolean;
  className?: string;
}

/** Filtro compacto em forma de "chip" (Seletor customizado, variante `filtro`). */
export function SeletorFiltro({ id, rotulo, valor, aoMudar, opcoes, icone, ativo, className }: PropsSeletorFiltro) {
  return (
    <div className={cn('relative shrink-0', className)}>
      <label htmlFor={id} className="sr-only">
        {rotulo}
      </label>
      <Seletor id={id} title={rotulo} variante="filtro" icone={icone} ativo={ativo} value={valor} onChange={(e) => aoMudar(e.target.value)} opcoes={opcoes} />
    </div>
  );
}

/** Campo de escolha dentro do painel "Mais filtros" (rótulo visível + opção "Todos"). */
export function CampoFiltro({
  id,
  rotulo,
  valor,
  aoMudar,
  todos,
  opcoes,
}: {
  id: string;
  rotulo: string;
  valor: string;
  aoMudar: (valor: string) => void;
  /** Rótulo da opção vazia ("Todas as categorias"). */
  todos: string;
  opcoes: readonly { id: string; rotulo: string }[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-fg-2">
        {rotulo}
      </label>
      <Seletor
        id={id}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        ativo={Boolean(valor)}
        opcoes={[{ valor: '', rotulo: todos }, ...opcoes.map((o) => ({ valor: o.id, rotulo: o.rotulo }))]}
      />
    </div>
  );
}

/**
 * Barra de filtros: pesquisa em cima (largura total, texto sempre legível) e
 * controles compactos numa linha abaixo (rolagem lateral no celular).
 */
export function BarraFiltros({ pesquisa, children }: { pesquisa: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="min-w-0">{pesquisa}</div>
      <div className="sem-barra-rolagem -mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {children}
      </div>
    </div>
  );
}
