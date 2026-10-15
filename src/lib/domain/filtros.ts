/**
 * Filtros da lista de lançamentos (tela "Boletos").
 * Regras: docs/REGRAS-DE-NEGOCIO.md (seção Filtros).
 *
 * Um filtro combina PERÍODO (pela data de vencimento) + STATUS + fornecedor,
 * categoria, conta e pesquisa. Tudo fica na URL (dá para voltar, atualizar e
 * salvar nos favoritos) e é lido aqui de forma segura: valor inválido é
 * ignorado, nunca vira erro.
 *
 * Período e status viram um "critério" (faixa de vencimento + status gravado).
 * O mesmo critério monta a consulta no banco (features/lancamentos/consultas.ts)
 * e filtra em memória (testes), garantindo exatamente a mesma regra.
 */
import {
  adicionarDias,
  adicionarMeses,
  chaveDoMes,
  ehChaveMesValida,
  ehDataISOValida,
  fimDaSemana,
  fimDoMes,
  formatarData,
  formatarMes,
  inicioDaSemana,
  inicioDoMes,
  primeiroDiaDaChave,
  ultimoDiaDaChave,
  type ChaveMes,
  type DataISO,
} from './datas';
import type { StatusArmazenado } from './tipos';

// ------------------------------------------------------------------ período --

export const PERIODOS_RAPIDOS = [
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: 'amanha', rotulo: 'Amanhã' },
  { valor: 'semana', rotulo: 'Esta semana' },
  { valor: 'mes', rotulo: 'Este mês' },
  { valor: 'proximo-mes', rotulo: 'Próximo mês' },
  { valor: 'todos', rotulo: 'Todo o período' },
] as const;

export type PeriodoRapido = (typeof PERIODOS_RAPIDOS)[number]['valor'];

export type Periodo =
  | { tipo: PeriodoRapido }
  | { tipo: 'mes-escolhido'; mes: ChaveMes }
  | { tipo: 'dia'; data: DataISO }
  | { tipo: 'intervalo'; de: DataISO | ''; ate: DataISO | '' };

export type TipoPeriodo = Periodo['tipo'];

/** Opções do seletor de período, na ordem da tela. */
export const OPCOES_PERIODO: readonly { valor: TipoPeriodo; rotulo: string }[] = [
  ...PERIODOS_RAPIDOS.filter((p) => p.valor !== 'todos'),
  { valor: 'mes-escolhido', rotulo: 'Escolher o mês' },
  { valor: 'dia', rotulo: 'Um dia' },
  { valor: 'intervalo', rotulo: 'Intervalo de datas' },
  { valor: 'todos', rotulo: 'Todo o período' },
];

export const PERIODO_PADRAO: Periodo = { tipo: 'mes' };

/** Período "vazio" de cada tipo (ao trocar o tipo no seletor). */
export function periodoDoTipo(tipo: TipoPeriodo, hoje: DataISO): Periodo {
  switch (tipo) {
    case 'mes-escolhido':
      return { tipo, mes: chaveDoMes(hoje) };
    case 'dia':
      return { tipo, data: hoje };
    case 'intervalo':
      return { tipo, de: inicioDoMes(hoje), ate: hoje };
    default:
      return { tipo };
  }
}

/** Faixa de vencimento do período (sem `de`/`ate` = sem limite). */
export function faixaDoPeriodo(p: Periodo, hoje: DataISO): { de?: DataISO; ate?: DataISO } {
  switch (p.tipo) {
    case 'hoje':
      return { de: hoje, ate: hoje };
    case 'amanha': {
      const amanha = adicionarDias(hoje, 1);
      return { de: amanha, ate: amanha };
    }
    case 'semana':
      return { de: inicioDaSemana(hoje), ate: fimDaSemana(hoje) };
    case 'mes':
      return { de: inicioDoMes(hoje), ate: fimDoMes(hoje) };
    case 'proximo-mes': {
      const proximo = adicionarMeses(inicioDoMes(hoje), 1);
      return { de: proximo, ate: fimDoMes(proximo) };
    }
    case 'mes-escolhido':
      return { de: primeiroDiaDaChave(p.mes), ate: ultimoDiaDaChave(p.mes) };
    case 'dia':
      return { de: p.data, ate: p.data };
    case 'intervalo': {
      // Datas trocadas (de > até) são desinvertidas em vez de dar lista vazia.
      const [de, ate] = p.de && p.ate && p.de > p.ate ? [p.ate, p.de] : [p.de, p.ate];
      return { de: de || undefined, ate: ate || undefined };
    }
    case 'todos':
      return {};
  }
}

export function rotuloDoPeriodo(p: Periodo): string {
  switch (p.tipo) {
    case 'mes-escolhido':
      return formatarMes(p.mes);
    case 'dia':
      return formatarData(p.data);
    case 'intervalo': {
      const { de, ate } = faixaDoPeriodo(p, '2000-01-01');
      if (de && ate) return `${formatarData(de)} a ${formatarData(ate)}`;
      if (de) return `A partir de ${formatarData(de)}`;
      if (ate) return `Até ${formatarData(ate)}`;
      return 'Todo o período';
    }
    default:
      return PERIODOS_RAPIDOS.find((r) => r.valor === p.tipo)?.rotulo ?? p.tipo;
  }
}

