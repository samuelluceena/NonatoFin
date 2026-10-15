import type { ZodError } from 'zod';

interface ErroBanco {
  code?: string;
  message?: string;
  details?: string | null;
}

/**
 * Mensagem para cada restrição de "não pode repetir" (unique) do banco.
 * Ao criar uma nova restrição unique numa migration, acrescente-a aqui.
 */
const MENSAGENS_DUPLICIDADE: Record<string, string> = {
  fornecedores_nome_unico: 'Já existe um fornecedor com esse nome.',
  empresas_apelido_unico: 'Já existe uma empresa com esse apelido.',
  empresas_cnpj_unico: 'Esse CNPJ já está cadastrado.',
  categorias_nome_unico: 'Já existe uma categoria com esse nome.',
  cartoes_nome_unico: 'Já existe um cartão com esse nome.',
  importacao_itens_chave_unica: 'Esta linha da planilha já foi importada.',
};

export interface OpcoesMensagem {
  /** Mensagem quando o registro está em uso e não pode ser excluído (código 23503). */
  emUso?: string;
}

/**
 * Traduz erros do Supabase/Postgres para mensagens compreensíveis.
 * O erro técnico completo vai apenas para o log do servidor.
 */
export function mensagemDeErro(erro: unknown, contexto: string, opcoes: OpcoesMensagem = {}): string {
  const e = (erro ?? {}) as ErroBanco;
  console.error(`[NonatoFin] ${contexto}:`, { code: e.code, message: e.message });

  const texto = `${e.message ?? ''}`.toLowerCase();
  if (texto.includes('fetch failed') || texto.includes('network') || texto.includes('econnrefused')) {
    return 'Erro de conexão com o servidor. Verifique sua internet e tente novamente.';
  }
  switch (e.code) {
    case '23505': {
      const restricao = Object.keys(MENSAGENS_DUPLICIDADE).find((nome) => texto.includes(nome));
      return restricao ? MENSAGENS_DUPLICIDADE[restricao] : 'Registro duplicado.';
    }
    case '23503':
      return opcoes.emUso ?? 'Este registro está em uso e não pode ser excluído.';
    case '23514':
      return 'Dados inválidos. Revise os campos e tente novamente.';
    case '42501':
      return 'Você não tem permissão para esta ação.';
    case 'P0002':
    case 'PGRST116':
      return 'Registro não encontrado. Ele pode ter sido excluído.';
    case '22023':
      // Regras de negócio do banco: a própria função SQL já escreve a mensagem para o usuário.
      return e.message ?? 'Dados inválidos.';
    case 'PGRST301':
    case 'PGRST303':
      return 'Sua sessão expirou. Entre novamente.';
    default:
      return 'Não foi possível concluir a operação. Tente novamente.';
  }
}

/** Converte erros do Zod em { campo: mensagem } para o formulário. */
export function errosDeCampos(erro: ZodError): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const issue of erro.issues) {
    const chave = issue.path.join('.') || '_';
    if (!campos[chave]) campos[chave] = issue.message;
  }
  return campos;
}
