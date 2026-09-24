/**
 * Relacionamentos trazidos junto nas consultas do Supabase.
 * (Sem 'server-only': também usado por mapeadores no navegador.)
 */

/**
 * Registro relacionado trazido junto na consulta (ex.: `fornecedor:fornecedores(...)`).
 * Dependendo da relação, o PostgREST devolve um objeto, uma lista ou null.
 */
export type Embutido<T> = T | T[] | null;

/** Primeiro registro de um relacionamento embutido (ou null). */
export function primeiroEmbutido<T>(valor: Embutido<T>): T | null {
  return Array.isArray(valor) ? (valor[0] ?? null) : valor;
}
