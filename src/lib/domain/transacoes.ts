/**
 * Transações: visão cronológica e centralizada da movimentação financeira.
 * Regras: docs/REGRAS-DE-NEGOCIO.md (seção Transações).
 *
 * Não existe tabela de transações. A visão é COMPOSTA a partir do que já
 * existe, sem copiar nenhuma regra financeira:
 *
 *  - lançamento pendente → "Conta a pagar": OBRIGAÇÃO (ainda não saiu
 *    dinheiro). Data = vencimento; status Pendente/Atrasado (calcularStatus).
 *  - lançamento pago     → "Pagamento": SAÍDA DE CAIXA. Data = data do
 *    pagamento (pago_em no fuso do app).
 *  - movimento entrada   → "Entrada": confirmada (entrou) ou prevista.
 *  - movimento transferência → "Transferência": os dois lados viram um item
 *    neutro (não é receita nem despesa).
 *  - movimento conferência → "Ajuste" (conferência com o extrato / saldo
 *    inicial). Conferências sem diferença não mexem no saldo e ficam de fora.
 *  - compra no cartão   → "Compra no cartão": informativa. O dinheiro sai
 *    pela FATURA, que já é um lançamento (conta a pagar/pagamento) — por isso
 *    a compra não entra em nenhum total (senão seria contada duas vezes).
 *
 * Datas, períodos, status e busca reaproveitam lib/domain/filtros.ts,
 * status.ts e saldos.ts.
 */
import { dataNoFuso, formatarData, formatarMes, type DataISO } from './datas';
import { formatarMoeda, formatarMoedaComSinal, somarCentavos, type Centavos } from './dinheiro';
import {
  SEM_CONTA,
  SEM_EMPRESA,
  criterioDosFiltros,
  faixaDoPeriodo,
  idOuVazio,
  lerPeriodo,
  parametrosDoPeriodo,
  periodoImplicito,
  sanitizarBusca,
  texto,
  type CriterioBusca,
  type ParametrosUrl,
  type Periodo,
} from './filtros';
import { rotuloConta, rotuloMovimento } from './saldos';
import { calcularStatus } from './status';
import type { Categoria, CompraCartao, ContaResumida, Empresa, Fornecedor, Lancamento, MovimentoConta, TipoMovimento } from './tipos';

// -------------------------------------------------------------------- tipos --

export type TipoTransacao = 'entrada' | 'conta-a-pagar' | 'pagamento' | 'transferencia' | 'ajuste' | 'compra-cartao';

/** Cada tipo tem os seus status (não há um conjunto único forçado). */
export type StatusTransacao = 'pendente' | 'atrasado' | 'pago' | 'previsto' | 'confirmado' | 'na-fatura';

export const ROTULO_TIPO: Record<TipoTransacao, string> = {
  entrada: 'Entrada',
  'conta-a-pagar': 'Conta a pagar',
  pagamento: 'Pagamento',
  transferencia: 'Transferência',
  ajuste: 'Ajuste',
  'compra-cartao': 'Compra no cartão',
};

export const ROTULO_STATUS_TRANSACAO: Record<StatusTransacao, string> = {
  pendente: 'Pendente',
  atrasado: 'Atrasado',
  pago: 'Pago',
  previsto: 'Previsto',
  confirmado: 'Confirmado',
  'na-fatura': 'Na fatura',
};

export interface LinkTransacao {
  rotulo: string;
  href: string;
}

