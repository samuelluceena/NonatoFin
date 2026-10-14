/**
 * Recuperação a partir do arquivo .json (backups internos expirados), no
 * Supabase LOCAL com dados fictícios. Executa o PRÓPRIO script administrativo
 * supabase/snippets/importar-backup-json.sql, trocando só as três linhas
 * marcadas "<<< EDITE" — exatamente como no SQL Editor.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { arquivoDosDadosAtuais } from '@/features/dados/consultas';
import type { ClienteSupabase } from '@/lib/supabase/server';
import {
  bancoDireto,
  clienteAnonimo,
  criarFornecedor,
  criarUsuarioTeste,
  removerUsuario,
  type Cliente,
  type UsuarioTeste,
} from './auxiliares';

const db = bancoDireto();
const SCRIPT = readFileSync('supabase/snippets/importar-backup-json.sql', 'utf8');
const SENHA = 'senha-integracao-123';
const TABELAS = ['empresas', 'categorias', 'fornecedores', 'contas_bancarias', 'cartoes', 'lancamentos', 'compras_cartao', 'parcelas_cartao', 'movimentos_conta'];
const removidos = new Set<string>();
const usuarios: UsuarioTeste[] = [];

afterAll(async () => {
  await Promise.all(usuarios.filter((u) => !removidos.has(u.id)).map((u) => removerUsuario(u.id)));
  await db.end();
});

type Dados<R> = R extends { data: infer D } ? NonNullable<D> : void;

function ok<R extends { error: unknown }>(r: R): Dados<R> {
  if (r.error) throw r.error;
  return (r as { data?: unknown }).data as Dados<R>;
}

/** O script com as três linhas preenchidas (o restante fica intacto). */
function scriptPreenchido(email: string, json: string, confirmacao = 'IMPORTAR BACKUP JSON') {
  const linhas = SCRIPT.split(/\r?\n/);
  const trocar = (prefixo: string, nova: string) => {
    const i = linhas.findIndex((l) => l.trimStart().startsWith(prefixo) && l.includes('<<< EDITE'));
    if (i < 0) throw new Error(`linha ${prefixo} não encontrada no script`);
    linhas[i] = nova;
  };
  trocar('v_email', `  v_email text := '${email}';`);
  trocar('v_confirmacao', `  v_confirmacao text := '${confirmacao}';`);
  trocar('v_arquivo', `  v_arquivo jsonb := $arquivo$${json}$arquivo$::jsonb;`);
  return linhas.join('\n');
}

