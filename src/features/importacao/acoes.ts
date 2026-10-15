'use server';
/**
 * Server Actions da importação de planilhas e da atribuição de empresa.
 *
 * A prévia e a confirmação recebem o MESMO arquivo e passam pela mesma
 * análise (lib/domain/importacao.ts + dados do banco): nada do que o
 * navegador calculou é confiado. A confirmação confere o hash do arquivo da
 * prévia e grava tudo numa única transação no banco (`importar_lancamentos`).
 */
import { createHash } from 'node:crypto';
import { errosDeCampos, mensagemDeErro } from '@/lib/acoes/erros';
import { falha, sucesso, type ResultadoAcao } from '@/lib/acoes/resultado';
import { revalidarTudo } from '@/lib/acoes/revalidar';
import { exigirUsuario } from '@/lib/auth/sessao';
import { hojeISO, type DataISO } from '@/lib/domain/datas';
import {
  ErroImportacao,
  LIMITES_IMPORTACAO,
  aplicarDadosDoBanco,
  analisarArquivo,
  decodificarArquivo,
  observacaoDaLinha,
  resumirImportacao,
  selecionarLinhas,
  type AnaliseImportacao,
  type LinhaImportacao,
} from '@/lib/domain/importacao';
import { reautenticarComSenha } from '@/lib/supabase/reautenticacao';
import type { ClienteSupabase } from '@/lib/supabase/server';
import { chavesJaImportadas, idsSemEmpresa, lancamentosNoIntervalo, nomesDosCartoes, type LinhaSeparada, type ResumoGravado } from './consultas';
import { esquemaAtribuicao, esquemaDecisoes, esquemaDesfazer, esquemaPeriodo, validarArquivo } from './esquemas';

export interface PreviaImportacao {
  arquivoNome: string;
  sha256: string;
  de: DataISO;
  ate: DataISO;
  totalLinhasArquivo: number;
  linhas: LinhaImportacao[];
  /** Este mesmo arquivo já foi importado (data do lote mais recente). */
  importadoEm: string | null;
}

interface Preparada {
  arquivoNome: string;
  sha256: string;
  de: DataISO;
  ate: DataISO;
  analise: AnaliseImportacao;
}

/** Lê o formulário (arquivo + período), analisa e junta os dados do banco. */
async function preparar(supabase: ClienteSupabase, form: FormData): Promise<ResultadoAcao<Preparada>> {
  const arq = validarArquivo(form.get('arquivo'));
  if (!arq.ok) return falha(arq.erro, { arquivo: arq.erro });
  const periodo = esquemaPeriodo.safeParse({ de: form.get('de'), ate: form.get('ate') });
  if (!periodo.success) return falha('Revise o período.', errosDeCampos(periodo.error));
  const { de, ate } = periodo.data;

  const bytes = new Uint8Array(await arq.arquivo.arrayBuffer());
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  let analise: AnaliseImportacao;
  try {
    analise = analisarArquivo(decodificarArquivo(bytes), { de, ate, nomesCartoes: await nomesDosCartoes(supabase) });
  } catch (e) {
    if (e instanceof ErroImportacao) return falha(e.message, { arquivo: e.message });
    console.error('[NonatoFin] ler planilha:', e);
    return falha('Não foi possível ler o arquivo. Confira se é um CSV exportado da planilha.');
  }

  const datas = analise.linhas.filter((l) => l.situacao !== 'excluida' && l.vencimento).map((l) => l.vencimento!);
  const [chavesImportadas, existentes] = await Promise.all([
    chavesJaImportadas(supabase),
    datas.length > 0 ? lancamentosNoIntervalo(supabase, datas.reduce((a, b) => (a < b ? a : b)), datas.reduce((a, b) => (a > b ? a : b))) : [],
  ]);
  return sucesso({
    arquivoNome: arq.arquivo.name.slice(0, 200),
    sha256,
    de,
    ate,
    analise: aplicarDadosDoBanco(analise, { chavesImportadas, existentes }),
  });
}