export interface Transacao {
  /** Única na lista (prefixo da origem + id). */
  chave: string;
  tipo: TipoTransacao;
  status: StatusTransacao;
  data: DataISO;
  /** Desempate dentro do mesmo dia (instante; maior = mais recente). */
  ordem: string;
  /** Linha principal: fornecedor, descrição da entrada, "Transferência"... */
  titulo: string;
  /** Linha secundária (descrição do lançamento, cartão...). */
  descricao: string | null;
  /** Informação extra: vencimento de um pagamento, parcelas, saldo no banco, origem → destino. */
  complemento: string | null;
  fornecedor: Fornecedor | null;
  categoria: Pick<Categoria, 'id' | 'nome'> | null;
  empresa: Pick<Empresa, 'id' | 'apelido'> | null;
  conta: ContaResumida | null;
  /** Transferência: conta que recebeu. */
  contaDestino: ContaResumida | null;
  /** Sempre positivo; a direção está em `sinal`. */
  valorCentavos: Centavos;
  /** +1 entra, −1 sai, 0 sem direção (transferência, compra no cartão). */
  sinal: 1 | -1 | 0;
  /** O dinheiro já se moveu? (false = obrigação ou previsão) */
  efetivo: boolean;
  /** Tela de detalhe existente. */
  href: string;
  /** Atalhos secundários (menu de ações). */
  links: LinkTransacao[];
}

// ------------------------------------------------------------------ filtros --

export const TIPOS_FILTRO_TRANSACAO = [
  { valor: 'todos', rotulo: 'Todos os tipos' },
  { valor: 'entradas', rotulo: 'Entradas' },
  { valor: 'contas-a-pagar', rotulo: 'Contas a pagar' },
  { valor: 'pagamentos', rotulo: 'Pagamentos' },
  { valor: 'transferencias', rotulo: 'Transferências' },
  { valor: 'ajustes', rotulo: 'Ajustes' },
  { valor: 'compras-cartao', rotulo: 'Compras no cartão' },
] as const;

export type TipoFiltroTransacao = (typeof TIPOS_FILTRO_TRANSACAO)[number]['valor'];

export const STATUS_FILTRO_TRANSACAO = [
  { valor: 'todos', rotulo: 'Todos os status' },
  { valor: 'em-aberto', rotulo: 'Em aberto' },
  { valor: 'a-vencer', rotulo: 'A vencer' },
  { valor: 'atrasados', rotulo: 'Atrasados' },
  { valor: 'pagos', rotulo: 'Pagos' },
  { valor: 'previstos', rotulo: 'Previstos' },
  { valor: 'confirmados', rotulo: 'Confirmados' },
] as const;

export type StatusFiltroTransacao = (typeof STATUS_FILTRO_TRANSACAO)[number]['valor'];

export interface FiltrosTransacoes {
  periodo: Periodo;
  tipo: TipoFiltroTransacao;
  status: StatusFiltroTransacao;
  /** Empresa escolhida nesta tela (a do seletor do topo é aplicada à parte). */
  empresaId: string;
  categoriaId: string;
  /** Id da conta ou SEM_CONTA. */
  contaId: string;
  fornecedorId: string;
  busca: string;
}

export const FILTROS_TRANSACOES_PADRAO: FiltrosTransacoes = {
  periodo: periodoImplicito(''),
  tipo: 'todos',
  status: 'todos',
  empresaId: '',
  categoriaId: '',
  contaId: '',
  fornecedorId: '',
  busca: '',
};

export function rotuloTipoFiltro(t: TipoFiltroTransacao): string {
  return TIPOS_FILTRO_TRANSACAO.find((o) => o.valor === t)?.rotulo ?? t;
}

export function rotuloStatusFiltro(s: StatusFiltroTransacao): string {
  return STATUS_FILTRO_TRANSACAO.find((o) => o.valor === s)?.rotulo ?? s;
}

