import 'server-only';
/**
 * Leituras do gerenciamento de dados (sempre com RLS: só os dados do
 * próprio usuário). Escritas só pelas funções SQL limpar_dados/restaurar_backup.
 */
import { falharConsulta } from '@/lib/supabase/consultas';
import type { ClienteSupabase } from '@/lib/supabase/server';
import type { NivelLimpeza } from './esquemas';
import { lerContagens, type ArquivoBackup, type Contagens, type MotivoBackup, type ResumoBackup, type TabelaDados } from './formato-backup';

/** true se o usuário logado está na lista de autorizados. */
export async function usuarioAutorizado(supabase: ClienteSupabase): Promise<boolean> {
  const { data, error } = await supabase.rpc('usuario_autorizado');
  if (error) falharConsulta(error, 'verificar autorização');
  return data === true;
}

/** Quantos registros o usuário tem em cada tabela. */
export async function resumoDados(supabase: ClienteSupabase): Promise<Contagens> {
  const { data, error } = await supabase.rpc('resumo_dados');
  if (error) falharConsulta(error, 'resumo dos dados');
  return lerContagens(data);
}

/** Backups ainda válidos (até 30 dias), do mais recente para o mais antigo. */
export async function listarBackups(supabase: ClienteSupabase): Promise<ResumoBackup[]> {
  const { data, error } = await supabase
    .from('backups_dados')
    .select('id, nivel, motivo, criado_em, expira_em, restaurado_em, contagens')
    .gt('expira_em', new Date().toISOString())
    .order('criado_em', { ascending: false });
  if (error) falharConsulta(error, 'listar backups');
  return (data ?? []).map((b) => ({
    id: b.id,
    nivel: b.nivel as NivelLimpeza,
    motivo: b.motivo as MotivoBackup,
    criadoEm: b.criado_em,
    expiraEm: b.expira_em,
    restauradoEm: b.restaurado_em,
    contagens: lerContagens(b.contagens),
  }));
}

/** Arquivo de um backup automático (null se não existir ou for de outro usuário). */
export async function arquivoDoBackup(supabase: ClienteSupabase, id: string): Promise<ArquivoBackup | null> {
  const { data, error } = await supabase
    .from('backups_dados')
    .select('id, nivel, motivo, criado_em, expira_em, versao_formato, assinatura_esquema, contagens, sha256, conteudo')
    .eq('id', id)
    .maybeSingle();
  if (error) falharConsulta(error, 'baixar backup');
  if (!data) return null;
  return {
    formato: 'nonatofin-backup',
    versao_formato: data.versao_formato,
    origem: 'backup-automatico',
    gerado_em: new Date().toISOString(),
    backup: { id: data.id, nivel: data.nivel as NivelLimpeza, motivo: data.motivo as MotivoBackup, criado_em: data.criado_em, expira_em: data.expira_em },
    assinatura_esquema: data.assinatura_esquema,
    contagens: lerContagens(data.contagens),
    sha256: data.sha256,
    conteudo: data.conteudo as Record<TabelaDados, unknown[]>,
  };
}

/** Backup completo dos dados atuais (todas as tabelas), para download. */
export async function arquivoDosDadosAtuais(supabase: ClienteSupabase): Promise<ArquivoBackup> {
  const { data, error } = await supabase.rpc('exportar_dados');
  if (error) falharConsulta(error, 'exportar backup completo');
  const d = data as { versao_formato: number; assinatura_esquema: string; contagens: unknown; sha256: string; conteudo: Record<TabelaDados, unknown[]> };
  return {
    formato: 'nonatofin-backup',
    versao_formato: d.versao_formato,
    origem: 'exportacao',
    gerado_em: new Date().toISOString(),
    assinatura_esquema: d.assinatura_esquema,
    contagens: lerContagens(d.contagens),
    sha256: d.sha256,
    conteudo: d.conteudo,
  };
}
