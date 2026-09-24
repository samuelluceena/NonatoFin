/**
 * Validação (Zod) dos formulários de boleto.
 * O MESMO esquema é usado no navegador (React Hook Form) e no servidor
 * (Server Actions) — o servidor nunca confia no que vem do navegador.
 */
import { z } from 'zod';
import { LIMITES } from '@/lib/config';
import { ehCodigoValido, normalizarCodigo } from '@/lib/domain/codigo-barras';
import { ehDataISOValida } from '@/lib/domain/datas';
import { campoSelecao, ehUuid } from '@/lib/validacao';

export const ESCOPOS = ['este', 'proximos', 'todos'] as const;

const campoFornecedor = z
  .string({ message: 'Informe o fornecedor.' })
  .trim()
  .min(1, 'Informe o fornecedor.')
  .max(LIMITES.fornecedorNomeMax, `Máximo de ${LIMITES.fornecedorNomeMax} caracteres.`);

const campoDescricao = z
  .string({ message: 'Informe o nome/descrição.' })
  .trim()
  .min(1, 'Informe o nome/descrição.')
  .max(LIMITES.descricaoMax, `Máximo de ${LIMITES.descricaoMax} caracteres.`);

const campoVencimento = z
  .string({ message: 'Informe o vencimento.' })
  .refine((v) => v !== '', 'Informe o vencimento.')
  .refine((v) => v === '' || (ehDataISOValida(v) && v >= '2000-01-01' && v <= '2100-12-31'), 'Data inválida.');

const campoValor = z
  .number({ message: 'Informe o valor.' })
  .int('Valor inválido.')
  .positive('Informe um valor maior que zero.')
  .max(LIMITES.valorMaxCentavos, 'Valor acima do permitido.');

const campoCodigo = z
  .string()
  .max(80, 'Código muito longo.')
  .refine(
    (v) => normalizarCodigo(v) === '' || ehCodigoValido(normalizarCodigo(v)),
    'O código deve ter 44, 47 ou 48 dígitos.',
  );

const campoObservacao = z
  .string()
  .max(LIMITES.observacaoMax, `Máximo de ${LIMITES.observacaoMax} caracteres.`);

const campoEmpresa = campoSelecao('Selecione a empresa.');
const campoCategoria = campoSelecao('Selecione a categoria.');
/** Conta de débito: opcional ('' = sem conta). */
const campoConta = z.string().refine((v) => v === '' || ehUuid(v), 'Conta inválida.');

const camposComuns = {
  empresaId: campoEmpresa,
  categoriaId: campoCategoria,
  contaId: campoConta,
  fornecedorNome: campoFornecedor,
  descricao: campoDescricao,
  vencimento: campoVencimento,
  valorCentavos: campoValor,
  codigoBarras: campoCodigo,
  observacao: campoObservacao,
};

export const esquemaNovoLancamento = z
  .object({
    ...camposComuns,
    tipo: z.enum(['unico', 'serie']),
    quantidade: z.number({ message: 'Informe a quantidade.' }).int('Use um número inteiro.'),
    frequencia: z.literal('mensal'),
    mesmoCodigoEmTodos: z.boolean(),
  })
  .superRefine((dados, ctx) => {
    if (
      dados.tipo === 'serie' &&
      (dados.quantidade < LIMITES.parcelasMin || dados.quantidade > LIMITES.parcelasMax)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['quantidade'],
        message: `Informe entre ${LIMITES.parcelasMin} e ${LIMITES.parcelasMax} lançamentos.`,
      });
    }
  });

export type DadosNovoLancamento = z.infer<typeof esquemaNovoLancamento>;

export const esquemaEdicaoLancamento = z.object({
  ...camposComuns,
  status: z.enum(['pendente', 'pago']),
  escopo: z.enum(ESCOPOS),
});

export type DadosEdicaoLancamento = z.infer<typeof esquemaEdicaoLancamento>;

/**
 * Esquema do formulário no navegador (cadastro e edição usam o mesmo
 * componente). O servidor revalida com esquemaNovoLancamento/esquemaEdicaoLancamento.
 */
export const esquemaFormularioLancamento = z
  .object({
    ...camposComuns,
    tipo: z.enum(['unico', 'serie']),
    quantidade: z.number({ message: 'Informe a quantidade.' }).int('Use um número inteiro.'),
    frequencia: z.literal('mensal'),
    mesmoCodigoEmTodos: z.boolean(),
    status: z.enum(['pendente', 'pago']),
  })
  .superRefine((dados, ctx) => {
    if (
      dados.tipo === 'serie' &&
      (dados.quantidade < LIMITES.parcelasMin || dados.quantidade > LIMITES.parcelasMax)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['quantidade'],
        message: `Informe entre ${LIMITES.parcelasMin} e ${LIMITES.parcelasMax} lançamentos.`,
      });
    }
  });

export type ValoresFormularioLancamento = z.infer<typeof esquemaFormularioLancamento>;

export const esquemaEscopo = z.enum(ESCOPOS);
export { esquemaId } from '@/lib/validacao';

export const esquemaCodigo = z
  .string()
  .max(80)
  .refine((v) => ehCodigoValido(normalizarCodigo(v)), 'O código deve ter 44, 47 ou 48 dígitos.');

export { textoOuNulo } from '@/lib/validacao';

export function codigoOuNulo(texto: string): string | null {
  const c = normalizarCodigo(texto);
  return c === '' ? null : c;
}