// ------------------------------------------------------------------- status --

export const STATUS_FILTRO = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'em-aberto', rotulo: 'Em aberto' },
  { valor: 'pendentes', rotulo: 'A vencer' },
  { valor: 'atrasados', rotulo: 'Atrasados' },
  { valor: 'pagos', rotulo: 'Pagos' },
] as const;

export type StatusFiltro = (typeof STATUS_FILTRO)[number]['valor'];

export function rotuloDoStatus(s: StatusFiltro): string {
  return STATUS_FILTRO.find((f) => f.valor === s)?.rotulo ?? s;
}

// --------------------------------------------------------- filtros da lista --

/** Filtro de conta: id de uma conta, SEM_CONTA ou '' (todas). */
export const SEM_CONTA = 'sem';

/** Filtro de empresa: lançamentos SEM empresa definida (ex.: importados de planilha). */
export const SEM_EMPRESA = 'sem';

export interface FiltrosLista {
  periodo: Periodo;
  status: StatusFiltro;
  fornecedorId: string;
  categoriaId: string;
  contaId: string;
  /** Só lançamentos sem empresa definida (vale mesmo com uma empresa escolhida no topo). */
  semEmpresa: boolean;
  busca: string;
}

export const FILTROS_PADRAO: FiltrosLista = {
  periodo: PERIODO_PADRAO,
  status: 'todos',
  fornecedorId: '',
  categoriaId: '',
  contaId: '',
  semEmpresa: false,
  busca: '',
};

export interface CriterioBusca {
  vencimentoDe?: DataISO;
  vencimentoAte?: DataISO;
  status?: StatusArmazenado;
  /** Ordem por vencimento. */
  ordem: 'asc' | 'desc';
}

const maior = (a?: DataISO, b?: DataISO) => (a && b ? (a > b ? a : b) : (a ?? b));
const menor = (a?: DataISO, b?: DataISO) => (a && b ? (a < b ? a : b) : (a ?? b));

/**
 * Período ∩ status.
 * - "A vencer" = pendente com vencimento a partir de hoje;
 * - "Atrasados" = pendente vencido (antes de hoje);
 * - "Em aberto" = os dois juntos;
 * - "Pagos" vêm do mais recente para o mais antigo.
 * Se a interseção for vazia (ex.: atrasados do próximo mês) a faixa fica
 * invertida e a consulta volta sem resultados — o que é o correto.
 */
export function criterioDosFiltros(f: Pick<FiltrosLista, 'periodo' | 'status'>, hoje: DataISO): CriterioBusca {
  const { de, ate } = faixaDoPeriodo(f.periodo, hoje);
  switch (f.status) {
    case 'todos':
      return { vencimentoDe: de, vencimentoAte: ate, ordem: 'asc' };
    case 'em-aberto':
      return { vencimentoDe: de, vencimentoAte: ate, status: 'pendente', ordem: 'asc' };
    case 'pendentes':
      return { vencimentoDe: maior(de, hoje), vencimentoAte: ate, status: 'pendente', ordem: 'asc' };
    case 'atrasados':
      return { vencimentoDe: de, vencimentoAte: menor(ate, adicionarDias(hoje, -1)), status: 'pendente', ordem: 'asc' };
    case 'pagos':
      return { vencimentoDe: de, vencimentoAte: ate, status: 'pago', ordem: 'desc' };
  }
}

export function atendeCriterio(
  lancamento: { status: StatusArmazenado; vencimento: DataISO },
  criterio: CriterioBusca,
): boolean {
  if (criterio.status && lancamento.status !== criterio.status) return false;
  if (criterio.vencimentoDe && lancamento.vencimento < criterio.vencimentoDe) return false;
  if (criterio.vencimentoAte && lancamento.vencimento > criterio.vencimentoAte) return false;
  return true;
}

/** Quantos filtros além de período e status estão ativos (badge "Mais filtros"). */
export function quantidadeFiltrosExtras(f: FiltrosLista): number {
  return [f.fornecedorId, f.categoriaId, f.contaId, f.semEmpresa].filter(Boolean).length;
}

// ---------------------------------------------------------------------- URL --

export type ParametrosUrl = Record<string, string | string[] | undefined>;

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Parâmetro de URL como texto ('' se ausente ou repetido). */
export const texto = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '');
/** UUID válido ou ''. */
export const idOuVazio = (v: string | string[] | undefined) => (REGEX_UUID.test(texto(v)) ? texto(v) : '');
const dataOuVazio = (v: string | string[] | undefined) => (ehDataISOValida(texto(v)) ? texto(v) : '');

