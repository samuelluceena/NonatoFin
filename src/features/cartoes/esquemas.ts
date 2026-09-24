/**
 * Validação (Zod) de cartões, compras parceladas e ajuste de fatura.
 * Mesmo esquema no navegador e no servidor.
 */
import { z } from 'zod';
import { LIMITES } from '@/lib/config';
import { ehChaveMesValida, ehDataISOValida } from '@/lib/domain/datas';
import { campoSelecao, ehUuid } from '@/lib/validacao';


const dia = (rotulo: string) =>
  z
    .number({ message: `Informe o dia de ${rotulo}.` })
    .int(`Dia de ${rotulo} inválido.`)
    .min(1, 'Use um dia entre 1 e 31.')
    .max(31, 'Use um dia entre 1 e 31.');

export const esquemaCartao = z
  .object({
    empresaId: campoSelecao('Selecione a empresa.'),
    nome: z
      .string()
      .trim()
      .min(1, 'Informe o nome do cartão.')
      .max(LIMITES.nomeCartaoMax, `Máximo de ${LIMITES.nomeCartaoMax} caracteres.`),
    final: z
      .string()
      .trim()
      .refine((v) => v === '' || /^\d{4}$/.test(v), 'Informe os 4 últimos dígitos (ou deixe em branco).'),
    emissorNome: z
      .string()
      .trim()
      .min(1, 'Informe o banco/emissor.')
      .max(LIMITES.fornecedorNomeMax, `Máximo de ${LIMITES.fornecedorNomeMax} caracteres.`),
    diaFechamento: dia('fechamento'),
    diaVencimento: dia('vencimento'),
    categoriaFaturaId: campoSelecao('Selecione a categoria.'),
    /** Conta de onde a fatura é debitada ('' = sem conta). */
    contaId: z.string().refine((v) => v === '' || ehUuid(v), 'Conta inválida.'),
    ativo: z.boolean(),
  })
  .superRefine((d, ctx) => {
    if (d.diaFechamento === d.diaVencimento) {
      ctx.addIssue({ code: 'custom', path: ['diaVencimento'], message: 'O vencimento deve ser em um dia diferente do fechamento.' });
    }
  });

export type ValoresCartao = z.infer<typeof esquemaCartao>;

export const esquemaCompra = z
  .object({
    cartaoId: campoSelecao('Selecione o cartão.'),
    categoriaId: campoSelecao('Selecione a categoria.'),
    descricao: z
      .string()
      .trim()
      .min(1, 'Informe o que foi comprado.')
      .max(LIMITES.descricaoMax, `Máximo de ${LIMITES.descricaoMax} caracteres.`),
    dataCompra: z
      .string()
      .refine((v) => v !== '', 'Informe a data da compra.')
      .refine((v) => v === '' || (ehDataISOValida(v) && v >= '2000-01-01' && v <= '2100-12-31'), 'Data inválida.'),
    valorTotalCentavos: z
      .number({ message: 'Informe o valor.' })
      .int('Valor inválido.')
      .positive('Informe um valor maior que zero.')
      .max(LIMITES.valorMaxCentavos, 'Valor acima do permitido.'),
    parcelas: z
      .number({ message: 'Informe as parcelas.' })
      .int('Use um número inteiro.')
      .min(1, `Informe de 1 a ${LIMITES.parcelasCartaoMax} parcelas.`)
      .max(LIMITES.parcelasCartaoMax, `Informe de 1 a ${LIMITES.parcelasCartaoMax} parcelas.`),
    primeiraFaturaMes: z.string().refine((v) => ehChaveMesValida(v), 'Escolha a fatura.'),
    observacao: z.string().max(LIMITES.observacaoMax, `Máximo de ${LIMITES.observacaoMax} caracteres.`),
  })
  .superRefine((d, ctx) => {
    if (d.valorTotalCentavos > 0 && d.parcelas > 0 && d.valorTotalCentavos < d.parcelas) {
      ctx.addIssue({ code: 'custom', path: ['parcelas'], message: 'Cada parcela precisa ter pelo menos R$ 0,01.' });
    }
  });

export type ValoresCompra = z.infer<typeof esquemaCompra>;

export const esquemaAjuste = z.object({
  ajusteCentavos: z
    .number({ message: 'Informe o ajuste.' })
    .int('Valor inválido.')
    .min(-LIMITES.valorMaxCentavos, 'Valor fora do permitido.')
    .max(LIMITES.valorMaxCentavos, 'Valor fora do permitido.'),
  observacao: z.string().max(LIMITES.observacaoMax, `Máximo de ${LIMITES.observacaoMax} caracteres.`),
});

export type ValoresAjuste = z.infer<typeof esquemaAjuste>;
