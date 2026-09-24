/**
 * Validações e normalizações usadas por várias funcionalidades
 * (identificadores, campos de texto opcionais).
 */
import { z } from 'zod';

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** true se o valor é um identificador (uuid) bem formado. */
export function ehUuid(valor: unknown): valor is string {
  return typeof valor === 'string' && REGEX_UUID.test(valor);
}

/** Identificador recebido por uma Server Action. */
export const esquemaId = z.uuid('Identificador inválido.');

/**
 * Campo de seleção (select) obrigatório que começa vazio no formulário:
 * aceita '' enquanto o usuário não escolhe, mas só valida um id real.
 */
export const campoSelecao = (mensagem: string) => z.string().refine((v) => ehUuid(v), mensagem);

/** Texto opcional: vazio (ou só espaços) vira null para gravar no banco. */
export function textoOuNulo(texto: string): string | null {
  const t = texto.trim();
  return t === '' ? null : t;
}
