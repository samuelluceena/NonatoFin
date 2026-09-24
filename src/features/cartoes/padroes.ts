import { normalizarNome } from '@/lib/domain/fornecedores';
import type { Categoria } from '@/lib/domain/tipos';

/** Id da categoria com o nome informado (sem acento/maiúsculas) ou da primeira. */
export function categoriaPadrao(categorias: Pick<Categoria, 'id' | 'nome'>[], nome: string): string {
  const alvo = normalizarNome(nome);
  return (categorias.find((c) => normalizarNome(c.nome) === alvo) ?? categorias[0])?.id ?? '';
}
