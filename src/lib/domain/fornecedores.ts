/**
 * Regras de nomes de fornecedores.
 * A unicidade real é garantida no banco (coluna gerada nome_normalizado +
 * constraint unique). Estas funções espelham a mesma regra para a interface.
 */
const DE = 'ÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑÝáàâãäåéèêëíìîïóòôõöúùûüçñýÿ';
const PARA = 'AAAAAAEEEEIIIIOOOOOUUUUCNYaaaaaaeeeeiiiiooooouuuucnyy';

/** Remove espaços extras mantendo a grafia escolhida pelo usuário. */
export function limparNome(nome: string): string {
  return nome.trim().replace(/\s+/g, ' ');
}

/** "  VIA  da Móda " -> "via da moda" (mesma regra de public.normalizar_nome). */
export function normalizarNome(nome: string): string {
  let semAcento = '';
  for (const c of nome) {
    const i = DE.indexOf(c);
    semAcento += i >= 0 ? PARA[i] : c;
  }
  return limparNome(semAcento).toLowerCase();
}

export function mesmoFornecedor(a: string, b: string): boolean {
  return normalizarNome(a) === normalizarNome(b);
}