export async function previsualizarImportacao(form: FormData): Promise<ResultadoAcao<PreviaImportacao>> {
  const { supabase } = await exigirUsuario();
  try {
    const p = await preparar(supabase, form);
    if (!p.ok) return p;
    const { data: anterior } = await supabase
      .from('importacoes')
      .select('criado_em')
      .eq('arquivo_sha256', p.dados.sha256)
      .eq('status', 'concluida')
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle();
    return sucesso({
      arquivoNome: p.dados.arquivoNome,
      sha256: p.dados.sha256,
      de: p.dados.de,
      ate: p.dados.ate,
      totalLinhasArquivo: p.dados.analise.totalLinhasArquivo,
      linhas: p.dados.analise.linhas,
      importadoEm: anterior?.criado_em ?? null,
    });
  } catch (e) {
    return falha(mensagemDeErro(e, 'prévia da importação'));
  }
}

export interface ResultadoImportacao {
  importacaoId: string;
  importados: number;
  jaImportados: number;
  totalCentavos: number;
}

const separada = (l: LinhaImportacao): LinhaSeparada => ({
  numero: l.numero,
  vencimento: l.vencimento,
  descricao: l.descricao,
  valorCentavos: l.valorCentavos,
  contaOrigem: l.contaOrigem,
  motivo: l.motivo ?? '',
  detalhe: l.detalhe,
});

export async function confirmarImportacao(form: FormData): Promise<ResultadoAcao<ResultadoImportacao>> {
  const { supabase } = await exigirUsuario();
  let decisoes;
  try {
    decisoes = esquemaDecisoes.safeParse(JSON.parse(String(form.get('decisoes') ?? '')));
  } catch {
    return falha('Decisões inválidas. Refaça a prévia.');
  }
  if (!decisoes.success) return falha('Decisões inválidas. Refaça a prévia.');

  try {
    const p = await preparar(supabase, form);
    if (!p.ok) return p;
    if (p.dados.sha256 !== form.get('sha256')) {
      return falha('O arquivo mudou desde a prévia. Gere a prévia de novo antes de importar.');
    }
    const { importar, semDecisao } = selecionarLinhas(p.dados.analise.linhas, decisoes.data);
    if (semDecisao.length > 0) {
      return falha(`Decida o que fazer com ${semDecisao.length} ${semDecisao.length === 1 ? 'linha' : 'linhas'} em conferência antes de importar.`);
    }
    if (importar.length === 0) return falha('Nenhum lançamento selecionado para importar.');
    if (importar.length > LIMITES_IMPORTACAO.lancamentosPorLote) {
      return falha(`Importe no máximo ${LIMITES_IMPORTACAO.lancamentosPorLote} lançamentos por vez (reduza o período).`);
    }

    const hoje = hojeISO();
    const resumo = resumirImportacao(p.dados.analise, importar);
    const escolhidas = new Set(importar.map((l) => l.chave));
    const resumoGravado: ResumoGravado = {
      motivos: resumo.porMotivo.map((m) => ({ motivo: m.motivo, rotulo: m.rotulo, quantidade: m.quantidade, totalCentavos: m.totalCentavos })),
      // Separadas para conferência e não importadas: ficam registradas para revisão posterior.
      separadas: p.dados.analise.linhas.filter((l) => l.situacao === 'conferir' && !escolhidas.has(l.chave)).map(separada),
      incluidasNaConferencia: importar.filter((l) => l.situacao === 'conferir').length,
      valoresEstimados: resumo.valoresEstimados,
    };

    const { data, error } = await supabase.rpc('importar_lancamentos', {
      p_arquivo_nome: p.dados.arquivoNome,
      p_arquivo_sha256: p.dados.sha256,
      p_periodo_de: p.dados.de,
      p_periodo_ate: p.dados.ate,
      p_linhas_arquivo: p.dados.analise.totalLinhasArquivo,
      p_resumo: resumoGravado as never,
      p_linhas: importar.map((l) => ({
        chave: l.chave,
        linha: l.numero,
        vencimento: l.vencimento,
        descricao: l.descricao,
        valor_centavos: l.valorCentavos,
        fornecedor: l.fornecedor,
        categoria: l.categoria,
        codigo_barras: l.codigoBarras,
        observacao: observacaoDaLinha(l, p.dados.arquivoNome, hoje),
        conta_origem: l.contaOrigem,
        categoria_origem: l.categoriaOrigem,
        valor_estimado: l.valorEstimado,
      })),
    });
    if (error) return falha(mensagemDeErro(error, 'importar lançamentos'));
    const r = data as { importacao_id: string; importados: number; ja_importados: number; total_centavos: number };
    revalidarTudo();
    return sucesso(
      { importacaoId: r.importacao_id, importados: r.importados, jaImportados: r.ja_importados, totalCentavos: Number(r.total_centavos) },
      `${r.importados} lançamentos importados.`,
    );
  } catch (e) {
    return falha(mensagemDeErro(e, 'importar lançamentos'));
  }
}

