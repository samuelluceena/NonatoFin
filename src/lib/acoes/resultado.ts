/**
 * Formato padrão de retorno das Server Actions.
 * Nunca retorna stack trace ou detalhes internos para o navegador.
 */
export type ResultadoAcao<T = undefined> =
  | { ok: true; dados: T; mensagem?: string }
  | { ok: false; erro: string; campos?: Record<string, string> };

export function sucesso<T>(dados: T, mensagem?: string): ResultadoAcao<T> {
  return { ok: true, dados, mensagem };
}

export function falha(erro: string, campos?: Record<string, string>): { ok: false; erro: string; campos?: Record<string, string> } {
  return { ok: false, erro, campos };
}
