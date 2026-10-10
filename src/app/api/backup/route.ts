import { NextResponse, type NextRequest } from 'next/server';
import { arquivoDoBackup, arquivoDosDadosAtuais, usuarioAutorizado } from '@/features/dados/consultas';
import { nomeArquivoBackup } from '@/features/dados/formato-backup';
import { obterUsuario } from '@/lib/auth/sessao';
import { dataNoFuso, hojeISO } from '@/lib/domain/datas';
import { criarClienteServidor } from '@/lib/supabase/server';
import { ehUuid } from '@/lib/validacao';

/**
 * GET /api/backup
 *   Backup completo (.json) de TODOS os dados atuais do usuário: empresas,
 *   categorias, fornecedores, contas, cartões, lançamentos, compras, parcelas
 *   e movimentações (RLS aplicada).
 * GET /api/backup?id=<uuid>
 *   Baixa um backup automático guardado (somente do próprio usuário).
 * Respostas: 401 sem sessão · 403 logado mas fora de usuarios_autorizados ·
 * 400 id inválido · 404 backup inexistente (ou de outro usuário).
 */
export async function GET(request: NextRequest) {
  const usuario = await obterUsuario();
  if (!usuario) return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 });

  const id = request.nextUrl.searchParams.get('id');
  if (id !== null && !ehUuid(id)) return NextResponse.json({ erro: 'Backup inválido.' }, { status: 400 });
  try {
    const supabase = await criarClienteServidor();
    if (!(await usuarioAutorizado(supabase))) return NextResponse.json({ erro: 'Acesso não autorizado.' }, { status: 403 });
    const arquivo = id ? await arquivoDoBackup(supabase, id) : await arquivoDosDadosAtuais(supabase);
    if (!arquivo) return NextResponse.json({ erro: 'Backup não encontrado.' }, { status: 404 });

    const nome = arquivo.backup
      ? nomeArquivoBackup(dataNoFuso(arquivo.backup.criado_em), `automatico-${arquivo.backup.id.slice(0, 8)}`)
      : nomeArquivoBackup(hojeISO());
    return new NextResponse(JSON.stringify(arquivo, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${nome}"`,
        'Cache-Control': 'no-store, private',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (erro) {
    console.error('[NonatoFin] backup:', erro instanceof Error ? erro.message : erro);
    return NextResponse.json({ erro: 'Não foi possível gerar o backup.' }, { status: 500 });
  }
}
