/**
 * Validação (Zod) da importação de planilhas e da atribuição de empresa.
 * O servidor valida tudo de novo (o navegador só envia o arquivo e as decisões).
 */
import { z } from 'zod';
import { ehDataISOValida } from '@/lib/domain/datas';
import { LIMITES_IMPORTACAO } from '@/lib/domain/importacao';
import { esquemaId } from '@/lib/validacao';

export const FRASE_DESFAZER = 'DESFAZER IMPORTACAO';

const data = z
  .string()
  .refine((v) => ehDataISOValida(v) && v >= '2000-01-01' && v <= '2100-12-31', 'Data inválida.');

export const esquemaPeriodo = z
  .object({ de: data, ate: data })
  .refine((p) => p.de <= p.ate, { path: ['ate'], message: 'O fim do período deve ser depois do início.' });

const listaDeChaves = z.array(z.string().min(1).max(600)).max(LIMITES_IMPORTACAO.linhasArquivo);

export const esquemaDecisoes = z.object({
  incluir: listaDeChaves,
  excluir: listaDeChaves,
});

/** Arquivo enviado: só CSV/texto e até o limite de tamanho. */
export function validarArquivo(arquivo: unknown): { ok: true; arquivo: File } | { ok: false; erro: string } {
  if (!(arquivo instanceof File) || arquivo.size === 0) return { ok: false, erro: 'Escolha o arquivo CSV.' };
  if (arquivo.size > LIMITES_IMPORTACAO.bytesArquivo) {
    return { ok: false, erro: `O arquivo é grande demais (máximo de ${Math.floor(LIMITES_IMPORTACAO.bytesArquivo / 1024)} KB).` };
  }
  if (!/\.(csv|txt)$/i.test(arquivo.name)) return { ok: false, erro: 'Envie um arquivo .csv (exportado da planilha).' };
  return { ok: true, arquivo };
}

export const esquemaDesfazer = z.object({
  importacaoId: esquemaId,
  senha: z.string().min(1, 'Informe sua senha.').max(200, 'Senha inválida.'),
  frase: z.literal(FRASE_DESFAZER, 'A frase não confere.'),
});

/** Filtro dos lançamentos sem empresa (mesmo da tela e da ação "todos do filtro"). */
export const esquemaFiltroSemEmpresa = z.object({
  busca: z.string().max(80).default(''),
  contaOrigem: z.string().max(120).default(''),
  categoriaId: z.union([esquemaId, z.literal('')]).default(''),
  importacaoId: z.union([esquemaId, z.literal('')]).default(''),
  estimados: z.boolean().default(false),
});
export type FiltroSemEmpresa = z.infer<typeof esquemaFiltroSemEmpresa>;

export const esquemaAtribuicao = z
  .object({
    empresaId: esquemaId,
    aplicarContaPadrao: z.boolean(),
    /** Ids escolhidos um a um… */
    ids: z.array(esquemaId).max(5000).optional(),
    /** …ou todos os que atendem ao filtro (resolvidos no servidor). */
    filtro: esquemaFiltroSemEmpresa.optional(),
  })
  .refine((v) => (v.ids && v.ids.length > 0) !== Boolean(v.filtro), { message: 'Selecione os lançamentos.' });
