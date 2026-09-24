/**
 * Código de barras / linha digitável.
 *
 * Armazenamos SOMENTE os dígitos. Formatos aceitos (padrão FEBRABAN):
 *  - 44 dígitos: código de barras
 *  - 47 dígitos: linha digitável de boleto bancário
 *  - 48 dígitos: linha digitável de convênio (água, luz, tributos...)
 */
export const TAMANHOS_CODIGO_VALIDOS = [44, 47, 48] as const;

export function normalizarCodigo(texto: string | null | undefined): string {
  return (texto ?? '').replace(/\D/g, '');
}

export function ehCodigoValido(digitos: string): boolean {
  return /^\d+$/.test(digitos) && (TAMANHOS_CODIGO_VALIDOS as readonly number[]).includes(digitos.length);
}

/** Formata para leitura humana (a cópia é sempre só dígitos). */
export function formatarCodigo(digitos: string): string {
  if (digitos.length === 47) {
    return [
      `${digitos.slice(0, 5)}.${digitos.slice(5, 10)}`,
      `${digitos.slice(10, 15)}.${digitos.slice(15, 21)}`,
      `${digitos.slice(21, 26)}.${digitos.slice(26, 32)}`,
      digitos.slice(32, 33),
      digitos.slice(33),
    ].join(' ');
  }
  if (digitos.length === 48) {
    return [0, 12, 24, 36].map((i) => `${digitos.slice(i, i + 11)}-${digitos.slice(i + 11, i + 12)}`).join(' ');
  }
  return digitos.replace(/(\d{4})(?=\d)/g, '$1 ');
}