/** Lê os filtros da URL (valores inválidos são ignorados, nunca viram erro). */
export function lerFiltrosTransacoes(p: ParametrosUrl, hoje: DataISO): FiltrosTransacoes {
  const busca = sanitizarBusca(texto(p.q));
  return {
    periodo: lerPeriodo(p, hoje) ?? periodoImplicito(busca),
    tipo: TIPOS_FILTRO_TRANSACAO.find((t) => t.valor === texto(p.tipo))?.valor ?? 'todos',
    status: STATUS_FILTRO_TRANSACAO.find((s) => s.valor === texto(p.status))?.valor ?? 'todos',
    empresaId: texto(p.empresa) === SEM_EMPRESA ? SEM_EMPRESA : idOuVazio(p.empresa),
    categoriaId: idOuVazio(p.categoria),
    contaId: texto(p.conta) === SEM_CONTA ? SEM_CONTA : idOuVazio(p.conta),
    fornecedorId: idOuVazio(p.fornecedor),
    busca,
  };
}

/** Inverso de `lerFiltrosTransacoes`: só vai para a URL o que difere do padrão. */
export function parametrosDosFiltrosTransacoes(f: FiltrosTransacoes): Record<string, string> {
  const r = parametrosDoPeriodo(f.periodo, f.busca);
  if (f.tipo !== 'todos') r.tipo = f.tipo;
  if (f.status !== 'todos') r.status = f.status;
  if (f.empresaId) r.empresa = f.empresaId;
  if (f.categoriaId) r.categoria = f.categoriaId;
  if (f.contaId) r.conta = f.contaId;
  if (f.fornecedorId) r.fornecedor = f.fornecedorId;
  if (f.busca) r.q = f.busca;
  return r;
}

export function consultaDosFiltrosTransacoes(f: FiltrosTransacoes, extra: Record<string, string> = {}): string {
  const qs = new URLSearchParams({ ...parametrosDosFiltrosTransacoes(f), ...extra }).toString();
  return qs ? `?${qs}` : '';
}

/** Quantos filtros do diálogo "Filtros" estão ativos (empresa, categoria, conta, fornecedor). */
export function quantidadeFiltrosExtrasTransacoes(f: FiltrosTransacoes): number {
  return [f.empresaId, f.categoriaId, f.contaId, f.fornecedorId].filter(Boolean).length;
}

/**
 * Empresa aplicada à consulta: a do seletor do topo vale para o app inteiro;
 * o filtro desta tela só escolhe quando o topo está em "Todas".
 * `null` = combinação impossível (filtro de outra empresa) → lista vazia.
 * "Sem empresa definida" (SEM_EMPRESA) vale mesmo com uma empresa no topo.
 */
export function empresaDaConsulta(empresaDoTopo: string | undefined, empresaDoFiltro: string): string | undefined | null {
  if (empresaDoFiltro === SEM_EMPRESA) return SEM_EMPRESA;
  if (!empresaDoTopo) return empresaDoFiltro || undefined;
  if (empresaDoFiltro && empresaDoFiltro !== empresaDoTopo) return null;
  return empresaDoTopo;
}

// --------------------------------------------------------- plano de consulta --

type Faixa = { de?: DataISO; ate?: DataISO };

/**
 * O que buscar em cada fonte para os filtros escolhidos (null = a fonte não
 * participa). Filtros que não se aplicam a uma fonte a excluem, em vez de
 * serem ignorados: ex.: "fornecedor" só existe em lançamentos; "categoria",
 * em lançamentos e compras; "conta", em lançamentos e movimentos.
 */
export interface PlanoTransacoes {
  /** Lançamentos em aberto, pela data de vencimento. */
  pendentes: CriterioBusca | null;
  /** Lançamentos pagos, pela data do pagamento. */
  pagos: Faixa | null;
  /** Movimentos de conta, pela data do movimento. */
  movimentos: (Faixa & { tipos: TipoMovimento[]; confirmado?: boolean }) | null;
  /** Compras no cartão, pela data da compra. */
  compras: Faixa | null;
}

const STATUS_DOS_PENDENTES = { todos: 'em-aberto', 'em-aberto': 'em-aberto', 'a-vencer': 'pendentes', atrasados: 'atrasados' } as const;

