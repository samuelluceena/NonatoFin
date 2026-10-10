/**
 * Formato do backup e textos das tabelas (funções puras, usadas na tela,
 * na rota de download e nos testes).
 */
import type { NivelLimpeza } from './esquemas';

export const TABELAS_DADOS = [
  'empresas',
  'categorias',
  'fornecedores',
  'contas_bancarias',
  'cartoes',
  'lancamentos',
  'compras_cartao',
  'parcelas_cartao',
  'movimentos_conta',
] as const;

export type TabelaDados = (typeof TABELAS_DADOS)[number];
export type Contagens = Record<TabelaDados, number>;

export const TABELAS_FINANCEIRAS: readonly TabelaDados[] = ['lancamentos', 'compras_cartao', 'parcelas_cartao', 'movimentos_conta'];
export const TABELAS_CADASTRO: readonly TabelaDados[] = ['empresas', 'contas_bancarias', 'cartoes', 'fornecedores', 'categorias'];

/** Rótulos (singular, plural) e o que cada tabela inclui. */
export const ROTULOS: Record<TabelaDados, { um: string; varios: string; inclui?: string }> = {
  lancamentos: { um: 'lançamento', varios: 'lançamentos', inclui: 'boletos, séries, faturas e pagamentos' },
  compras_cartao: { um: 'compra no cartão', varios: 'compras no cartão' },
  parcelas_cartao: { um: 'parcela de cartão', varios: 'parcelas de cartão' },
  movimentos_conta: { um: 'movimentação', varios: 'movimentações', inclui: 'entradas, transferências e conferências de saldo' },
  empresas: { um: 'empresa', varios: 'empresas' },
  contas_bancarias: { um: 'conta bancária', varios: 'contas bancárias' },
  cartoes: { um: 'cartão', varios: 'cartões' },
  fornecedores: { um: 'fornecedor', varios: 'fornecedores' },
  categorias: { um: 'categoria', varios: 'categorias' },
};

export function tabelasDoNivel(nivel: NivelLimpeza): readonly TabelaDados[] {
  return nivel === 'completo' ? [...TABELAS_FINANCEIRAS, ...TABELAS_CADASTRO] : TABELAS_FINANCEIRAS;
}

const numero = new Intl.NumberFormat('pt-BR');

/** "3 lançamentos" / "1 compra no cartão". */
export function rotuloQuantidade(tabela: TabelaDados, quantidade: number): string {
  const r = ROTULOS[tabela];
  return `${numero.format(quantidade)} ${quantidade === 1 ? r.um : r.varios}`;
}

/** Normaliza o JSON de contagens vindo do banco (tabelas ausentes = 0). */
export function lerContagens(valor: unknown): Contagens {
  const origem = (valor && typeof valor === 'object' ? valor : {}) as Record<string, unknown>;
  const r = {} as Contagens;
  for (const t of TABELAS_DADOS) {
    const n = Number(origem[t] ?? 0);
    r[t] = Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
  }
  return r;
}

export function totalDe(contagens: Contagens, tabelas: readonly TabelaDados[]): number {
  return tabelas.reduce((soma, t) => soma + contagens[t], 0);
}

/** "312 lançamentos · 48 movimentações" (só as tabelas com registros). */
export function resumirContagens(contagens: Contagens, tabelas: readonly TabelaDados[]): string {
  const partes = tabelas.filter((t) => contagens[t] > 0).map((t) => rotuloQuantidade(t, contagens[t]));
  return partes.length > 0 ? partes.join(' · ') : 'Nenhum registro';
}

export type MotivoBackup = 'limpeza' | 'antes_da_restauracao';

export function rotuloBackup(nivel: NivelLimpeza, motivo: MotivoBackup): string {
  if (motivo === 'antes_da_restauracao') return 'Antes de uma restauração';
  return nivel === 'completo' ? 'Antes de reiniciar do zero' : 'Antes de limpar dados financeiros';
}

export interface ResumoBackup {
  id: string;
  nivel: NivelLimpeza;
  motivo: MotivoBackup;
  criadoEm: string;
  expiraEm: string;
  restauradoEm: string | null;
  contagens: Contagens;
}

export interface ArquivoBackup {
  formato: 'nonatofin-backup';
  versao_formato: number;
  origem: 'exportacao' | 'backup-automatico';
  gerado_em: string;
  backup?: { id: string; nivel: NivelLimpeza; motivo: MotivoBackup; criado_em: string; expira_em: string };
  assinatura_esquema: string;
  contagens: Contagens;
  /** SHA-256 do `conteudo` serializado pelo Postgres (jsonb::text). */
  sha256: string;
  conteudo: Record<TabelaDados, unknown[]>;
}

export function nomeArquivoBackup(dataISO: string, sufixo?: string): string {
  return `nonatofin-backup-${dataISO}${sufixo ? `-${sufixo}` : ''}.json`;
}
