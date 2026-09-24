/**
 * Regras de status do boleto.
 *
 *  - Pago:      status gravado = 'pago'
 *  - Atrasado:  status gravado = 'pendente' E vencimento < hoje
 *  - Pendente:  status gravado = 'pendente' E vencimento >= hoje
 *
 * Um boleto que vence HOJE ainda não está atrasado.
 */
import type { DataISO } from './datas';
import type { StatusArmazenado, StatusLancamento } from './tipos';

export const ROTULOS_STATUS: Record<StatusLancamento, string> = {
  pendente: 'Pendente',
  pago: 'Pago',
  atrasado: 'Atrasado',
};

export function calcularStatus(
  lancamento: { status: StatusArmazenado; vencimento: DataISO },
  hoje: DataISO,
): StatusLancamento {
  if (lancamento.status === 'pago') return 'pago';
  return lancamento.vencimento < hoje ? 'atrasado' : 'pendente';
}

export function estaEmAberto(lancamento: { status: StatusArmazenado }): boolean {
  return lancamento.status === 'pendente';
}

/**
 * Converte o status vindo do banco (texto) para o tipo do domínio.
 * O banco só aceita 'pendente' ou 'pago' (check constraint); qualquer outro
 * valor indica dado corrompido e interrompe a operação em vez de exibir errado.
 */
export function statusDoBanco(valor: string): StatusArmazenado {
  if (valor === 'pendente' || valor === 'pago') return valor;
  throw new Error(`Status desconhecido vindo do banco: ${valor}`);
}