export function planoDasTransacoes(f: FiltrosTransacoes, hoje: DataISO): PlanoTransacoes {
  const faixa = faixaDoPeriodo(f.periodo, hoje);
  const tipo = (...aceitos: TipoFiltroTransacao[]) => f.tipo === 'todos' || aceitos.includes(f.tipo);
  const status = (...aceitos: StatusFiltroTransacao[]) => f.status === 'todos' || aceitos.includes(f.status);
  const semConta = f.contaId === SEM_CONTA;
  // Só lançamentos podem estar sem empresa (contas e cartões sempre têm uma).
  const semEmpresa = f.empresaId === SEM_EMPRESA;

  const statusPendente = f.status in STATUS_DOS_PENDENTES ? STATUS_DOS_PENDENTES[f.status as keyof typeof STATUS_DOS_PENDENTES] : null;
  const pendentes =
    tipo('contas-a-pagar') && statusPendente ? criterioDosFiltros({ periodo: f.periodo, status: statusPendente }, hoje) : null;

  const pagos = tipo('pagamentos') && status('pagos') ? faixa : null;

  let movimentos: PlanoTransacoes['movimentos'] = null;
  if (!f.fornecedorId && !f.categoriaId && !semConta && !semEmpresa && status('previstos', 'confirmados')) {
    const tipos: TipoMovimento[] = [];
    if (tipo('entradas')) tipos.push('entrada');
    // Transferências e ajustes são sempre confirmados (não existem previstos).
    if (tipo('transferencias') && f.status !== 'previstos') tipos.push('transferencia');
    if (tipo('ajustes') && f.status !== 'previstos') tipos.push('conferencia');
    const confirmado = f.status === 'previstos' ? false : f.status === 'confirmados' ? true : undefined;
    if (tipos.length > 0) movimentos = { ...faixa, tipos, confirmado };
  }

  // Compra no cartão: sem status próprio de pagamento, sem fornecedor e sem conta.
  const compras = tipo('compras-cartao') && f.status === 'todos' && !f.fornecedorId && !f.contaId && !semEmpresa ? faixa : null;

  return { pendentes, pagos, movimentos, compras };
}

// ------------------------------------------------------ montagem dos itens --

const rotuloOuNulo = (c: ContaResumida | null) => (c ? rotuloConta(c) : null);

/** Lançamento → conta a pagar (obrigação) ou pagamento (saída de caixa). */
export function transacaoDoLancamento(l: Lancamento, hoje: DataISO): Transacao {
  const status = calcularStatus(l, hoje);
  const pago = status === 'pago';
  const links: LinkTransacao[] = [];
  if (l.conta) links.push({ rotulo: 'Ver conta', href: `/contas/${l.conta.id}` });
  if (l.fornecedor.id) links.push({ rotulo: 'Ver fornecedor', href: `/fornecedores/${l.fornecedor.id}` });
  if (l.fatura) links.push({ rotulo: 'Ver cartão', href: `/cartoes/${l.fatura.cartaoId}` });

  const extras: string[] = [];
  if (pago) extras.push(`Vencimento ${formatarData(l.vencimento)}`);
  if (l.recorrencia) extras.push(`Parcela ${l.recorrencia.parcela}/${l.recorrencia.totalParcelas}`);

  return {
    chave: `l-${l.id}`,
    tipo: pago ? 'pagamento' : 'conta-a-pagar',
    status,
    // Pagamento aparece no dia em que o dinheiro saiu; obrigação, no vencimento.
    data: pago && l.pagoEm ? dataNoFuso(l.pagoEm) : l.vencimento,
    ordem: (pago ? l.pagoEm : null) ?? l.createdAt,
    titulo: l.fornecedor.nome,
    descricao: l.descricao,
    complemento: extras.length ? extras.join(' · ') : null,
    fornecedor: l.fornecedor.id ? l.fornecedor : null,
    categoria: l.categoria.id ? l.categoria : null,
    empresa: l.empresa.id ? { id: l.empresa.id, apelido: l.empresa.apelido } : null,
    conta: l.conta,
    contaDestino: null,
    valorCentavos: l.valorCentavos,
    sinal: -1,
    efetivo: pago,
    href: `/boletos/${l.id}`,
    links,
  };
}

