'use client';

/**
 * Filtros da lista de Boletos: pesquisa, período, status e "Mais filtros"
 * (categoria, fornecedor, conta). Tudo fica na URL — esta tela só lê os
 * filtros atuais (vindos do servidor) e navega para a URL nova.
 * Regras (o que cada filtro significa): lib/domain/filtros.ts.
 */
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { Botao } from '@/components/ui/botao';
import { ChipsFiltro } from '@/components/ui/chips-filtro';
import { Entrada, Seletor } from '@/components/ui/campo';
import { Dialogo } from '@/components/ui/dialogo';
import { Spinner } from '@/components/ui/spinner';
import { adicionarDias, adicionarMesesNaChave, ehChaveMesValida, ehDataISOValida, type DataISO } from '@/lib/domain/datas';
import {
  FILTROS_PADRAO,
  OPCOES_PERIODO,
  PERIODO_PADRAO,
  SEM_CONTA,
  STATUS_FILTRO,
  consultaDosFiltros,
  periodoDoTipo,
  periodoImplicito,
  quantidadeFiltrosExtras,
  sanitizarBusca,
  type FiltrosLista,
  type Periodo,
  type TipoPeriodo,
} from '@/lib/domain/filtros';

export interface OpcaoFiltro {
  id: string;
  rotulo: string;
}

interface Props {
  filtros: FiltrosLista;
  /** false = o período não foi escolhido (é o implícito): a pesquisa então busca em todo o período. */
  periodoExplicito: boolean;
  hoje: DataISO;
  fornecedores: OpcaoFiltro[];
  categorias: OpcaoFiltro[];
  contas: OpcaoFiltro[];
}

export function FiltrosLancamentos({ filtros, periodoExplicito, hoje, fornecedores, categorias, contas }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [pendente, iniciar] = useTransition();
  const [maisAberto, setMaisAberto] = useState(false);

  function irPara(novos: FiltrosLista) {
    iniciar(() => router.replace(`${pathname}${consultaDosFiltros(novos)}`, { scroll: false }));
  }
  const mudar = (parcial: Partial<FiltrosLista>) => irPara({ ...filtros, ...parcial });

  const extras = quantidadeFiltrosExtras(filtros);
  const nomeDe = (lista: OpcaoFiltro[], id: string) => lista.find((o) => o.id === id)?.rotulo ?? '…';
  const ativos: { chave: string; rotulo: string; limpar: Partial<FiltrosLista> }[] = [];
  if (filtros.categoriaId) ativos.push({ chave: 'categoria', rotulo: nomeDe(categorias, filtros.categoriaId), limpar: { categoriaId: '' } });
  if (filtros.fornecedorId) ativos.push({ chave: 'fornecedor', rotulo: nomeDe(fornecedores, filtros.fornecedorId), limpar: { fornecedorId: '' } });
  if (filtros.contaId) {
    const rotulo = filtros.contaId === SEM_CONTA ? 'Sem conta definida' : nomeDe(contas, filtros.contaId);
    ativos.push({ chave: 'conta', rotulo, limpar: { contaId: '' } });
  }
  const algoFiltrado =
    ativos.length > 0 || filtros.status !== 'todos' || filtros.busca !== '' || (periodoExplicito && filtros.periodo.tipo !== PERIODO_PADRAO.tipo);

  return (
    <div className="mb-5 flex flex-col gap-3">
      <CampoPesquisa
        busca={filtros.busca}
        pendente={pendente}
        aoPesquisar={(busca) =>
          // Sem período escolhido, a pesquisa procura em todo o período (e volta ao mês ao limpar).
          mudar({ busca, periodo: periodoExplicito ? filtros.periodo : periodoImplicito(busca) })
        }
      />

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex min-w-0 flex-1 basis-40 flex-col gap-1">
          <label htmlFor="filtro-periodo" className="text-[13px] font-medium text-fg-2">
            Período
          </label>
          <Seletor
            id="filtro-periodo"
            value={filtros.periodo.tipo}
            onChange={(e) => mudar({ periodo: periodoDoTipo(e.target.value as TipoPeriodo, hoje) })}
            className="h-11"
          >
            {OPCOES_PERIODO.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.rotulo}
              </option>
            ))}
          </Seletor>
        </div>
        <Botao
          variante="secundario"
          onClick={() => setMaisAberto(true)}
          icone={<SlidersHorizontal className="size-4.5" aria-hidden="true" />}
          aria-label={extras ? `Mais filtros (${extras} ativos)` : 'Mais filtros'}
          data-testid="mais-filtros"
        >
          Filtros
          {extras > 0 && (
            <span className="grid size-5 place-items-center rounded-full bg-primary text-xs text-primary-fg" aria-hidden="true">
              {extras}
            </span>
          )}
        </Botao>
      </div>

      <DetalhePeriodo periodo={filtros.periodo} aoMudar={(periodo) => mudar({ periodo })} />

      <ChipsFiltro
        rotulo="Filtrar boletos"
        chips={STATUS_FILTRO.map((s) => ({
          href: `${pathname}${consultaDosFiltros({ ...filtros, status: s.valor })}`,
          rotulo: s.rotulo,
          ativo: s.valor === filtros.status,
        }))}
      />

      {algoFiltrado && (
        <ul className="flex flex-wrap items-center gap-2" aria-label="Filtros ativos">
          {ativos.map((a) => (
            <li key={a.chave}>
              <button
                type="button"
                onClick={() => mudar(a.limpar)}
                className="inline-flex h-8 max-w-64 items-center gap-1.5 rounded-full bg-primary-soft pr-2 pl-3 text-sm text-primary-soft-fg hover:brightness-95"
                aria-label={`Remover filtro: ${a.rotulo}`}
              >
                <span className="truncate">{a.rotulo}</span>
                <X className="size-4 shrink-0" aria-hidden="true" />
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => irPara(FILTROS_PADRAO)}
              className="h-8 rounded-full px-2 text-sm font-medium text-primary-text hover:underline"
            >
              Limpar filtros
            </button>
          </li>
        </ul>
      )}

      {maisAberto && (
        <DialogoMaisFiltros
          filtros={filtros}
          fornecedores={fornecedores}
          categorias={categorias}
          contas={contas}
          aoFechar={() => setMaisAberto(false)}
          aoAplicar={(parcial) => {
            setMaisAberto(false);
            mudar(parcial);
          }}
        />
      )}
    </div>
  );
}

