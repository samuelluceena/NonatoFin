import 'server-only';
/**
 * Utilitários compartilhados pelas consultas (leitura) de todas as
 * funcionalidades.
 */
import { LIMITES } from '@/lib/config';
import { mensagemDeErro } from '@/lib/acoes/erros';

/** Erro de leitura já traduzido para o usuário (exibido por app/(app)/error.tsx). */
export class ErroConsulta extends Error {
  override name = 'ErroConsulta';
}

/** Registra o erro técnico no log e lança um ErroConsulta com mensagem amigável. */
export function falharConsulta(erro: unknown, contexto: string): never {
  throw new ErroConsulta(mensagemDeErro(erro, contexto));
}

/** Busca todas as páginas (o PostgREST limita cada resposta a 1000 linhas). */
export async function buscarTodasAsPaginas<T>(
  buscarPagina: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  contexto: string,
): Promise<T[]> {
  const tamanho = LIMITES.tamanhoPaginaConsulta;
  const todos: T[] = [];
  for (let de = 0; ; de += tamanho) {
    const { data, error } = await buscarPagina(de, de + tamanho - 1);
    if (error) falharConsulta(error, contexto);
    const pagina = data ?? [];
    todos.push(...pagina);
    if (pagina.length < tamanho) return todos;
  }
}
