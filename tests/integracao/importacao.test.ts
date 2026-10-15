/**
 * Importação de planilha e lançamentos sem empresa contra o banco real:
 * gravação atômica, idempotência (chave por linha), fornecedores/categorias
 * reaproveitados, regra "conta só com empresa", atribuição em lote, desfazer,
 * RLS/IDOR, compatibilidade com backup/restauração e as consultas do app.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { contarSemEmpresa, contasDeOrigemSemEmpresa, idsSemEmpresa, listarSemEmpresa, situacaoDoLote } from '@/features/importacao/consultas';
import { listarLancamentos } from '@/features/lancamentos/consultas';
import { listarTransacoes } from '@/features/transacoes/consultas';
import { SEM_EMPRESA } from '@/lib/domain/filtros';
import { FILTROS_TRANSACOES_PADRAO } from '@/lib/domain/transacoes';
import type { ClienteSupabase } from '@/lib/supabase/server';
import { bancoDireto, clienteAnonimo, criarFornecedor, criarUsuarioTeste, removerUsuario, vinculo, type Cliente, type UsuarioTeste } from './auxiliares';

let dono: UsuarioTeste;
let intruso: UsuarioTeste;
let semAutorizacao: UsuarioTeste;
let contaPadrao: string;
const SHA = 'a'.repeat(64);
const SHA2 = 'b'.repeat(64);

const cliente = (u: UsuarioTeste) => u.cliente as unknown as ClienteSupabase;
const FILTRO_VAZIO = { busca: '', contaOrigem: '', categoriaId: '', importacaoId: '', estimados: false };

interface LinhaRpc {
  chave: string;
  linha: number;
  vencimento: string;
  descricao: string;
  valor_centavos: number;
  fornecedor: string;
  categoria: string;
  codigo_barras?: string | null;
  observacao?: string;
  conta_origem?: string;
  categoria_origem?: string;
  valor_estimado?: boolean;
}

function linha(n: number, parcial: Partial<LinhaRpc> = {}): LinhaRpc {
  return {
    chave: `2027-01-${String(n).padStart(2, '0')}|1000|linha ${n}|carteira|1`,
    linha: n + 1,
    vencimento: `2027-01-${String(n).padStart(2, '0')}`,
    descricao: `Linha ${n}`,
    valor_centavos: 1000 * n,
    fornecedor: 'Via da Moda',
    categoria: 'Mercadoria ',
    observacao: 'Importado. Conta original: Carteira.',
    conta_origem: 'Carteira',
    categoria_origem: 'Mercadoria ',
    valor_estimado: false,
    ...parcial,
  };
}

function importar(c: Cliente, linhas: LinhaRpc[], sha = SHA, periodo = { de: '2026-10-14', ate: '2027-12-31' }) {
  return c.rpc('importar_lancamentos', {
    p_arquivo_nome: 'Dados Gerais Financeiro.csv',
    p_arquivo_sha256: sha,
    p_periodo_de: periodo.de,
    p_periodo_ate: periodo.ate,
    p_linhas_arquivo: linhas.length + 10,
    p_resumo: { separadas: [{ numero: 99, descricao: 'Reajuste de fatura', valorCentavos: 100, vencimento: '2027-01-01', contaOrigem: 'Carteira', motivo: 'possivel-fatura-cartao', detalhe: null }] },
    p_linhas: linhas as never,
  });
}

async function contar(c: Cliente, tabela: 'importacoes' | 'importacao_itens' | 'lancamentos', filtro?: (q: never) => never): Promise<number> {
  let q = c.from(tabela).select('id', { count: 'exact', head: true });
  if (filtro) q = filtro(q as never);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

beforeAll(async () => {
  [dono, intruso, semAutorizacao] = await Promise.all([criarUsuarioTeste(true), criarUsuarioTeste(true), criarUsuarioTeste(false)]);
  // Fornecedor e categoria que já existem com outra grafia: devem ser reaproveitados.
  await criarFornecedor(dono.cliente, 'VIA DA MÓDA');
  await dono.cliente.from('categorias').insert({ nome: 'mercadoria' });
  const { data } = await dono.cliente
    .from('contas_bancarias')
    .insert({ empresa_id: dono.empresaId, apelido: 'BB Cristina', banco: 'BB', padrao: true })
    .select('id')
    .single();
  contaPadrao = data!.id;
});

afterAll(async () => {
  await Promise.all([removerUsuario(dono.id), removerUsuario(intruso.id), removerUsuario(semAutorizacao.id)]);
});

describe('lançamento sem empresa (regras do banco)', () => {
  it('aceita lançamento sem empresa, mas nunca com conta (FK composta não confere com null)', async () => {
    const fornecedor = await criarFornecedor(dono.cliente, 'Teste Regra');
    const base = { fornecedor_id: fornecedor, categoria_id: dono.categoriaId, descricao: 'x', valor_centavos: 100, vencimento: '2027-01-01' };
    const sem = await dono.cliente.from('lancamentos').insert({ ...base, empresa_id: null }).select('id').single();
    expect(sem.error).toBeNull();
    const comConta = await dono.cliente.from('lancamentos').insert({ ...base, empresa_id: null, conta_id: contaPadrao });
    expect(comConta.error?.code).toBe('23514');
    expect(comConta.error?.message).toContain('lancamentos_conta_exige_empresa');
    // Tirar a empresa de um lançamento com conta também é recusado.
    const comEmpresa = await dono.cliente.from('lancamentos').insert({ ...base, ...vinculo(dono), conta_id: contaPadrao }).select('id').single();
    const tirar = await dono.cliente.from('lancamentos').update({ empresa_id: null }).eq('id', comEmpresa.data!.id);
    expect(tirar.error?.code).toBe('23514');
    await dono.cliente.from('lancamentos').delete().in('id', [sem.data!.id, comEmpresa.data!.id]);
  });

  it('a assinatura dos backups não muda: nenhuma coluna nova nas 9 tabelas', async () => {
    const db = bancoDireto();
    try {
      const { rows } = await db.query<{ colunas: string[] }>(
        `select array_agg(column_name::text order by ordinal_position) colunas
           from information_schema.columns where table_schema = 'public' and table_name = 'lancamentos'`,
      );
      expect(rows[0].colunas).toEqual([
        'id', 'user_id', 'fornecedor_id', 'descricao', 'valor_centavos', 'vencimento', 'codigo_barras', 'observacao', 'status', 'pago_em',
        'serie_id', 'parcela', 'total_parcelas', 'created_at', 'updated_at', 'empresa_id', 'categoria_id', 'cartao_id', 'fatura_mes',
        'ajuste_centavos', 'conta_id',
      ]);
      const { rows: tabelas } = await db.query<{ t: string[] }>('select nonatofin_interno.tabelas_backup() t');
      expect(tabelas[0].t).not.toContain('importacoes');
      expect(tabelas[0].t).not.toContain('importacao_itens');
    } finally {
      await db.end();
    }
  });
});

describe('importar_lancamentos', () => {
  let lote: string;

  it('grava tudo pendente, sem empresa e sem conta, reaproveitando fornecedor e categoria', async () => {
    const r = await importar(dono.cliente, [linha(1), linha(2, { valor_estimado: true, conta_origem: 'BB | Cristina' }), linha(3, { codigo_barras: '1'.repeat(47) })]);
    expect(r.error).toBeNull();
    const dados = r.data as { importacao_id: string; importados: number; ja_importados: number; total_centavos: number };
    expect(dados).toMatchObject({ importados: 3, ja_importados: 0, total_centavos: 6000 });
    lote = dados.importacao_id;

    const { data: lancs } = await dono.cliente
      .from('lancamentos')
      .select('status, empresa_id, conta_id, pago_em, codigo_barras, fornecedor:fornecedores!lancamentos_fornecedor_fk(nome), categoria:categorias!lancamentos_categoria_fk(nome)')
      .in('descricao', ['Linha 1', 'Linha 2', 'Linha 3']);
    expect(lancs).toHaveLength(3);
    for (const l of lancs!) {
      expect(l).toMatchObject({ status: 'pendente', empresa_id: null, conta_id: null, pago_em: null });
      expect(l.fornecedor).toMatchObject({ nome: 'VIA DA MÓDA' });
      expect(l.categoria).toMatchObject({ nome: 'mercadoria' });
    }
    expect(lancs!.filter((l) => l.codigo_barras).length).toBe(1);
    expect(await contar(dono.cliente, 'importacao_itens')).toBe(3);
    const { data: imp } = await dono.cliente.from('importacoes').select('importados, total_centavos, status, resumo').eq('id', lote).single();
    expect(imp).toMatchObject({ importados: 3, total_centavos: 6000, status: 'concluida' });
    expect((imp!.resumo as { separadas: unknown[] }).separadas).toHaveLength(1);
  });

  it('é idempotente: as mesmas linhas não se repetem (nada é gravado)', async () => {
    const antes = await contar(dono.cliente, 'importacoes');
    const r = await importar(dono.cliente, [linha(1), linha(2), linha(3)]);
    expect(r.error?.code).toBe('22023');
    expect(r.error?.message).toContain('já foram importadas');
    expect(await contar(dono.cliente, 'importacoes')).toBe(antes);
    expect(await contar(dono.cliente, 'importacao_itens')).toBe(3);
  });

  it('linhas novas entram e as já importadas são ignoradas', async () => {
    const r = await importar(dono.cliente, [linha(1), linha(4)], SHA2);
    expect(r.data).toMatchObject({ importados: 1, ja_importados: 1 });
  });

  it('é atômico: uma linha inválida desfaz o lote inteiro', async () => {
    const lotes = await contar(dono.cliente, 'importacoes');
    const lancs = await contar(dono.cliente, 'lancamentos');
    const zero = await importar(dono.cliente, [linha(5), linha(6, { valor_centavos: 0 })]);
    expect(zero.error?.code).toBe('23514');
    const fora = await importar(dono.cliente, [linha(7), linha(8, { vencimento: '2026-10-13' })]);
    expect(fora.error?.message).toContain('fora do período');
    const incompleta = await importar(dono.cliente, [{ ...linha(9), descricao: null as never }]);
    expect(incompleta.error?.code).toBe('22023');
    expect(await contar(dono.cliente, 'importacoes')).toBe(lotes);
    expect(await contar(dono.cliente, 'lancamentos')).toBe(lancs);
  });

  it('recusa lote vazio, hash inválido e mais de 3.000 linhas', async () => {
    expect((await importar(dono.cliente, [])).error?.code).toBe('22023');
    expect((await importar(dono.cliente, [linha(10)], 'nao-e-hash')).error?.code).toBe('23514');
    const muitas = Array.from({ length: 3001 }, (_, i) => linha(1, { chave: `k${i}`, linha: i + 2 }));
    expect((await importar(dono.cliente, muitas)).error?.message).toContain('3.000');
  });

  it('situação do lote e consultas da tela "sem empresa"', async () => {
    expect(await situacaoDoLote(cliente(dono), lote)).toEqual({ pendentes: 3, pagos: 0, semEmpresa: 3, estimados: 1 });
    const geral = await contarSemEmpresa(cliente(dono));
    expect(geral.quantidade).toBe(4);
    expect(await contasDeOrigemSemEmpresa(cliente(dono))).toEqual([
      { conta: 'Carteira', quantidade: 3 },
      { conta: 'BB | Cristina', quantidade: 1 },
    ]);
    const bb = await listarSemEmpresa(cliente(dono), { ...FILTRO_VAZIO, contaOrigem: 'BB | Cristina' }, 50);
    expect(bb.lancamentos.map((l) => l.descricao)).toEqual(['Linha 2']);
    expect(bb.lancamentos[0].origem).toMatchObject({ importacaoId: lote, contaOrigem: 'BB | Cristina', valorEstimado: true });
    expect((await listarSemEmpresa(cliente(dono), { ...FILTRO_VAZIO, estimados: true }, 50)).quantidade).toBe(1);
    expect((await listarSemEmpresa(cliente(dono), { ...FILTRO_VAZIO, importacaoId: lote }, 50)).quantidade).toBe(3);
    expect((await listarSemEmpresa(cliente(dono), { ...FILTRO_VAZIO, busca: 'Linha 3' }, 50)).totalCentavos).toBe(3000);
    // Boletos e Transações: filtro "sem empresa" vale mesmo com uma empresa escolhida no topo.
    const boletos = await listarLancamentos(cliente(dono), { criterio: { ordem: 'asc' }, empresaId: dono.empresaId, semEmpresa: true });
    expect(boletos.lancamentos).toHaveLength(4);
    expect(boletos.lancamentos[0].empresa).toMatchObject({ id: '', apelido: '(sem empresa)' });
    const comEmpresa = await listarLancamentos(cliente(dono), { criterio: { ordem: 'asc' }, empresaId: dono.empresaId });
    expect(comEmpresa.lancamentos.some((l) => l.descricao.startsWith('Linha'))).toBe(false);
    const transacoes = await listarTransacoes(
      cliente(dono),
      { ...FILTROS_TRANSACOES_PADRAO, periodo: { tipo: 'todos' }, empresaId: SEM_EMPRESA },
      '2026-10-14',
      dono.empresaId,
    );
    expect(transacoes.itens.map((t) => t.descricao).sort()).toEqual(['Linha 1', 'Linha 2', 'Linha 3', 'Linha 4']);
  });

  it('isolamento: outro usuário não vê nem usa os dados do lote', async () => {
    expect(await contar(intruso.cliente, 'importacoes')).toBe(0);
    expect(await contar(intruso.cliente, 'importacao_itens')).toBe(0);
    expect((await contarSemEmpresa(cliente(intruso))).quantidade).toBe(0);
    // As mesmas chaves podem ser importadas por outra conta (cada usuário tem as suas).
    const r = await importar(intruso.cliente, [linha(1)]);
    expect(r.data).toMatchObject({ importados: 1 });
    // Item ligado a lançamento de outra conta: FK composta recusa.
    const { data: alheio } = await dono.cliente.from('lancamentos').select('id').eq('descricao', 'Linha 1').single();
    const { data: loteIntruso } = await intruso.cliente.from('importacoes').select('id').single();
    const forjado = await intruso.cliente.from('importacao_itens').insert({ importacao_id: loteIntruso!.id, lancamento_id: alheio!.id, chave: 'forjada', linha: 2 });
    expect(forjado.error).not.toBeNull();
    const desfazer = await intruso.cliente.rpc('desfazer_importacao', { p_importacao_id: lote, p_frase: 'DESFAZER IMPORTACAO' });
    expect(desfazer.error?.code).toBe('P0002');
  });

  it('visitante e usuário não autorizado não importam', async () => {
    expect((await importar(clienteAnonimo(), [linha(20)])).error).not.toBeNull();
    const r = await importar(semAutorizacao.cliente, [linha(20)]);
    expect(r.error?.code).toBe('42501');
  });
});

describe('atribuir_empresa_lancamentos', () => {
  it('define a empresa e a conta padrão nos pendentes; os pagos ficam sem conta', async () => {
    const ids = await idsSemEmpresa(cliente(dono), FILTRO_VAZIO);
    expect(ids).toHaveLength(4);
    // Um deles foi pago antes de receber empresa (sem conta).
    const pago = ids[0];
    expect((await dono.cliente.rpc('definir_pagamento', { p_id: pago, p_pago: true })).error).toBeNull();

    const r = await dono.cliente.rpc('atribuir_empresa_lancamentos', { p_ids: ids, p_empresa_id: dono.empresaId, p_aplicar_conta_padrao: true });
    expect(r.data).toBe(4);
    const { data } = await dono.cliente.from('lancamentos').select('id, empresa_id, conta_id, status').in('id', ids);
    for (const l of data!) {
      expect(l.empresa_id).toBe(dono.empresaId);
      expect(l.conta_id).toBe(l.id === pago ? null : contaPadrao);
    }
    // Só atua em quem está sem empresa: repetir não muda nada.
    expect((await dono.cliente.rpc('atribuir_empresa_lancamentos', { p_ids: ids, p_empresa_id: dono.empresaId, p_aplicar_conta_padrao: false })).data).toBe(0);
    expect((await contarSemEmpresa(cliente(dono))).quantidade).toBe(0);
  });

  it('IDOR: não usa empresa de outra conta nem altera lançamentos de outra conta', async () => {
    const [idIntruso] = await idsSemEmpresa(cliente(intruso), FILTRO_VAZIO);
    const comEmpresaAlheia = await intruso.cliente.rpc('atribuir_empresa_lancamentos', { p_ids: [idIntruso], p_empresa_id: dono.empresaId, p_aplicar_conta_padrao: true });
    expect(comEmpresaAlheia.error?.code).toBe('P0002');
    const { data: deDono } = await dono.cliente.from('lancamentos').select('id').limit(3);
    const naAlheia = await intruso.cliente.rpc('atribuir_empresa_lancamentos', {
      p_ids: deDono!.map((l) => l.id),
      p_empresa_id: intruso.empresaId,
      p_aplicar_conta_padrao: false,
    });
    expect(naAlheia.data).toBe(0);
    expect((await intruso.cliente.rpc('atribuir_empresa_lancamentos', { p_ids: [], p_empresa_id: intruso.empresaId, p_aplicar_conta_padrao: false })).error?.code).toBe('22023');
  });
});

describe('desfazer_importacao', () => {
  it('remove os pendentes do lote, mantém os pagos e permite importar de novo', async () => {
    const { data: lotes } = await dono.cliente.from('importacoes').select('id').eq('arquivo_sha256', SHA).single();
    const lote = lotes!.id;
    expect((await dono.cliente.rpc('desfazer_importacao', { p_importacao_id: lote, p_frase: 'desfazer' })).error?.message).toContain('frase');

    const antes = await situacaoDoLote(cliente(dono), lote);
    const r = await dono.cliente.rpc('desfazer_importacao', { p_importacao_id: lote, p_frase: 'DESFAZER IMPORTACAO' });
    expect(r.error).toBeNull();
    expect(r.data).toEqual({ removidos: antes.pendentes, mantidos: antes.pagos });
    const { data: imp } = await dono.cliente.from('importacoes').select('status, removidos, desfeita_em').eq('id', lote).single();
    expect(imp).toMatchObject({ status: 'desfeita', removidos: antes.pendentes });
    expect(imp!.desfeita_em).not.toBeNull();
    expect((await dono.cliente.rpc('desfazer_importacao', { p_importacao_id: lote, p_frase: 'DESFAZER IMPORTACAO' })).error?.message).toContain('já foi desfeita');

    // As linhas removidas podem voltar; a paga continua importada (não duplica).
    const novo = await importar(dono.cliente, [linha(1), linha(2), linha(3)]);
    expect(novo.data).toMatchObject({ importados: antes.pendentes, ja_importados: antes.pagos });
  });
});

describe('backup e restauração com lançamentos sem empresa', () => {
  it('limpar e restaurar mantém o lançamento sem empresa; o histórico do lote fica', async () => {
    // Usuário novo: o login acabou de acontecer (o banco exige senha nos últimos 120 s).
    const u = await criarUsuarioTeste(true);
    try {
      expect((await importar(u.cliente, [linha(1), linha(2)])).error).toBeNull();
      const limpo = await u.cliente.rpc('limpar_dados', { p_nivel: 'financeiro', p_frase: 'LIMPAR DADOS FINANCEIROS' });
      expect(limpo.error).toBeNull();
      expect(await contar(u.cliente, 'lancamentos')).toBe(0);
      // Os itens saem junto com os lançamentos; o registro do lote continua no histórico.
      expect(await contar(u.cliente, 'importacao_itens')).toBe(0);
      expect(await contar(u.cliente, 'importacoes')).toBe(1);

      const backupId = (limpo.data as { backup_id: string }).backup_id;
      const restaurado = await u.cliente.rpc('restaurar_backup', { p_backup_id: backupId, p_frase: 'RESTAURAR BACKUP' });
      expect(restaurado.error).toBeNull();
      const { data } = await u.cliente.from('lancamentos').select('empresa_id, conta_id, status').order('vencimento');
      expect(data).toEqual([
        { empresa_id: null, conta_id: null, status: 'pendente' },
        { empresa_id: null, conta_id: null, status: 'pendente' },
      ]);
    } finally {
      await removerUsuario(u.id);
    }
  });
});
