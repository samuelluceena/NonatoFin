import { NextResponse, type NextRequest } from 'next/server';
import { gerarCsv } from '@/features/exportacao/csv';
import { montarLinhasExportacao, nomeArquivoExportacao } from '@/features/exportacao/linhas';
import { gerarXlsx } from '@/features/exportacao/xlsx';
import { listarLancamentosFiltrados, listarTodosLancamentos, opcoesDosFiltros } from '@/features/lancamentos/consultas';
import { obterContextoEmpresas } from '@/features/empresas/consultas';
import { obterUsuario } from '@/lib/auth/sessao';
import { hojeISO } from '@/lib/domain/datas';
import { lerFiltros } from '@/lib/domain/filtros';
import { criarClienteServidor } from '@/lib/supabase/server';

/**
 * GET /api/exportar?formato=csv|xlsx
 *   Exporta TODOS os lançamentos do usuário autenticado (RLS aplicada).
 * GET /api/exportar?formato=csv|xlsx&lista=1&periodo=...&status=...
 *   Exporta só o que a lista de Boletos está mostrando (mesmos parâmetros
 *   da URL da lista, lidos por `lerFiltros`).
 */
export async function GET(request: NextRequest) {
  const usuario = await obterUsuario();
  if (!usuario) return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 });

  const parametros = request.nextUrl.searchParams;
  const formato = parametros.get('formato') === 'xlsx' ? 'xlsx' : 'csv';
  const filtrado = parametros.get('lista') === '1';
  try {
    const supabase = await criarClienteServidor();
    const hoje = hojeISO();
    // Exporta a empresa selecionada no topo (ou todas).
    const { empresaId } = await obterContextoEmpresas();
    const lancamentos = filtrado
      ? await listarLancamentosFiltrados(supabase, opcoesDosFiltros(lerFiltros(Object.fromEntries(parametros), hoje), hoje, empresaId))
      : await listarTodosLancamentos(supabase, empresaId);
    const linhas = montarLinhasExportacao(lancamentos, hoje);
    const nome = nomeArquivoExportacao(hoje, formato, filtrado);
    const cabecalhos = {
      'Content-Disposition': `attachment; filename="${nome}"`,
      'Cache-Control': 'no-store, private',
      'X-Content-Type-Options': 'nosniff',
    };

    if (formato === 'xlsx') {
      const arquivo = gerarXlsx(linhas);
      return new NextResponse(new Blob([arquivo as BlobPart]), {
        headers: {
          ...cabecalhos,
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      });
    }
    return new NextResponse(gerarCsv(linhas), {
      headers: { ...cabecalhos, 'Content-Type': 'text/csv; charset=utf-8' },
    });
  } catch (erro) {
    console.error('[NonatoFin] exportar:', erro instanceof Error ? erro.message : erro);
    return NextResponse.json({ erro: 'Não foi possível exportar os dados.' }, { status: 500 });
  }
}
