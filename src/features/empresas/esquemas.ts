import { z } from 'zod';
import { LIMITES } from '@/lib/config';
import { ehCnpjValido, normalizarCnpj } from '@/lib/domain/cnpj';

export const esquemaEmpresa = z.object({
  apelido: z
    .string()
    .trim()
    .min(1, 'Informe um apelido (ex.: J F Lima).')
    .max(LIMITES.apelidoEmpresaMax, `Máximo de ${LIMITES.apelidoEmpresaMax} caracteres.`),
  razaoSocial: z.string().trim().max(LIMITES.razaoSocialMax, `Máximo de ${LIMITES.razaoSocialMax} caracteres.`),
  cnpj: z
    .string()
    .refine((v) => normalizarCnpj(v) !== '', 'Informe o CNPJ.')
    .refine((v) => normalizarCnpj(v) === '' || ehCnpjValido(v), 'CNPJ inválido. Confira os números (e letras, no CNPJ novo).'),
});

export type DadosEmpresa = z.infer<typeof esquemaEmpresa>;

export const esquemaCategoria = z
  .string()
  .trim()
  .min(1, 'Informe o nome da categoria.')
  .max(LIMITES.nomeCategoriaMax, `Máximo de ${LIMITES.nomeCategoriaMax} caracteres.`);
