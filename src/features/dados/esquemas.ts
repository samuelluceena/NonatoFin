/**
 * Validação das operações de gerenciamento de dados (usada no formulário e
 * na Server Action). O banco confere as mesmas frases de novo.
 */
import { z } from 'zod';
import { esquemaId } from '@/lib/validacao';

export type NivelLimpeza = 'financeiro' | 'completo';

export const FRASES = {
  financeiro: 'LIMPAR DADOS FINANCEIROS',
  completo: 'REINICIAR NONATOFIN',
  restaurar: 'RESTAURAR BACKUP',
} as const;

const senha = z.string().min(1, 'Informe sua senha.').max(200, 'Senha inválida.');

export const esquemaLimpeza = z
  .object({
    nivel: z.enum(['financeiro', 'completo'], 'Opção inválida.'),
    senha,
    frase: z.string(),
  })
  .refine((v) => v.frase === FRASES[v.nivel], { path: ['frase'], message: 'A frase não confere.' });

export const esquemaRestauracao = z.object({
  backupId: esquemaId,
  senha,
  frase: z.literal(FRASES.restaurar, 'A frase não confere.'),
});