/** Pesquisa enquanto digita (com atraso para não consultar a cada tecla). */
function CampoPesquisa({ busca, pendente, aoPesquisar }: { busca: string; pendente: boolean; aoPesquisar: (busca: string) => void }) {
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
      <label htmlFor="busca" className="sr-only">
        Pesquisar por fornecedor, nome ou descrição
      </label>
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-fg-3" aria-hidden="true" />
      <input
        id="busca"
        type="search"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Pesquisar fornecedor, nome ou descrição"
        enterKeyHint="search"
        autoComplete="off"
        className="h-12 w-full rounded-md border border-border-strong bg-surface pr-11 pl-11 text-fg placeholder:text-fg-3 focus:border-ring focus:ring-2 focus:ring-ring/25 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
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
              className="grid size-9 place-items-center rounded-md text-fg-3 hover:bg-surface-2 hover:text-fg"
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

const classeSeta = 'grid size-11 shrink-0 place-items-center rounded-md border border-border-strong bg-surface text-fg-2 hover:bg-surface-2 hover:text-fg';

/**
 * Campos do período personalizado (mês, dia ou intervalo). Os campos não são
 * controlados: `key` recria o campo quando a URL muda, sem "piscar" enquanto
 * a navegação acontece.
 */
function DetalhePeriodo({ periodo, aoMudar }: { periodo: Periodo; aoMudar: (p: Periodo) => void }) {
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
        <label className="flex min-w-0 flex-col gap-1 text-[13px] font-medium text-fg-2">
          De
          <Entrada key={`de-${periodo.de}`} type="date" aria-label="De" defaultValue={periodo.de} onChange={(e) => mudarLimite('de', e.target.value)} className="h-11" />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-[13px] font-medium text-fg-2">
          Até
          <Entrada key={`ate-${periodo.ate}`} type="date" aria-label="Até" defaultValue={periodo.ate} onChange={(e) => mudarLimite('ate', e.target.value)} className="h-11" />
        </label>
      </div>
    );
  }
  return null;
}

interface PropsDialogo {
  filtros: FiltrosLista;
  fornecedores: OpcaoFiltro[];
  categorias: OpcaoFiltro[];
  contas: OpcaoFiltro[];
  aoFechar: () => void;
  aoAplicar: (parcial: Pick<FiltrosLista, 'categoriaId' | 'fornecedorId' | 'contaId'>) => void;
}

/** Categoria, fornecedor e conta: escolhe tudo e aplica de uma vez. */
function DialogoMaisFiltros({ filtros, fornecedores, categorias, contas, aoFechar, aoAplicar }: PropsDialogo) {
  const [escolha, setEscolha] = useState({ categoriaId: filtros.categoriaId, fornecedorId: filtros.fornecedorId, contaId: filtros.contaId });
  const campo = (id: string, rotulo: string, chave: keyof typeof escolha, todos: string, opcoes: OpcaoFiltro[], extra?: OpcaoFiltro) => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-fg-2">
        {rotulo}
      </label>
      <Seletor id={id} value={escolha[chave]} onChange={(e) => setEscolha((atual) => ({ ...atual, [chave]: e.target.value }))} className="h-11">
        <option value="">{todos}</option>
        {extra && <option value={extra.id}>{extra.rotulo}</option>}
        {opcoes.map((o) => (
          <option key={o.id} value={o.id}>
            {o.rotulo}
          </option>
        ))}
      </Seletor>
    </div>
  );
  const algum = Boolean(escolha.categoriaId || escolha.fornecedorId || escolha.contaId);

  return (
    <Dialogo
      aberto
      onFechar={aoFechar}
      titulo="Mais filtros"
      rodape={
        <>
          {algum && (
            <Botao variante="fantasma" onClick={() => setEscolha({ categoriaId: '', fornecedorId: '', contaId: '' })}>
              Limpar estes filtros
            </Botao>
          )}
          <Botao onClick={() => aoAplicar(escolha)}>Aplicar</Botao>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {campo('filtro-categoria', 'Categoria', 'categoriaId', 'Todas as categorias', categorias)}
        {campo('filtro-fornecedor', 'Fornecedor', 'fornecedorId', 'Todos os fornecedores', fornecedores)}
        {contas.length > 0 &&
          campo('filtro-conta', 'Conta', 'contaId', 'Todas as contas', contas, { id: SEM_CONTA, rotulo: 'Sem conta definida' })}
      </div>
    </Dialogo>
  );
}
