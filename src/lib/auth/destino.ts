/** Valida o parâmetro "voltar" para evitar open redirect. */
export function destinoSeguro(voltar: unknown): string {
  if (typeof voltar !== 'string') return '/';
  if (!voltar.startsWith('/') || voltar.startsWith('//') || voltar.startsWith('/\\')) return '/';
  if (voltar.startsWith('/login')) return '/';
  return voltar;
}
