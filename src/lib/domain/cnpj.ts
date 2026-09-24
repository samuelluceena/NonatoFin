/**
 * CNPJ numérico e alfanumérico (a Receita Federal emite CNPJ com letras desde
 * 31/07/2026; os existentes não mudam).
 *
 * Formato: 12 caracteres [A-Z0-9] + 2 dígitos verificadores [0-9].
 * Cálculo (módulo 11): valor de cada caractere = código ASCII − 48
 * (0–9 → 0–9; A–Z → 17–42); pesos 5..2,9..2 (1º DV) e 6..2,9..2 (2º DV);
 * resto < 2 → DV 0, senão 11 − resto.
 * Exemplo oficial: 12.ABC.345/01DE-35.
 */

const PESOS_DV1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_DV2 = [6, ...PESOS_DV1];

/** Remove pontuação e espaços; letras em maiúsculas. */
export function normalizarCnpj(texto: string | null | undefined): string {
  return (texto ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function digitoVerificador(base: string, pesos: number[]): number {
  let soma = 0;
  for (let i = 0; i < pesos.length; i++) soma += (base.charCodeAt(i) - 48) * pesos[i];
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function calcularDigitosCnpj(base12: string): string {
  const dv1 = digitoVerificador(base12, PESOS_DV1);
  const dv2 = digitoVerificador(base12 + dv1, PESOS_DV2);
  return `${dv1}${dv2}`;
}

export function ehCnpjValido(texto: string): boolean {
  const cnpj = normalizarCnpj(texto);
  if (!/^[A-Z0-9]{12}[0-9]{2}$/.test(cnpj)) return false;
  if (/^(.)\1{13}$/.test(cnpj)) return false; // 00000000000000, 11111111111111...
  return calcularDigitosCnpj(cnpj.slice(0, 12)) === cnpj.slice(12);
}

/** "12ABC34501DE35" -> "12.ABC.345/01DE-35" */
export function formatarCnpj(texto: string): string {
  const c = normalizarCnpj(texto);
  if (c.length !== 14) return texto;
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
}
