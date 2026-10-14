'use server';
/**
 * Server Actions do gerenciamento de dados. A senha é confirmada abrindo uma
 * sessão nova e temporária; a operação roda no banco com o token dessa sessão
 * (o banco exige login por senha nos últimos 120 s). Backup e exclusão/
 * restauração acontecem numa única transação no banco.
 */
import { cookies } from 'next/headers';
import { errosDeCampos, mensagemDeErro } from '@/lib/acoes/erros';
import { falha, sucesso, type ResultadoAcao } from '@/lib/acoes/resultado';
import { revalidarTudo } from '@/lib/acoes/revalidar';
import { exigirUsuario } from '@/lib/auth/sessao';
import { reautenticarComSenha } from '@/lib/supabase/reautenticacao';
import { COOKIE_EMPRESA } from '@/features/empresas/constantes';
import { esquemaLimpeza, esquemaRestauracao } from './esquemas';
import { lerContagens, resumirContagens, tabelasDoNivel, type Contagens } from './formato-backup';

export interface ResultadoOperacao {
  /** Para onde levar o usuário depois. */
  destino: string;
  backupId: string;
  contagens: Contagens;
}

const FALHA_REAUTENTICACAO = {
  senha: 'Senha incorreta.',
  limite: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  erro: 'Não foi possível confirmar sua senha. Tente novamente.',
} as const;

function traduzirErro(erro: { code?: string; message?: string }, contexto: string): string {
  switch (erro.code) {
    case '28000':
      return 'A confirmação de senha expirou. Tente novamente.';
    case '55P03':
      return erro.message ?? 'Já existe uma operação em andamento.';
    case '23503':
      return 'Algum cadastro usado por este backup (empresa, conta, cartão, categoria ou fornecedor) não existe mais. Nada foi alterado.';
    default:
      return mensagemDeErro(erro, contexto);
  }
}

export async function limparDados(entrada: unknown): Promise<ResultadoAcao<ResultadoOperacao>> {
  const { usuario } = await exigirUsuario();
  const v = esquemaLimpeza.safeParse(entrada);
  if (!v.success) return falha('Revise os campos destacados.', errosDeCampos(v.error));

  const sessao = await reautenticarComSenha(usuario.email, v.data.senha, usuario.id);
  if (!sessao.ok) {
    return falha(FALHA_REAUTENTICACAO[sessao.motivo], sessao.motivo === 'senha' ? { senha: 'Senha incorreta.' } : undefined);
  }
  let resposta;
  try {
    resposta = await sessao.cliente.rpc('limpar_dados', { p_nivel: v.data.nivel, p_frase: v.data.frase });
  } finally {
    await sessao.encerrar();
  }
  if (resposta.error) return falha(traduzirErro(resposta.error, 'limpar dados'));

  const r = resposta.data as { backup_id: string; apagados: unknown };
  const apagados = lerContagens(r.apagados);
  revalidarTudo();
  // Sem empresas, a empresa escolhida no topo deixa de existir.
  if (v.data.nivel === 'completo') (await cookies()).delete(COOKIE_EMPRESA);
  return sucesso(
    { destino: v.data.nivel === 'financeiro' ? '/conferir-saldos' : '/', backupId: r.backup_id, contagens: apagados },
    `Dados apagados: ${resumirContagens(apagados, tabelasDoNivel(v.data.nivel))}. Backup guardado por 30 dias.`,
  );
}

export async function restaurarBackup(entrada: unknown): Promise<ResultadoAcao<ResultadoOperacao>> {
  const { usuario } = await exigirUsuario();
  const v = esquemaRestauracao.safeParse(entrada);
  if (!v.success) return falha('Revise os campos destacados.', errosDeCampos(v.error));

  const sessao = await reautenticarComSenha(usuario.email, v.data.senha, usuario.id);
  if (!sessao.ok) {
    return falha(FALHA_REAUTENTICACAO[sessao.motivo], sessao.motivo === 'senha' ? { senha: 'Senha incorreta.' } : undefined);
  }
  let resposta;
  try {
    resposta = await sessao.cliente.rpc('restaurar_backup', { p_backup_id: v.data.backupId, p_frase: v.data.frase });
  } finally {
    await sessao.encerrar();
  }
  if (resposta.error) return falha(traduzirErro(resposta.error, 'restaurar backup'));

  const r = resposta.data as { backup_anterior_id: string; restaurados: unknown };
  const restaurados = lerContagens(r.restaurados);
  revalidarTudo();
  return sucesso(
    { destino: '/', backupId: r.backup_anterior_id, contagens: restaurados },
    'Backup restaurado. O estado anterior foi guardado em um novo backup.',
  );
}
