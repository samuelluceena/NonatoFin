/**
 * Tipos de domínio do NonatoFin (independentes do banco e da UI).
 */
import type { Centavos } from './dinheiro';
import type { ChaveMes, DataISO } from './datas';

/** Status gravado no banco. */
export type StatusArmazenado = 'pendente' | 'pago';

/** Status exibido: "atrasado" é derivado (pendente + vencido). */
export type StatusLancamento = 'pendente' | 'pago' | 'atrasado';

/** Tipo de lançamento no cadastro. */
export type TipoLancamento = 'unico' | 'serie';

/** Frequência de recorrência (inicialmente apenas mensal). */
export type Frequencia = 'mensal';

/** Escopo de edição/exclusão em série. */
export type EscopoSerie = 'este' | 'proximos' | 'todos';

export interface Usuario {
  id: string;
  email: string;
}

export interface Fornecedor {
  id: string;
  nome: string;
}

export interface Empresa {
  id: string;
  apelido: string;
  razaoSocial: string | null;
  /** Somente [A-Z0-9], 14 caracteres. */
  cnpj: string | null;
}

export interface Categoria {
  id: string;
  nome: string;
  ordem: number;
}

/** Registros que usam uma categoria (categoria em uso não pode ser excluída). */
export interface UsoCategoria {
  lancamentos: number;
  compras: number;
  cartoes: number;
}

/** Conta bancária de uma empresa (de onde saem os pagamentos). */
export interface ContaBancaria {
  id: string;
  empresa: Pick<Empresa, 'id' | 'apelido'>;
  apelido: string;
  banco: string;
  /** Últimos 4 dígitos (opcional). */
  final: string | null;
  /** Conta sugerida nos novos lançamentos da empresa. */
  padrao: boolean;
  ativa: boolean;
}

/** Referência curta à conta de débito de um lançamento. */
export type ContaResumida = Pick<ContaBancaria, 'id' | 'apelido' | 'final'>;

/** Tipos de movimento de conta (pagamentos vêm dos lançamentos). */
export type TipoMovimento = 'entrada' | 'transferencia' | 'conferencia';

export interface MovimentoConta {
  id: string;
  contaId: string;
  tipo: TipoMovimento;
  data: DataISO;
  /** Com sinal: + entrou, − saiu. Na conferência, é o ajuste. */
  valorCentavos: Centavos;
  /** Conferência: saldo que o banco mostrava. */
  saldoInformado: Centavos | null;
  descricao: string | null;
  /** Entrada prevista (data futura) = false. */
  confirmado: boolean;
  transferenciaId: string | null;
  createdAt: string;
}

/** Dados de fatura quando o lançamento é a fatura de um cartão. */
export interface InfoFatura {
  cartaoId: string;
  /** Competência "AAAA-MM". */
  mes: ChaveMes;
  ajusteCentavos: Centavos;
}

export interface Cartao {
  id: string;
  empresa: Pick<Empresa, 'id' | 'apelido'>;
  emissor: Fornecedor;
  categoriaFaturaId: string;
  /** Conta de onde a fatura é debitada (opcional). */
  contaId: string | null;
  nome: string;
  final: string | null;
  diaFechamento: number;
  diaVencimento: number;
  ativo: boolean;
}

export interface CompraCartao {
  id: string;
  cartaoId: string;
  categoria: Pick<Categoria, 'id' | 'nome'>;
  descricao: string;
  dataCompra: DataISO;
  valorTotalCentavos: Centavos;
  parcelas: number;
  primeiraFaturaMes: ChaveMes;
  observacao: string | null;
}

export interface ParcelaCartao {
  id: string;
  compraId: string;
  cartaoId: string;
  numero: number;
  total: number;
  valorCentavos: Centavos;
  faturaMes: ChaveMes;
  compraDescricao: string;
}

export interface Recorrencia {
  serieId: string;
  parcela: number;
  totalParcelas: number;
}

export interface Lancamento {
  id: string;
  empresa: Pick<Empresa, 'id' | 'apelido' | 'cnpj'>;
  categoria: Pick<Categoria, 'id' | 'nome'>;
  /** Conta de débito: prevista (pendente) ou a que pagou (pago). */
  conta: ContaResumida | null;
  fornecedor: Fornecedor;
  descricao: string;
  valorCentavos: Centavos;
  vencimento: DataISO;
  codigoBarras: string | null;
  observacao: string | null;
  status: StatusArmazenado;
  /** Instante do pagamento (ISO timestamp) ou null. */
  pagoEm: string | null;
  recorrencia: Recorrencia | null;
  /** Presente quando o lançamento é a fatura de um cartão. */
  fatura: InfoFatura | null;
  createdAt: string;
  updatedAt: string;
}

/** Versão enxuta usada nos cálculos de dashboard/relatórios. */
export interface LancamentoResumo {
  id: string;
  fornecedorId: string;
  empresaId: string;
  categoriaId: string;
  contaId: string | null;
  valorCentavos: Centavos;
  vencimento: DataISO;
  status: StatusArmazenado;
  /** Data do pagamento no fuso do app (AAAA-MM-DD) ou null. */
  dataPagamento: DataISO | null;
}

export interface Totalizador {
  quantidade: number;
  totalCentavos: Centavos;
}

export interface IndicadoresDashboard {
  hoje: Totalizador;
  amanha: Totalizador;
  semana: Totalizador;
  mes: Totalizador;
  proximoMes: Totalizador;
  atrasados: Totalizador;
  futuro: Totalizador;
  pagoNoMes: Totalizador;
  /** Quantidade de boletos pendentes (a vencer, sem os atrasados). */
  pendentes: number;
  /** Quantidade de boletos atrasados. */
  atrasadosQuantidade: number;
}

export interface ResumoStatus {
  quantidadeTotal: number;
  quantidadePendente: number;
  quantidadePaga: number;
  quantidadeAtrasada: number;
  totalCentavos: Centavos;
  pendenteCentavos: Centavos;
  pagoCentavos: Centavos;
  atrasadoCentavos: Centavos;
}

export interface ResumoFornecedor extends ResumoStatus {
  fornecedor: Fornecedor;
  /** Próximo vencimento em aberto (pendente, a partir de hoje). */
  proximoVencimento: DataISO | null;
}

export interface ResumoMes extends ResumoStatus {
  mes: ChaveMes;
}

/** Resumo por um agrupamento qualquer (empresa, categoria...). */
export interface ResumoGrupo extends ResumoStatus {
  id: string;
  nome: string;
}

/** Métrica usada na visão comparativa de fornecedores. */
export type MetricaFornecedor = 'total' | 'pendente' | 'pago' | 'atrasado';
