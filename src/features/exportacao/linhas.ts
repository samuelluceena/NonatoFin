/**
 * Converte boletos em linhas de exportação (formato brasileiro).
 */
import { formatarCnpj } from '@/lib/domain/cnpj';
import { dataNoFuso, formatarData, formatarDataHora, type DataISO } from '@/lib/domain/datas';
import { ROTULOS_STATUS, calcularStatus } from '@/lib/domain/status';
import type { Lancamento } from '@/lib/domain/tipos';

export interface LinhaExportacao {
  empresa: string;
  cnpj: string;
  categoria: string;
  conta: string;
  fornecedor: string;
  descricao: string;
  valorCentavos: number;
  vencimento: DataISO;
  codigo: string;
  status: string;
  parcela: number | null;
  totalParcelas: number | null;
  observacao: string;
  /** Data do pagamento (AAAA-MM-DD, fuso do app) ou null. */
  dataPagamento: DataISO | null;
  /** Data e hora do pagamento formatadas, ou vazio. */
  pagamentoTexto: string;
}

export const CABECALHO_EXPORTACAO = [
  'Empresa',
  'CNPJ',
  'Categoria',
  'Conta',
  'Fornecedor',
  'Nome/Descrição',
  'Valor',
  'Vencimento',
  'Código',
  'Status',
  'Parcela',
  'Total de parcelas',
  'Observação',
  'Pagamento',
] as const;

export function montarLinhasExportacao(lancamentos: readonly Lancamento[], hoje: DataISO): LinhaExportacao[] {
  return lancamentos.map((b) => ({
    empresa: b.empresa.apelido,
    cnpj: b.empresa.cnpj ? formatarCnpj(b.empresa.cnpj) : '',
    categoria: b.categoria.nome,
    conta: b.conta ? b.conta.apelido : '',
    fornecedor: b.fornecedor.nome,
    descricao: b.descricao,
    valorCentavos: b.valorCentavos,
    vencimento: b.vencimento,
    codigo: b.codigoBarras ?? '',
    status: ROTULOS_STATUS[calcularStatus(b, hoje)],
    parcela: b.recorrencia?.parcela ?? null,
    totalParcelas: b.recorrencia?.totalParcelas ?? null,
    observacao: b.observacao ?? '',
    dataPagamento: b.pagoEm ? dataNoFuso(b.pagoEm) : null,
    pagamentoTexto: b.pagoEm ? formatarDataHora(b.pagoEm) : '',
  }));
}

export function nomeArquivoExportacao(hoje: DataISO, extensao: 'csv' | 'xlsx', filtrado = false): string {
  return `nonatofin-boletos${filtrado ? '-filtrados' : ''}-${formatarData(hoje).split('/').reverse().join('-')}.${extensao}`;
}