/** Links antigos (`?filtro=atrasados`, dos favoritos) continuam funcionando. */
function doFiltroAntigo(antigo: string): Pick<FiltrosLista, 'periodo' | 'status'> | null {
  const rapido = PERIODOS_RAPIDOS.find((p) => p.valor === antigo);
  if (rapido) return { periodo: { tipo: rapido.valor }, status: 'todos' };
  if (antigo === 'pendentes' || antigo === 'atrasados' || antigo === 'pagos') {
    return { periodo: { tipo: 'todos' }, status: antigo };
  }
  return null;
}

/** Período escolhido na URL (`periodo`, `mes`, `dia`, `de`, `ate`), ou null se não houver. */
export function lerPeriodo(p: ParametrosUrl, hoje: DataISO): Periodo | null {
  const tipo = texto(p.periodo);
  switch (tipo) {
    case 'mes-escolhido': {
      const mes = texto(p.mes);
      return { tipo, mes: ehChaveMesValida(mes) ? mes : chaveDoMes(hoje) };
    }
    case 'dia':
      return { tipo, data: dataOuVazio(p.dia) || hoje };
    case 'intervalo':
      return { tipo, de: dataOuVazio(p.de), ate: dataOuVazio(p.ate) };
    default: {
      const rapido = PERIODOS_RAPIDOS.find((r) => r.valor === tipo);
      return rapido ? { tipo: rapido.valor } : null;
    }
  }
}

/**
 * Período usado quando o usuário não escolheu nenhum: "Este mês" — ou, com
 * pesquisa, todo o período (para achar também contas futuras e antigas).
 */
export function periodoImplicito(busca: string): Periodo {
  return busca ? { tipo: 'todos' } : PERIODO_PADRAO;
}

/** O período foi escolhido pelo usuário (está na URL, no formato novo ou antigo)? */
export function periodoEstaNaUrl(p: ParametrosUrl, hoje: DataISO): boolean {
  return lerPeriodo(p, hoje) !== null || doFiltroAntigo(texto(p.filtro)) !== null;
}

/** Lê os filtros dos parâmetros da URL (valores inválidos são ignorados). */
export function lerFiltros(p: ParametrosUrl, hoje: DataISO): FiltrosLista {
  const busca = sanitizarBusca(texto(p.q));
  const antigo = doFiltroAntigo(texto(p.filtro));
  const periodo = lerPeriodo(p, hoje) ?? antigo?.periodo ?? periodoImplicito(busca);
  const status = STATUS_FILTRO.find((s) => s.valor === texto(p.status))?.valor ?? antigo?.status ?? 'todos';
  return {
    periodo,
    status,
    fornecedorId: idOuVazio(p.fornecedor),
    categoriaId: idOuVazio(p.categoria),
    contaId: texto(p.conta) === SEM_CONTA ? SEM_CONTA : idOuVazio(p.conta),
    semEmpresa: texto(p.empresa) === SEM_EMPRESA,
    busca,
  };
}

/**
 * Parâmetros de URL dos filtros (inverso de `lerFiltros`). Só vai o que
 * difere do padrão; o período é omitido quando é o implícito.
 */
export function parametrosDosFiltros(f: FiltrosLista): Record<string, string> {
  const r = parametrosDoPeriodo(f.periodo, f.busca);
  if (f.status !== 'todos') r.status = f.status;
  if (f.fornecedorId) r.fornecedor = f.fornecedorId;
  if (f.categoriaId) r.categoria = f.categoriaId;
  if (f.contaId) r.conta = f.contaId;
  if (f.semEmpresa) r.empresa = SEM_EMPRESA;
  if (f.busca) r.q = f.busca;
  return r;
}

/** Parâmetros do período (inverso de `lerPeriodo`); omite o período implícito. */
export function parametrosDoPeriodo(periodo: Periodo, busca: string): Record<string, string> {
  const r: Record<string, string> = {};
  if (periodo.tipo !== periodoImplicito(busca).tipo) r.periodo = periodo.tipo;
  if (periodo.tipo === 'mes-escolhido') r.mes = periodo.mes;
  if (periodo.tipo === 'dia') r.dia = periodo.data;
  if (periodo.tipo === 'intervalo') {
    if (periodo.de) r.de = periodo.de;
    if (periodo.ate) r.ate = periodo.ate;
  }
  return r;
}

/** `?periodo=...&status=...` pronto para um link (ou '' quando tudo é padrão). */
export function consultaDosFiltros(f: FiltrosLista): string {
  const qs = new URLSearchParams(parametrosDosFiltros(f)).toString();
  return qs ? `?${qs}` : '';
}

/** Atalho para links de outras telas: `/boletos` + filtros parciais. */
export function linkDaLista(parcial: Partial<FiltrosLista>): string {
  return `/boletos${consultaDosFiltros({ ...FILTROS_PADRAO, ...parcial })}`;
}

/**
 * Limpa o texto de busca para uso seguro no filtro `or` do PostgREST
 * (remove caracteres com significado sintático e curingas).
 */
export function sanitizarBusca(texto: string | null | undefined): string {
  return (texto ?? '')
    .replace(/[,()*%\\:"'.;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}