const FALHA_SENHA = {
  senha: 'Senha incorreta.',
  limite: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  erro: 'Não foi possível confirmar sua senha. Tente novamente.',
} as const;

/** Desfaz um lote: apaga os lançamentos dele que continuam pendentes (pede a senha). */
export async function desfazerImportacao(entrada: unknown): Promise<ResultadoAcao<{ removidos: number; mantidos: number }>> {
  const { usuario, supabase } = await exigirUsuario();
  const v = esquemaDesfazer.safeParse(entrada);
  if (!v.success) return falha('Revise os campos destacados.', errosDeCampos(v.error));

  const sessao = await reautenticarComSenha(usuario.email, v.data.senha, usuario.id);
  if (!sessao.ok) return falha(FALHA_SENHA[sessao.motivo], sessao.motivo === 'senha' ? { senha: 'Senha incorreta.' } : undefined);
  await sessao.encerrar();

  const { data, error } = await supabase.rpc('desfazer_importacao', { p_importacao_id: v.data.importacaoId, p_frase: v.data.frase });
  if (error) return falha(mensagemDeErro(error, 'desfazer importação'));
  const r = data as { removidos: number; mantidos: number };
  revalidarTudo();
  const mantidos = r.mantidos > 0 ? ` ${r.mantidos} já ${r.mantidos === 1 ? 'pago foi mantido' : 'pagos foram mantidos'}.` : '';
  return sucesso(r, `Importação desfeita: ${r.removidos} ${r.removidos === 1 ? 'lançamento removido' : 'lançamentos removidos'}.${mantidos}`);
}

/** Define a empresa de lançamentos sem empresa (escolhidos ou todos do filtro). */
export async function atribuirEmpresa(entrada: unknown): Promise<ResultadoAcao<{ quantidade: number }>> {
  const { supabase } = await exigirUsuario();
  const v = esquemaAtribuicao.safeParse(entrada);
  if (!v.success) return falha(v.error.issues[0]?.message ?? 'Dados inválidos.');
  try {
    const ids = v.data.ids ?? (await idsSemEmpresa(supabase, v.data.filtro!));
    if (ids.length === 0) return falha('Nenhum lançamento sem empresa neste filtro.');
    const { data, error } = await supabase.rpc('atribuir_empresa_lancamentos', {
      p_ids: ids,
      p_empresa_id: v.data.empresaId,
      p_aplicar_conta_padrao: v.data.aplicarContaPadrao,
    });
    if (error) return falha(mensagemDeErro(error, 'atribuir empresa'));
    revalidarTudo();
    const n = data ?? 0;
    return sucesso({ quantidade: n }, `Empresa definida em ${n} ${n === 1 ? 'lançamento' : 'lançamentos'}.`);
  } catch (e) {
    return falha(mensagemDeErro(e, 'atribuir empresa'));
  }
}