async function executar(sql: string): Promise<string | null> {
  try {
    await db.query(sql);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

async function retrato(userId: string) {
  const r: Record<string, unknown[]> = {};
  for (const t of TABELAS) {
    const { rows } = await db.query(`select coalesce(jsonb_agg(to_jsonb(x) - 'user_id' order by x.id), '[]') j from public.${t} x where user_id = $1`, [userId]);
    r[t] = rows[0].j;
  }
  return r;
}

const totalBackups = async (userId: string) =>
  Number((await db.query('select count(*) n from public.backups_dados where user_id = $1', [userId])).rows[0].n);

async function semear(u: UsuarioTeste) {
  const c = u.cliente;
  const forn = await criarFornecedor(c, 'Fornecedor "Ação" \\ Ç');
  const banco = await criarFornecedor(c, 'Banco');
  const conta = ok(await c.from('contas_bancarias').insert({ empresa_id: u.empresaId, apelido: 'Itaú', banco: 'Itaú', padrao: true }).select('id').single()).id;
  const conta2 = ok(await c.from('contas_bancarias').insert({ empresa_id: u.empresaId, apelido: 'Nubank', banco: 'Nu' }).select('id').single()).id;
  ok(await c.rpc('conferir_saldo', { p_conta_id: conta, p_saldo_informado: 99_999_999_999 }));
  ok(await c.rpc('conferir_saldo', { p_conta_id: conta2, p_saldo_informado: -12_345 }));
  ok(await c.rpc('transferir_entre_contas', { p_origem_id: conta, p_destino_id: conta2, p_valor: 777, p_data: ok(await c.rpc('hoje_app')), p_descricao: 'emoji 🚀\nlinha' }));
  const serie = randomUUID();
  const ls = ok(await c.from('lancamentos').insert([1, 2].map((n) => ({
    ...{ empresa_id: u.empresaId, categoria_id: u.categoriaId, fornecedor_id: forn }, descricao: `Aluguel ${n}`, valor_centavos: 100_001,
    vencimento: n === 1 ? '2026-11-30' : '2026-12-31', serie_id: serie, parcela: n, total_parcelas: 2, observacao: 'tab\t"aspas"',
  }))).select('id'));
  ok(await c.rpc('definir_pagamento', { p_id: ls[0].id, p_pago: true, p_conta_id: conta }));
  const cat = u.categorias['Cartão de crédito'];
  const cartao = ok(await c.from('cartoes').insert({ empresa_id: u.empresaId, fornecedor_id: banco, categoria_fatura_id: cat, nome: 'Visa', dia_fechamento: 25, dia_vencimento: 5, conta_id: conta }).select('id').single()).id;
  for (const [v, p] of [[30_000, 3], [10_001, 2]]) {
    ok(await c.rpc('registrar_compra_cartao', { p_cartao_id: cartao, p_categoria_id: cat, p_descricao: 'Compra', p_data_compra: '2026-09-01', p_valor_total: v, p_parcelas: p, p_primeira_fatura_mes: '2026-10', p_observacao: null }));
  }
  const fatura = ok(await c.from('lancamentos').select('id').eq('cartao_id', cartao).eq('fatura_mes', '2026-10').single()).id;
  ok(await c.rpc('definir_ajuste_fatura', { p_id: fatura, p_ajuste: 1_500, p_observacao: 'Anuidade' }));
  ok(await c.rpc('definir_pagamento', { p_id: fatura, p_pago: true }));
}

/** Arquivo idêntico ao baixado em /api/backup (mesma função e mesma serialização). */
async function baixarArquivo(c: Cliente) {
  return JSON.stringify(await arquivoDosDadosAtuais(c as unknown as ClienteSupabase), null, 2);
}

async function novaSessao(email: string) {
  const c = clienteAnonimo();
  ok(await c.auth.signInWithPassword({ email, password: SENHA }));
  return c;
}

describe('recuperação a partir do arquivo .json', () => {
  let a: UsuarioTeste;
  let original: Record<string, unknown[]>;
  let arquivo: string;

  beforeAll(async () => {
    a = await criarUsuarioTeste();
    usuarios.push(a);
    await semear(a);
    original = await retrato(a.id);
    arquivo = await baixarArquivo(a.cliente);

    // Desastre: reinício completo e backups internos "expirados" (apagados).
    ok(await (await novaSessao(a.email)).rpc('limpar_dados', { p_nivel: 'completo', p_frase: 'REINICIAR NONATOFIN' }));
    await db.query('delete from public.backups_dados where user_id = $1', [a.id]);
    // O usuário voltou a usar o app antes de perceber.
    ok(await a.cliente.rpc('garantir_categorias_padrao'));
  });

  it('o arquivo tem as 9 tabelas e o cenário completo', () => {
    const j = JSON.parse(arquivo);
    expect(j.formato).toBe('nonatofin-backup');
    expect(Object.keys(j.conteudo).sort()).toEqual([...TABELAS].sort());
    expect(j.contagens).toMatchObject({ parcelas_cartao: 5, compras_cartao: 2, movimentos_conta: 4, contas_bancarias: 2 });
  });

  describe('importações inválidas não gravam nada', () => {
    const casos: [string, () => string, string][] = [
      ['sem a frase de confirmação', () => scriptPreenchido(a.email, arquivo, 'NAO'), 'Confirmação ausente'],
      ['script original, sem editar', () => SCRIPT, 'Confirmação ausente'],
      ['arquivo adulterado (um valor mudou)', () => scriptPreenchido(a.email, arquivo.replace('"valor_centavos": 100001', '"valor_centavos": 100002')), 'hash não confere'],
      ['hash trocado', () => scriptPreenchido(a.email, JSON.stringify({ ...JSON.parse(arquivo), sha256: '0'.repeat(64) })), 'hash não confere'],
      ['contagens falsas', () => scriptPreenchido(a.email, JSON.stringify({ ...JSON.parse(arquivo), contagens: { ...JSON.parse(arquivo).contagens, empresas: 99 } })), 'contagens'],
      ['outra versão do banco', () => scriptPreenchido(a.email, JSON.stringify({ ...JSON.parse(arquivo), assinatura_esquema: 'abc' })), 'outra versão do banco'],
      ['outra versão do formato', () => scriptPreenchido(a.email, JSON.stringify({ ...JSON.parse(arquivo), versao_formato: 2 })), 'Versão de formato'],
      ['não é backup do NonatoFin', () => scriptPreenchido(a.email, '{"formato":"outro","conteudo":{}}'), 'não é um backup'],
      ['JSON que não é objeto', () => scriptPreenchido(a.email, '[1,2,3]'), 'não é um backup'],
      ['tabela faltando', () => { const j = JSON.parse(arquivo); delete j.conteudo.empresas; return scriptPreenchido(a.email, JSON.stringify(j)); }, '9 tabelas'],
      ['tabela extra', () => { const j = JSON.parse(arquivo); j.conteudo.usuarios_autorizados = []; return scriptPreenchido(a.email, JSON.stringify(j)); }, '9 tabelas'],
      ['e-mail inexistente', () => scriptPreenchido('ninguem@teste.local', arquivo), 'não encontrado'],
      ['JSON quebrado', () => scriptPreenchido(a.email, '{"formato": '), 'invalid input syntax for type json'],
    ];
    for (const [nome, sql, erro] of casos) {
      it(nome, async () => {
        const antes = await retrato(a.id);
        expect(await executar(sql())).toContain(erro);
        expect(await totalBackups(a.id)).toBe(0);
        expect(await retrato(a.id)).toEqual(antes);
      });
    }

    it('usuário fora de usuarios_autorizados', async () => {
      const intruso = await criarUsuarioTeste(false);
      usuarios.push(intruso);
      expect(await executar(scriptPreenchido(intruso.email, arquivo))).toContain('usuarios_autorizados');
      expect(await totalBackups(intruso.id)).toBe(0);
    });

    it('papel não administrativo (authenticated) não consegue executar', async () => {
      const cliente = await db.connect();
      try {
        await cliente.query('begin');
        await cliente.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: a.id, role: 'authenticated' })]);
        await cliente.query('set local role authenticated');
        await expect(cliente.query(scriptPreenchido(a.email, arquivo))).rejects.toThrow(/administrador|permission denied/);
      } finally {
        await cliente.query('rollback');
        cliente.release();
      }
      expect(await totalBackups(a.id)).toBe(0);
    });
  });

  it('arquivo íntegro: importa como backup completo de 7 dias, sem alterar dados', async () => {
    const antes = await retrato(a.id);
    expect(await executar(scriptPreenchido(a.email, arquivo))).toBeNull();
    const { rows } = await db.query(
      `select nivel, expira_em between now() + interval '6 days 23 hours' and now() + interval '7 days 1 minute' as prazo,
              sha256 = encode(sha256(convert_to(conteudo::text, 'UTF8')), 'hex') as hash_ok
         from public.backups_dados where user_id = $1`,
      [a.id],
    );
    expect(rows).toEqual([{ nivel: 'completo', prazo: true, hash_ok: true }]);
    expect(await retrato(a.id)).toEqual(antes);
  });

  it('restauração pelo caminho do app devolve os dados idênticos e as travas', async () => {
    const { rows } = await db.query('select id from public.backups_dados where user_id = $1', [a.id]);
    const sessao = await novaSessao(a.email);
    ok(await sessao.rpc('restaurar_backup', { p_backup_id: rows[0].id, p_frase: 'RESTAURAR BACKUP' }));
    expect(await retrato(a.id)).toEqual(original);
    const trava = await sessao.from('parcelas_cartao').update({ valor_centavos: 1 }).eq('fatura_mes', '2026-10');
    expect(trava.error?.message).toContain('já está paga');
    const { rows: pre } = await db.query(`select contagens from public.backups_dados where user_id = $1 and motivo = 'antes_da_restauracao'`, [a.id]);
    expect(pre[0].contagens.categorias).toBe(5); // o que existia depois do desastre ficou guardado
  });

  it('conta recriada (outro id): importa e restaura os dados para a conta nova', async () => {
    const arquivoAntigo = arquivo;
    await removerUsuario(a.id);
    removidos.add(a.id);
    const nova = await criarUsuarioTeste();
    usuarios.push(nova);
    // A conta nova já tem uma empresa e categorias padrão (criadas pelos auxiliares).
    expect(await executar(scriptPreenchido(nova.email, arquivoAntigo))).toBeNull();
    const { rows } = await db.query('select id from public.backups_dados where user_id = $1', [nova.id]);
    ok(await (await novaSessao(nova.email)).rpc('restaurar_backup', { p_backup_id: rows[0].id, p_frase: 'RESTAURAR BACKUP' }));
    expect(await retrato(nova.id)).toEqual(original);
    const { rows: outros } = await db.query('select count(*) n from public.lancamentos where user_id = $1', [a.id]);
    expect(Number(outros[0].n)).toBe(0);
  });

  it('o script não usa SQL dinâmico', () => {
    expect(SCRIPT).not.toMatch(/\bexecute\b/i);
    expect(SCRIPT).not.toMatch(/\bformat\s*\(/i);
  });
});