/** Conta do movimento, com o necessário para exibir e identificar o saldo inicial. */
export interface ContaDoMovimento extends ContaResumida {
  empresa: Pick<Empresa, 'id' | 'apelido'> | null;
  /** Instante em que a conta foi cadastrada. */
  criadaEm: string;
}

/**
 * A conferência gravada no cadastro da conta é o "Saldo inicial" (o cadastro
 * grava a conta e, em seguida, a conferência com o saldo de hoje).
 */
export function ehSaldoInicial(m: Pick<MovimentoConta, 'tipo' | 'createdAt'>, contaCriadaEm: string): boolean {
  if (m.tipo !== 'conferencia') return false;
  const diferenca = Date.parse(m.createdAt) - Date.parse(contaCriadaEm);
  return diferenca >= 0 && diferenca <= 60_000;
}

/** Entrada ou conferência (ajuste). Transferências: `transacaoDaTransferencia`. */
export function transacaoDoMovimento(m: MovimentoConta, conta: ContaDoMovimento): Transacao {
  const base = {
    chave: `m-${m.id}`,
    data: m.data,
    ordem: m.createdAt,
    fornecedor: null,
    categoria: null,
    empresa: conta.empresa,
    conta: { id: conta.id, apelido: conta.apelido, final: conta.final },
    contaDestino: null,
    valorCentavos: Math.abs(m.valorCentavos),
    href: `/contas/${conta.id}`,
    links: [{ rotulo: 'Ver extrato da conta', href: `/contas/${conta.id}` }],
  };
  if (m.tipo === 'conferencia') {
    return {
      ...base,
      tipo: 'ajuste',
      status: 'confirmado',
      titulo: rotuloMovimento(m, ehSaldoInicial(m, conta.criadaEm)),
      descricao: m.descricao,
      complemento: m.saldoInformado === null ? null : `Saldo no banco: ${formatarMoeda(m.saldoInformado)}`,
      sinal: m.valorCentavos < 0 ? -1 : 1,
      efetivo: true,
    };
  }
  if (m.tipo === 'transferencia') throw new Error('Use transacaoDaTransferencia para transferências.');
  return {
    ...base,
    tipo: 'entrada',
    status: m.confirmado ? 'confirmado' : 'previsto',
    titulo: m.descricao || rotuloMovimento(m),
    descricao: m.descricao ? rotuloMovimento(m) : null,
    complemento: null,
    sinal: 1,
    efetivo: m.confirmado,
  };
}

/**
 * Os dois lados de uma transferência viram UM item neutro: não é receita
 * nem despesa, só muda o dinheiro de conta.
 */
export function transacaoDaTransferencia(lados: { movimento: MovimentoConta; conta: ContaDoMovimento }[]): Transacao {
  const saida = lados.find((l) => l.movimento.valorCentavos < 0) ?? null;
  const entrada = lados.find((l) => l.movimento.valorCentavos > 0) ?? null;
  const referencia = (saida ?? entrada ?? lados[0]).movimento;
  const origem = saida?.conta ?? null;
  const destino = entrada?.conta ?? null;
  const resumida = (c: ContaDoMovimento | null): ContaResumida | null => (c ? { id: c.id, apelido: c.apelido, final: c.final } : null);
  const principal = origem ?? destino;
  const links: LinkTransacao[] = [];
  if (origem) links.push({ rotulo: 'Ver conta de origem', href: `/contas/${origem.id}` });
  if (destino) links.push({ rotulo: 'Ver conta de destino', href: `/contas/${destino.id}` });
  return {
    chave: `t-${referencia.transferenciaId ?? referencia.id}`,
    tipo: 'transferencia',
    status: 'confirmado',
    data: referencia.data,
    ordem: referencia.createdAt,
    titulo: 'Transferência',
    descricao: referencia.descricao,
    complemento: `${rotuloOuNulo(resumida(origem)) ?? 'Conta de origem'} → ${rotuloOuNulo(resumida(destino)) ?? 'conta de destino'}`,
    fornecedor: null,
    categoria: null,
    empresa: principal?.empresa ?? null,
    conta: resumida(origem),
    contaDestino: resumida(destino),
    valorCentavos: Math.abs(referencia.valorCentavos),
    sinal: 0,
    efetivo: true,
    href: principal ? `/contas/${principal.id}` : '/contas',
    links,
  };
}

