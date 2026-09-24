/**
 * Configurações globais do NonatoFin.
 * Constantes de identidade e regionalização ficam SOMENTE aqui.
 */
export const APP = {
  nome: 'NonatoFin',
  nomeProjeto: 'nonatofin',
  descricao: 'Controle pessoal de boletos, contas a pagar e planejamento financeiro.',
  versao: process.env.NEXT_PUBLIC_APP_VERSION ?? '1.2.0',
  /** Fuso usado para definir "hoje". Vencimento é data pura e não sofre fuso. */
  fusoHorario: 'America/Sao_Paulo',
  locale: 'pt-BR',
  moeda: 'BRL',
} as const;

/** Limites de negócio (espelham as constraints do banco). */
export const LIMITES = {
  fornecedorNomeMax: 120,
  descricaoMax: 200,
  observacaoMax: 1000,
  /** R$ 1.000.000.000,00 */
  valorMaxCentavos: 100_000_000_000,
  parcelasMin: 2,
  parcelasMax: 120,
  /** Parcelas de uma compra no cartão. */
  parcelasCartaoMax: 48,
  apelidoEmpresaMax: 40,
  razaoSocialMax: 150,
  nomeCategoriaMax: 40,
  nomeCartaoMax: 60,
  apelidoContaMax: 40,
  bancoContaMax: 60,
  /** Horizonte da previsão de saldo, em dias a partir de hoje. */
  diasPrevisaoSaldo: 60,
  /** Registros por página nas consultas ao Supabase (limite padrão do PostgREST é 1000). */
  tamanhoPaginaConsulta: 1000,
  /** Máximo exibido em listas antes de pedir para refinar o filtro. */
  itensListaMax: 500,
  /** Janela de "próximos vencimentos" na tela inicial, em dias. */
  diasProximosVencimentos: 15,
} as const;

/**
 * Feriados da SUA cidade/estado (os nacionais já são calculados em
 * lib/domain/dias-uteis.ts). Usados no "Fechar o dia" para achar o próximo
 * dia útil. Formato: 'MM-DD' (repete todo ano) ou 'AAAA-MM-DD' (só naquele ano).
 * Ex.: ['03-19', '2026-12-31']
 */
export const FERIADOS_LOCAIS: readonly string[] = [];
