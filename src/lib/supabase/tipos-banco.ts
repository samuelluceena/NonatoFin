/**
 * Tipos do banco usados pelo app.
 *
 * `database.types.ts` é GERADO a partir do banco (`npm run db:tipos`) e não
 * deve ser editado. O gerador não sabe quais parâmetros de funções SQL
 * aceitam `null` (o Postgres não guarda essa informação), então esse ajuste
 * fica aqui — é o padrão recomendado pelo Supabase para "complementar" os
 * tipos gerados. Ao criar uma função SQL com parâmetro opcional, inclua-o
 * em PARAMETROS_NULOS abaixo.
 */
import type { Database as BancoGerado } from './database.types';

type Publico = BancoGerado['public'];
type FuncoesGeradas = Publico['Functions'];

/** Parâmetros que podem receber `null` (texto opcional, código opcional…). */
interface ParametrosNulos {
  atualizar_lancamento: 'p_codigo_barras' | 'p_observacao' | 'p_conta_id';
  transferir_entre_contas: 'p_descricao';
  registrar_compra_cartao: 'p_observacao';
  atualizar_compra_cartao: 'p_observacao';
  definir_ajuste_fatura: 'p_observacao';
}

type AceitaNulo<F extends { Args: object }, P extends keyof F['Args']> = Omit<F, 'Args'> & {
  Args: Omit<F['Args'], P> & { [K in P]: F['Args'][K] | null };
};

type Funcoes = Omit<FuncoesGeradas, keyof ParametrosNulos> & {
  [N in keyof ParametrosNulos]: AceitaNulo<FuncoesGeradas[N], ParametrosNulos[N] & keyof FuncoesGeradas[N]['Args']>;
};

/** Tipo do banco para os clientes Supabase (gerado + ajustes acima). */
export type Database = Omit<BancoGerado, 'public'> & {
  public: Omit<Publico, 'Functions'> & { Functions: Funcoes };
};

type Tabelas = Publico['Tables'];

export type LinhaLancamento = Tabelas['lancamentos']['Row'];
export type InsercaoLancamento = Tabelas['lancamentos']['Insert'];