export interface CartaoDaCompra {
  id: string;
  nome: string;
  final: string | null;
  empresa: Pick<Empresa, 'id' | 'apelido'> | null;
}

/** Compra no cartão: informativa (o dinheiro sai pela fatura). */
export function transacaoDaCompra(c: CompraCartao & { createdAt: string }, cartao: CartaoDaCompra): Transacao {
  return {
    chave: `c-${c.id}`,
    tipo: 'compra-cartao',
    status: 'na-fatura',
    data: c.dataCompra,
    ordem: c.createdAt,
    titulo: c.descricao,
    descricao: `Cartão ${cartao.nome}${cartao.final ? ` •••• ${cartao.final}` : ''}`,
    complemento:
      c.parcelas > 1
        ? `${c.parcelas}x · 1ª fatura em ${formatarMes(c.primeiraFaturaMes)}`
        : `Fatura de ${formatarMes(c.primeiraFaturaMes)}`,
    fornecedor: null,
    categoria: c.categoria.id ? c.categoria : null,
    empresa: cartao.empresa,
    conta: null,
    contaDestino: null,
    valorCentavos: c.valorTotalCentavos,
    sinal: 0,
    efetivo: false,
    href: `/cartoes/compras/${c.id}/editar`,
    links: [{ rotulo: 'Ver cartão', href: `/cartoes/${cartao.id}` }],
  };
}

// ------------------------------------------------------ ordenação e mescla --

/** Mais recente primeiro; no mesmo dia, o registro mais novo primeiro. */
export function compararTransacoes(a: Transacao, b: Transacao): number {
  return b.data.localeCompare(a.data) || b.ordem.localeCompare(a.ordem) || a.chave.localeCompare(b.chave);
}

export interface FonteTransacoes {
  itens: Transacao[];
  /** A fonte tinha mais itens que o limite buscado (vieram os mais recentes). */
  truncado: boolean;
}

/**
 * Junta as fontes em ordem cronológica. Cada fonte vem ordenada da data mais
 * recente para a mais antiga e limitada; se uma fonte foi cortada, ela só está
 * completa ATÉ a data do seu último item — itens de outras fontes mais antigos
 * que isso ficariam fora de ordem (faltariam os dessa fonte). Por isso a lista
 * é cortada nessa data, e `truncado` avisa para refinar os filtros.
 */
export function mesclarFontes(fontes: readonly FonteTransacoes[]): FonteTransacoes {
  let corte: DataISO | undefined;
  for (const f of fontes) {
    if (!f.truncado || f.itens.length === 0) continue;
    const ultima = f.itens.reduce((min, t) => (t.data < min ? t.data : min), f.itens[0].data);
    if (!corte || ultima > corte) corte = ultima;
  }
  const todas = fontes.flatMap((f) => f.itens).sort(compararTransacoes);
  const truncado = fontes.some((f) => f.truncado);
  if (!corte) return { itens: todas, truncado };
  // O dia do corte pode estar incompleto na fonte cortada: fica de fora.
  const seguras = todas.filter((t) => t.data > corte);
  return { itens: seguras.length > 0 ? seguras : todas, truncado };
}

// ------------------------------------------------------------------ totais --

