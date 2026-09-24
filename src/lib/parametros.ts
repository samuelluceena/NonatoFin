/**
 * Leitura segura de parâmetros de rota e de busca (URL) nas páginas.
 * Nunca confie no que vem da URL: tudo passa por aqui antes de ir ao banco.
 */
import { notFound } from 'next/navigation';
import { ehUuid } from './validacao';

type ValorBusca = string | string[] | undefined;

/** Id vindo da rota (/boletos/[id]); id inválido mostra a página 404. */
export function idDaRota(id: string): string {
  if (!ehUuid(id)) notFound();
  return id;
}

/** Texto de um parâmetro de busca (?q=...); listas e ausentes viram ''. */
export function textoDaBusca(valor: ValorBusca, tamanhoMaximo = 200): string {
  return typeof valor === 'string' ? valor.slice(0, tamanhoMaximo) : '';
}

/** Id de um parâmetro de busca (?fornecedor=...); inválido vira ''. */
export function idDaBusca(valor: ValorBusca): string {
  return ehUuid(valor) ? valor : '';
}
