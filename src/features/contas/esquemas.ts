/**
 * Validação (Zod) de contas bancárias e movimentos (entrada, transferência,
 * conferência). Mesmo esquema no navegador e no servidor.
 */
import { z } from 'zod';
import { LIMITES } from '@/lib/config';
import { ehDataISOValida } from '@/lib/domain/datas';
import { campoSelecao } from '@/lib/validacao';

const valorPositivo = z
  .number({ message: 'Informe o valor.' })
  .int('Valor inválido.')
  .positive('Informe um valor maior que zero.')
  .max(LIMITES.valorMaxCentavos, 'Valor acima do permitido.');

/** Saldo pode ser negativo (conta no cheque especial). */
const valorSaldo = z
  .number({ message: 'Informe o saldo.' })
  .int('Valor inválido.')
  .min(-LIMITES.valorMaxCentavos, 'Valor fora do permitido.')
  .max(LIMITES.valorMaxCentavos, 'Valor fora do permitido.');

const campoData = z
  .string()
  .refine((v) => v !== '', 'Informe a data.')
  .refine((v) => v === '' || (ehDataISOValida(v) && v >= '2000-01-01' && v <= '2100-12-31'), 'Data inválida.');

const campoDescricao = z.string().trim().max(LIMITES.descricaoMax, `Máximo de ${LIMITES.descricaoMax} caracteres.`);

export const esquemaConta = z.object({
  empresaId: campoSelecao('Selecione a empresa.'),
  apelido: z
    .string()
    .trim()
    .min(1, 'Informe um apelido (ex.: Itaú PJ).')
    .max(LIMITES.apelidoContaMax, `Máximo de ${LIMITES.apelidoContaMax} caracteres.`),
  banco: z
    .string()
    .trim()
    .min(1, 'Informe o banco.')
    .max(LIMITES.bancoContaMax, `Máximo de ${LIMITES.bancoContaMax} caracteres.`),
  final: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\d{4}$/.test(v), 'Informe os 4 últimos dígitos (ou deixe em branco).'),
  padrao: z.boolean(),
  ativa: z.boolean(),
});
export type ValoresConta = z.infer<typeof esquemaConta>;

/** Cadastro: além dos dados, o saldo de hoje (vira a primeira conferência). */
export const esquemaNovaConta = esquemaConta.extend({ saldoInicialCentavos: valorSaldo });
export type ValoresNovaConta = z.infer<typeof esquemaNovaConta>;

export const esquemaEntrada = z.object({
  contaId: campoSelecao('Selecione a conta.'),
  data: campoData,
  valorCentavos: valorPositivo,
  descricao: campoDescricao.min(1, 'Descreva a entrada (ex.: Vendas do dia).'),
});
export type ValoresEntrada = z.infer<typeof esquemaEntrada>;

export const esquemaTransferencia = z
  .object({
    origemId: campoSelecao('Selecione a conta de origem.'),
    destinoId: campoSelecao('Selecione a conta de destino.'),
    data: campoData,
    valorCentavos: valorPositivo,
    descricao: campoDescricao,
  })
  .superRefine((d, ctx) => {
    if (d.origemId && d.origemId === d.destinoId) {
      ctx.addIssue({ code: 'custom', path: ['destinoId'], message: 'Escolha uma conta diferente da origem.' });
    }
  });
export type ValoresTransferencia = z.infer<typeof esquemaTransferencia>;

export const esquemaConferencia = z.object({
  contaId: campoSelecao('Selecione a conta.'),
  saldoCentavos: valorSaldo,
});
export type ValoresConferencia = z.infer<typeof esquemaConferencia>;