export interface ResumoTransacoes {
  /** Entradas confirmadas (dinheiro que entrou). */
  entradasCentavos: Centavos;
  /** Pagamentos realizados (dinheiro que saiu). */
  pagamentosCentavos: Centavos;
  /** Contas a pagar em aberto (obrigações; inclui atrasadas). */
  aPagarCentavos: Centavos;
  atrasadas: number;
  /** Entradas previstas (ainda não entraram). */
  aReceberCentavos: Centavos;
  quantidade: number;
}

/**
 * Totais da lista. Transferências (só mudam de conta), ajustes (correção de
 * saldo) e compras no cartão (saem pela fatura) NÃO entram nos totais.
 */
export function resumirTransacoes(itens: readonly Transacao[]): ResumoTransacoes {
  const soma = (filtro: (t: Transacao) => boolean) => somarCentavos(itens.filter(filtro).map((t) => t.valorCentavos));
  return {
    entradasCentavos: soma((t) => t.tipo === 'entrada' && t.efetivo),
    pagamentosCentavos: soma((t) => t.tipo === 'pagamento'),
    aPagarCentavos: soma((t) => t.tipo === 'conta-a-pagar'),
    atrasadas: itens.filter((t) => t.status === 'atrasado').length,
    aReceberCentavos: soma((t) => t.tipo === 'entrada' && !t.efetivo),
    quantidade: itens.length,
  };
}

// ------------------------------------------------------------- apresentação --

export type TomValor = 'entrada' | 'saida' | 'neutro';

/**
 * Cor de reforço do valor: verde/vermelho SOMENTE para dinheiro que realmente
 * entrou/saiu. Obrigações, previsões, transferências, ajustes e compras ficam
 * neutros (o sinal, o ícone e o rótulo dizem o resto).
 */
export function tomDoValor(t: Pick<Transacao, 'tipo' | 'efetivo'>): TomValor {
  if (t.tipo === 'entrada' && t.efetivo) return 'entrada';
  if (t.tipo === 'pagamento') return 'saida';
  return 'neutro';
}

/** "+ R$ 1.000,00", "− R$ 1.000,00" ou "R$ 1.000,00" (sem direção). */
export function textoDoValor(t: Pick<Transacao, 'valorCentavos' | 'sinal'>): string {
  return t.sinal === 0 ? formatarMoeda(t.valorCentavos) : formatarMoedaComSinal(t.sinal * t.valorCentavos);
}

/** Texto acessível do valor (leitor de tela não lê "+" e "−" de forma confiável). */
export function valorPorExtenso(t: Pick<Transacao, 'valorCentavos' | 'sinal' | 'efetivo' | 'tipo'>): string {
  const valor = formatarMoeda(t.valorCentavos);
  if (t.tipo === 'conta-a-pagar') return `${valor} a pagar`;
  if (t.tipo === 'entrada' && !t.efetivo) return `${valor} a receber`;
  if (t.sinal > 0) return `${valor} de entrada`;
  if (t.sinal < 0) return `${valor} de saída`;
  return valor;
}

/** Agrupa por dia, mantendo a ordem da lista. */
export function agruparPorData(itens: readonly Transacao[]): { data: DataISO; itens: Transacao[] }[] {
  const grupos: { data: DataISO; itens: Transacao[] }[] = [];
  for (const t of itens) {
    const ultimo = grupos.at(-1);
    if (ultimo && ultimo.data === t.data) ultimo.itens.push(t);
    else grupos.push({ data: t.data, itens: [t] });
  }
  return grupos;
}

// ---------------------------------------------------------------- paginação --

/** Itens desenhados por vez ("Mostrar mais" soma outra página). */
export const ITENS_POR_PAGINA = 50;
export const PAGINAS_MAX = 10;

export function lerPagina(p: ParametrosUrl): number {
  const n = Number.parseInt(texto(p.pagina), 10);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, PAGINAS_MAX) : 1;
}
