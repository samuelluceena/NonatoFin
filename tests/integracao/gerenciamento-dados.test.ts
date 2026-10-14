/**
 * Gerenciamento de dados no BANCO REAL (Supabase local): limpeza (opções 1 e
 * 2), backup automático, restauração, integridade financeira, rollback,
 * permissões e reautenticação por senha (Supabase Auth real).
 * Tudo com dados fictícios; setup.ts aborta se o banco não for 127.0.0.1.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  bancoDireto,
  clienteAdmin,
  clienteAnonimo,
  criarFornecedor,
  criarUsuarioTeste,
  removerUsuario,
  type Cliente,
  type UsuarioTeste,
} from './auxiliares';

const db = bancoDireto();
const usuarios: UsuarioTeste[] = [];

const FRASE_FINANCEIRO = 'LIMPAR DADOS FINANCEIROS';
const FRASE_COMPLETO = 'REINICIAR NONATOFIN';
const FRASE_RESTAURAR = 'RESTAURAR BACKUP';
const TABELAS = ['empresas', 'categorias', 'fornecedores', 'contas_bancarias', 'cartoes', 'lancamentos', 'compras_cartao', 'parcelas_cartao', 'movimentos_conta'] as const;
const FINANCEIRAS = ['lancamentos', 'compras_cartao', 'parcelas_cartao', 'movimentos_conta'] as const;
const CADASTROS = ['empresas', 'categorias', 'fornecedores', 'contas_bancarias', 'cartoes'] as const;

type Contagens = Record<(typeof TABELAS)[number], number>;

async function novoUsuario(autorizado = true) {
  const u = await criarUsuarioTeste(autorizado);
  usuarios.push(u);
  return u;
}

afterAll(async () => {
  await Promise.all(usuarios.map((u) => removerUsuario(u.id)));
  await db.end();
});

type Dados<R> = R extends { data: infer D } ? NonNullable<D> : void;

function ok<R extends { error: unknown }>(r: R): Dados<R> {
  if (r.error) throw r.error;
  return (r as { data?: unknown }).data as Dados<R>;
}

/** Cenário completo: 2 empresas, 3 contas, série, pagamentos, cartão com fatura PAGA com ajuste. */
async function semear(u: UsuarioTeste) {
  const c = u.cliente;
  const filial = ok(await c.from('empresas').insert({ apelido: 'Filial' }).select('id').single()).id;
  const banco = await criarFornecedor(c, 'Banco Emissor');
  const fornecedor = await criarFornecedor(c, 'Fornecedor Aluguel');
  const conta = async (empresa_id: string, apelido: string, padrao: boolean, saldo: number) => {
    const id = ok(await c.from('contas_bancarias').insert({ empresa_id, apelido, banco: 'Banco', padrao }).select('id').single()).id;
    ok(await c.rpc('conferir_saldo', { p_conta_id: id, p_saldo_informado: saldo }));
    return id;
  };
  const itau = await conta(u.empresaId, 'Itaú', true, 500_000);
  const bradesco = await conta(u.empresaId, 'Bradesco', false, 120_000);
  await conta(filial, 'Nubank', true, 30_000);
  const hoje = ok(await c.rpc('hoje_app'));
  ok(await c.rpc('transferir_entre_contas', { p_origem_id: itau, p_destino_id: bradesco, p_valor: 10_000, p_data: hoje, p_descricao: 'Transferência' }));
  ok(await c.from('movimentos_conta').insert([
    { conta_id: itau, tipo: 'entrada', data: hoje, valor_centavos: 25_000, confirmado: true, descricao: 'Entrada' },
    { conta_id: itau, tipo: 'entrada', data: '2099-01-10', valor_centavos: 80_000, confirmado: false, descricao: 'Entrada prevista' },
  ]));
  const serie = randomUUID();
  const lancamentos = ok(
    await c
      .from('lancamentos')
      .insert([1, 2, 3].map((n) => ({
        empresa_id: u.empresaId, categoria_id: u.categoriaId, fornecedor_id: fornecedor, descricao: 'Aluguel',
        valor_centavos: 150_000, vencimento: `2026-${String(9 + n).padStart(2, '0')}-05`, serie_id: serie, parcela: n, total_parcelas: 3,
      })))
      .select('id, parcela'),
  );
  ok(await c.rpc('definir_pagamento', { p_id: lancamentos.find((l) => l.parcela === 1)!.id, p_pago: true, p_conta_id: itau }));

  const categoriaCartao = u.categorias['Cartão de crédito'];
  const cartao = ok(await c.from('cartoes').insert({
    empresa_id: u.empresaId, fornecedor_id: banco, categoria_fatura_id: categoriaCartao, nome: 'Visa', dia_fechamento: 5, dia_vencimento: 12, conta_id: itau,
  }).select('id').single()).id;
  for (const [descricao, valor, parcelas, mes] of [['Compra 1', 30_000, 3, '2026-10'], ['Compra 2', 10_001, 2, '2026-10'], ['Compra 3', 5_000, 1, '2026-11']] as const) {
    ok(await c.rpc('registrar_compra_cartao', {
      p_cartao_id: cartao, p_categoria_id: categoriaCartao, p_descricao: descricao, p_data_compra: '2026-09-01',
      p_valor_total: valor, p_parcelas: parcelas, p_primeira_fatura_mes: mes, p_observacao: null,
    }));
  }
  const fatura = async (mes: string) => ok(await c.from('lancamentos').select('id').eq('cartao_id', cartao).eq('fatura_mes', mes).single()).id;
  const outubro = await fatura('2026-10');
  ok(await c.rpc('definir_ajuste_fatura', { p_id: outubro, p_ajuste: 1_500, p_observacao: 'Anuidade' }));
  ok(await c.rpc('definir_pagamento', { p_id: outubro, p_pago: true }));
  ok(await c.rpc('definir_ajuste_fatura', { p_id: await fatura('2026-11'), p_ajuste: -1_000, p_observacao: 'Estorno' }));
  return { itau, cartao, outubro };
}

async function contagens(userId: string): Promise<Contagens> {
  const r = {} as Contagens;
  for (const t of TABELAS) {
    const { rows } = await db.query<{ n: string }>(`select count(*) n from public.${t} where user_id = $1`, [userId]);
    r[t] = Number(rows[0].n);
  }
  return r;
}

/** Todos os dados do usuário, linha a linha (para comparar antes × depois). */
async function retrato(userId: string, tabelas: readonly string[] = TABELAS) {
  const r: Record<string, unknown> = {};
  for (const t of tabelas) {
    const { rows } = await db.query(`select coalesce(jsonb_agg(to_jsonb(x) order by x.id), '[]') j from public.${t} x where user_id = $1`, [userId]);
    r[t] = rows[0].j;
  }
  return r;
}

async function protegidos(userId: string) {
  const { rows } = await db.query<{ auth: string; autorizado: string }>(
    `select (select count(*) from auth.users where id = $1) auth,
            (select count(*) from public.usuarios_autorizados where user_id = $1) autorizado`,
    [userId],
  );
  return { auth: Number(rows[0].auth), autorizado: Number(rows[0].autorizado) };
}

async function backupsDe(userId: string) {
  const { rows } = await db.query<{ id: string; nivel: string; motivo: string; sha256: string; hash_ok: boolean; contagens: Contagens }>(
    `select id, nivel, motivo, sha256, contagens,
            encode(sha256(convert_to(conteudo::text, 'UTF8')), 'hex') = sha256 as hash_ok
       from public.backups_dados where user_id = $1 order by criado_em desc, id desc`,
    [userId],
  );
  return rows;
}

const limpar = (c: Cliente, nivel: 'financeiro' | 'completo', frase = nivel === 'financeiro' ? FRASE_FINANCEIRO : FRASE_COMPLETO) =>
  c.rpc('limpar_dados', { p_nivel: nivel, p_frase: frase });
const restaurar = (c: Cliente, id: string, frase = FRASE_RESTAURAR) => c.rpc('restaurar_backup', { p_backup_id: id, p_frase: frase });

/** Executa SQL como um usuário autenticado com as claims dadas (simula o JWT) — sempre com ROLLBACK. */
async function comoUsuario<T>(claims: Record<string, unknown>, fn: (q: (sql: string, p?: unknown[]) => Promise<{ rows: T[] }>) => Promise<void>) {
  const cliente = await db.connect();
  try {
    await cliente.query('begin');
    await cliente.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
    await cliente.query('set local role authenticated');
    await fn((sql, p) => cliente.query(sql, p as unknown[]) as unknown as Promise<{ rows: T[] }>);
  } finally {
    await cliente.query('rollback');
    cliente.release();
  }
}

const decodificar = (jwt: string) => JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));

// =============================================================================
describe('Opção 1 — limpar dados financeiros', () => {
  let a: UsuarioTeste;
  let b: UsuarioTeste;
  let antesA: Contagens;
  let antesB: Contagens;
  let retratoA: Record<string, unknown>;
  let retratoB: Record<string, unknown>;
  let backupId: string;

  beforeAll(async () => {
    [a, b] = await Promise.all([novoUsuario(), novoUsuario()]);
    await Promise.all([semear(a), semear(b)]);
    [antesA, antesB] = await Promise.all([contagens(a.id), contagens(b.id)]);
    [retratoA, retratoB] = await Promise.all([retrato(a.id), retrato(b.id)]);
  });

  it('cenário tem fatura paga com ajuste, parcelas, compras, série, transferência e conferências', async () => {
    const { rows } = await db.query(`select status, ajuste_centavos, valor_centavos from public.lancamentos where user_id = $1 and fatura_mes = '2026-10'`, [a.id]);
    expect(rows[0]).toMatchObject({ status: 'pago', ajuste_centavos: '1500', valor_centavos: String(10_000 + 5_001 + 1_500) });
    expect(antesA).toMatchObject({ compras_cartao: 3, parcelas_cartao: 6, contas_bancarias: 3, empresas: 2 });
    expect(antesA.movimentos_conta).toBe(7); // 3 saldos iniciais + 2 da transferência + 2 entradas
  });

  it('frase errada: recusa e não apaga nada', async () => {
    const r = await limpar(a.cliente, 'financeiro', 'limpar dados financeiros');
    expect(r.error?.code).toBe('22023');
    expect(r.error?.message).toContain('frase');
    expect(await contagens(a.id)).toEqual(antesA);
    expect(await backupsDe(a.id)).toHaveLength(0);
  });

  it('frase da outra opção não serve', async () => {
    expect((await limpar(a.cliente, 'financeiro', FRASE_COMPLETO)).error?.code).toBe('22023');
    expect((await limpar(a.cliente, 'completo', FRASE_FINANCEIRO)).error?.code).toBe('22023');
    expect(await contagens(a.id)).toEqual(antesA);
  });

  it('apaga todos os dados financeiros, cria o backup e preserva os cadastros', async () => {
    const r = ok(await limpar(a.cliente, 'financeiro')) as { backup_id: string; apagados: Contagens };
    backupId = r.backup_id;
    expect(r.apagados).toMatchObject({ lancamentos: antesA.lancamentos, parcelas_cartao: 6, compras_cartao: 3, movimentos_conta: 7, empresas: 0, cartoes: 0 });
    const depois = await contagens(a.id);
    for (const t of FINANCEIRAS) expect(depois[t], t).toBe(0);
    for (const t of CADASTROS) expect(depois[t], t).toBe(antesA[t]);
  });

  it('backup completo (9 tabelas), hash válido, nível e contagens corretos', async () => {
    const [backup] = await backupsDe(a.id);
    expect(backup).toMatchObject({ id: backupId, nivel: 'financeiro', motivo: 'limpeza', hash_ok: true });
    expect(backup.contagens).toEqual(antesA);
  });

  it('saldos zerados e o app pede nova conferência de todas as contas ativas', async () => {
    const saldos = ok(await a.cliente.rpc('saldos_contas'));
    expect(saldos).toHaveLength(3);
    expect(saldos.every((s) => s.saldo_centavos === 0)).toBe(true);
    expect(ok(await a.cliente.rpc('contas_a_conferir_hoje'))).toHaveLength(3);
  });

  it('login, autorização e o outro usuário intactos', async () => {
    expect(await protegidos(a.id)).toEqual({ auth: 1, autorizado: 1 });
    expect(ok(await a.cliente.rpc('usuario_autorizado'))).toBe(true);
    expect(await retrato(b.id)).toEqual(retratoB);
    expect(await contagens(b.id)).toEqual(antesB);
  });

  it('repetir a limpeza sem dados: recusa e não cria backup vazio', async () => {
    const r = await limpar(a.cliente, 'financeiro');
    expect(r.error?.message).toContain('Não há dados');
    expect(await backupsDe(a.id)).toHaveLength(1);
  });

  it('restaura o backup: dados idênticos, faturas íntegras e trava de fatura paga ativa', async () => {
    // Depois da limpeza o app pede a conferência: esses movimentos novos vão para o backup "antes da restauração".
    const contas = ok(await a.cliente.from('contas_bancarias').select('id'));
    for (const c of contas) ok(await a.cliente.rpc('conferir_saldo', { p_conta_id: c.id, p_saldo_informado: 1_000 }));

    const r = ok(await restaurar(a.cliente, backupId)) as { backup_anterior_id: string; nivel: string };
    expect(r.nivel).toBe('financeiro');
    expect(await retrato(a.id)).toEqual(retratoA);

    const backups = await backupsDe(a.id);
    const anterior = backups.find((x) => x.id === r.backup_anterior_id)!;
    expect(anterior).toMatchObject({ motivo: 'antes_da_restauracao', hash_ok: true });
    expect(anterior.contagens.movimentos_conta).toBe(3);

    const { rows } = await db.query(`select restaurado_em from public.backups_dados where id = $1`, [backupId]);
    expect(rows[0].restaurado_em).not.toBeNull();

    const trava = await a.cliente.from('parcelas_cartao').update({ valor_centavos: 1 }).eq('fatura_mes', '2026-10');
    expect(trava.error?.message).toContain('já está paga');
    expect(await retrato(b.id)).toEqual(retratoB);
  });
});

// =============================================================================
describe('Opção 2 — restaurar o NonatoFin do zero', () => {
  let a: UsuarioTeste;
  let b: UsuarioTeste;
  let retratoA: Record<string, unknown>;
  let retratoB: Record<string, unknown>;
  let backupId: string;

  beforeAll(async () => {
    [a, b] = await Promise.all([novoUsuario(), novoUsuario()]);
    await Promise.all([semear(a), semear(b)]);
    [retratoA, retratoB] = await Promise.all([retrato(a.id), retrato(b.id)]);
  });

  it('apaga as 9 tabelas do usuário e mantém login e autorização', async () => {
    const r = ok(await limpar(a.cliente, 'completo')) as { backup_id: string; apagados: Contagens };
    backupId = r.backup_id;
    expect(r.apagados).toMatchObject({ empresas: 2, contas_bancarias: 3, cartoes: 1, categorias: 5, fornecedores: 2 });
    expect(Object.values(await contagens(a.id)).every((n) => n === 0)).toBe(true);
    expect(await protegidos(a.id)).toEqual({ auth: 1, autorizado: 1 });
    expect(ok(await a.cliente.rpc('usuario_autorizado'))).toBe(true);
  });

  it('backup completo com hash válido', async () => {
    const [backup] = await backupsDe(a.id);
    expect(backup).toMatchObject({ id: backupId, nivel: 'completo', hash_ok: true });
  });

  it('outro usuário intacto', async () => {
    expect(await retrato(b.id)).toEqual(retratoB);
  });

  it('primeiro acesso recria as 5 categorias padrão e permite cadastrar de novo', async () => {
    expect(ok(await a.cliente.rpc('garantir_categorias_padrao'))).toHaveLength(5);
    const empresa = await a.cliente.from('empresas').insert({ apelido: 'Nova empresa' }).select('id').single();
    expect(empresa.error).toBeNull();
  });

  it('restauração completa substitui o estado novo e devolve tudo exatamente como era', async () => {
    ok(await restaurar(a.cliente, backupId));
    expect(await retrato(a.id)).toEqual(retratoA);
    const saldos = ok(await a.cliente.rpc('saldos_contas'));
    expect(saldos.some((s) => s.saldo_centavos !== 0)).toBe(true);
    expect(await retrato(b.id)).toEqual(retratoB);
  });
});

// =============================================================================
describe('rollback, integridade e hashes', () => {
  let a: UsuarioTeste;
  let antes: Contagens;

  beforeAll(async () => {
    a = await novoUsuario();
    await semear(a);
    antes = await contagens(a.id);
  });

  it('erro no último passo da limpeza desfaz tudo — inclusive o backup', async () => {
    await db.query(`create function public._teste_falhar() returns trigger language plpgsql as $$
                      begin if old.user_id = '${a.id}' then raise exception 'falha simulada'; end if; return old; end $$`);
    await db.query(`create trigger _teste_falhar before delete on public.empresas for each row execute function public._teste_falhar()`);
    try {
      const r = await limpar(a.cliente, 'completo');
      expect(r.error?.message).toContain('falha simulada');
    } finally {
      await db.query('drop trigger _teste_falhar on public.empresas; drop function public._teste_falhar()');
    }
    expect(await contagens(a.id)).toEqual(antes);
    expect(await backupsDe(a.id)).toHaveLength(0);
  });

  it('backup com hash adulterado não é restaurado e nada muda', async () => {
    const backupId = (ok(await limpar(a.cliente, 'financeiro')) as { backup_id: string }).backup_id;
    const vazio = await retrato(a.id);
    await db.query(`update public.backups_dados set sha256 = repeat('0', 64) where id = $1`, [backupId]);
    const r = await restaurar(a.cliente, backupId);
    expect(r.error?.message).toContain('corrompido');
    expect(await retrato(a.id)).toEqual(vazio);
    // devolve o hash correto para os próximos testes
    await db.query(`update public.backups_dados set sha256 = encode(sha256(convert_to(conteudo::text, 'UTF8')), 'hex') where id = $1`, [backupId]);
  });

  it('conteúdo adulterado (com hash recalculado) é barrado pela verificação de integridade financeira', async () => {
    const [backup] = await backupsDe(a.id);
    const vazio = await retrato(a.id);
    // Muda o valor de uma fatura no backup (soma das parcelas + ajuste deixa de bater).
    await db.query(
      `update public.backups_dados b
          set conteudo = jsonb_set(b.conteudo, '{lancamentos}', (
                select jsonb_agg(case when l ? 'fatura_mes' and l->>'fatura_mes' = '2026-10'
                                      then jsonb_set(l, '{valor_centavos}', '999') else l end)
                  from jsonb_array_elements(b.conteudo->'lancamentos') l))
        where b.id = $1`,
      [backup.id],
    );
    await db.query(`update public.backups_dados set sha256 = encode(sha256(convert_to(conteudo::text, 'UTF8')), 'hex') where id = $1`, [backup.id]);
    const r = await restaurar(a.cliente, backup.id);
    expect(r.error?.message).toContain('integridade');
    expect(await retrato(a.id)).toEqual(vazio);
  });

  it('backup de outra versão do banco é recusado', async () => {
    const [backup] = await backupsDe(a.id);
    await db.query(`update public.backups_dados set assinatura_esquema = 'outra' where id = $1`, [backup.id]);
    expect((await restaurar(a.cliente, backup.id)).error?.message).toContain('versão anterior');
  });

  it('backup expirado é recusado', async () => {
    const [backup] = await backupsDe(a.id);
    await db.query(`update public.backups_dados set expira_em = now() - interval '1 minute' where id = $1`, [backup.id]);
    expect((await restaurar(a.cliente, backup.id)).error?.message).toContain('expirou');
  });

  it('frase de restauração errada é recusada', async () => {
    const [backup] = await backupsDe(a.id);
    expect((await restaurar(a.cliente, backup.id, 'restaurar backup')).error?.code).toBe('22023');
  });
});

// =============================================================================
describe('retenção e execução duplicada', () => {
  let a: UsuarioTeste;
  let contaId: string;

  beforeAll(async () => {
    a = await novoUsuario();
    contaId = ok(await a.cliente.from('contas_bancarias').insert({ empresa_id: a.empresaId, apelido: 'Conta', banco: 'Banco' }).select('id').single()).id;
  });

  const umMovimento = () => a.cliente.rpc('conferir_saldo', { p_conta_id: contaId, p_saldo_informado: 100 });

  it('mantém no máximo 10 backups e remove os vencidos', async () => {
    for (let i = 0; i < 11; i++) {
      ok(await umMovimento());
      ok(await limpar(a.cliente, 'financeiro'));
    }
    expect(await backupsDe(a.id)).toHaveLength(10);
    const [maisAntigo] = (await backupsDe(a.id)).slice(-1);
    await db.query(`update public.backups_dados set expira_em = now() - interval '1 day' where id = $1`, [maisAntigo.id]);
    ok(await umMovimento());
    ok(await limpar(a.cliente, 'financeiro'));
    const ids = (await backupsDe(a.id)).map((x) => x.id);
    expect(ids).not.toContain(maisAntigo.id);
    expect(ids.length).toBeLessThanOrEqual(10);
  });

  it('duas limpezas simultâneas: só uma apaga (a outra é barrada)', async () => {
    ok(await umMovimento());
    const outro = clienteAnonimo();
    ok(await outro.auth.signInWithPassword({ email: a.email, password: 'senha-integracao-123' }));
    const resultados = await Promise.all([limpar(a.cliente, 'financeiro'), limpar(outro, 'financeiro')]);
    const sucessos = resultados.filter((r) => !r.error);
    expect(sucessos).toHaveLength(1);
    const erro = resultados.find((r) => r.error)!.error!;
    expect(['55P03', '22023']).toContain(erro.code);
  });
});

// =============================================================================
describe('permissões: backups, funções internas e chamadas diretas', () => {
  let a: UsuarioTeste;
  let b: UsuarioTeste;
  let backupB: string;

  beforeAll(async () => {
    [a, b] = await Promise.all([novoUsuario(), novoUsuario()]);
    await semear(b);
    backupB = (ok(await limpar(b.cliente, 'financeiro')) as { backup_id: string }).backup_id;
    await semear(a);
  });

  it('papéis administrativos (service_role) continuam apagando e inserindo parcelas — sem acesso ao resto do schema interno', async () => {
    const c = await novoUsuario();
    const banco = await criarFornecedor(c.cliente, 'Banco Adm');
    const cat = c.categorias['Cartão de crédito'];
    const cartao = ok(await c.cliente.from('cartoes').insert({ empresa_id: c.empresaId, fornecedor_id: banco, categoria_fatura_id: cat, nome: 'Adm', dia_fechamento: 5, dia_vencimento: 12 }).select('id').single()).id;
    const compra = ok(await c.cliente.rpc('registrar_compra_cartao', {
      p_cartao_id: cartao, p_categoria_id: cat, p_descricao: 'Compra adm', p_data_compra: '2026-09-01',
      p_valor_total: 3_000, p_parcelas: 3, p_primeira_fatura_mes: '2026-10', p_observacao: null,
    }));
    const admin = clienteAdmin();
    const parcela = ok(await admin.from('parcelas_cartao').select('*').eq('compra_id', compra).eq('numero', 3).single());
    expect((await admin.from('parcelas_cartao').delete().eq('id', parcela.id)).error).toBeNull();
    expect((await admin.from('parcelas_cartao').insert(parcela)).error).toBeNull();
    expect((await admin.from('compras_cartao').delete().eq('id', compra)).error).toBeNull();
    expect(await contagens(c.id)).toMatchObject({ compras_cartao: 0, parcelas_cartao: 0 });
    // Nada além da leitura da marca: as etapas internas continuam fechadas para o service_role.
    expect((await admin.schema('nonatofin_interno' as 'public').rpc('criar_backup' as 'resumo_dados')).error).not.toBeNull();
  });

  it('visitante não executa nenhuma RPC de dados', async () => {
    const anon = clienteAnonimo();
    for (const r of [
      await anon.rpc('limpar_dados', { p_nivel: 'financeiro', p_frase: FRASE_FINANCEIRO }),
      await anon.rpc('restaurar_backup', { p_backup_id: backupB, p_frase: FRASE_RESTAURAR }),
      await anon.rpc('resumo_dados'),
      await anon.rpc('exportar_dados'),
    ]) expect(r.error).not.toBeNull();
    expect((await anon.from('backups_dados').select('id')).error).not.toBeNull();
  });

  it('usuário não autorizado é recusado', async () => {
    const intruso = await novoUsuario(false);
    expect((await limpar(intruso.cliente, 'financeiro')).error?.code).toBe('42501');
    expect((await intruso.cliente.rpc('resumo_dados')).error?.code).toBe('42501');
  });

  it('não lê, não restaura e não apaga backups de outro usuário', async () => {
    expect(ok(await a.cliente.from('backups_dados').select('id').eq('id', backupB))).toHaveLength(0);
    expect((await restaurar(a.cliente, backupB)).error?.message).toContain('não encontrado');
    expect(await backupsDe(b.id)).toHaveLength(1);
  });

  it('o próprio usuário não insere, não altera e não apaga backups pela API', async () => {
    const proprio = b.cliente;
    const ins = await proprio.from('backups_dados').insert({
      user_id: b.id, nivel: 'completo', motivo: 'limpeza', versao_formato: 1, assinatura_esquema: 'x',
      conteudo: {}, contagens: {}, sha256: '0'.repeat(64), expira_em: '2099-01-01',
    });
    expect(ins.error?.code).toBe('42501');
    const upd = await proprio.from('backups_dados').update({ expira_em: '2099-01-01', sha256: '0'.repeat(64) }).eq('id', backupB).select('id');
    expect(upd.error?.code).toBe('42501');
    const del = await proprio.from('backups_dados').delete().eq('id', backupB).select('id');
    expect(del.error?.code).toBe('42501');
    expect((await backupsDe(b.id))[0].hash_ok).toBe(true);
  });

  it('schema interno não é exposto pela API (PostgREST)', async () => {
    const interno = b.cliente.schema('nonatofin_interno' as 'public');
    const r1 = await interno.rpc('criar_backup' as 'resumo_dados');
    expect(r1.error).not.toBeNull();
    const r2 = await interno.from('restauracoes_ativas' as 'backups_dados').select('*');
    expect(r2.error).not.toBeNull();
  });

  it('GraphQL não expõe escrita em backups nem as funções internas', async () => {
    const { data } = await b.cliente.auth.getSession();
    const resposta = await fetch(`${process.env.SUPABASE_URL}/graphql/v1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.SUPABASE_PUBLISHABLE_KEY!,
        Authorization: `Bearer ${data.session!.access_token}`,
      },
      body: JSON.stringify({ query: '{ __schema { mutationType { fields { name } } queryType { fields { name } } } }' }),
    });
    const texto = await resposta.text();
    for (const proibido of ['insertIntoBackupsDados', 'updateBackupsDados', 'deleteFromBackupsDados', 'criarBackup', 'iniciarRestauracao', 'concluirRestauracao', 'apagarDados', 'restauracoesAtivas']) {
      expect(texto, proibido).not.toContain(proibido);
    }
  });

  it('chamada direta das funções internas sem passar pela operação autorizada é recusada', async () => {
    const claims = { sub: a.id, role: 'authenticated', amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }] };
    for (const sql of [
      `select nonatofin_interno.criar_backup('completo', 'limpeza')`,
      `select nonatofin_interno.apagar_dados('completo')`,
      `select nonatofin_interno.iniciar_restauracao('${backupB}')`,
      `select nonatofin_interno.concluir_restauracao('${backupB}')`,
    ]) {
      await comoUsuario(claims, async (q) => {
        await expect(q(sql)).rejects.toThrow('Operação não autorizada');
      });
    }
    await comoUsuario(claims, async (q) => {
      await expect(q(`insert into nonatofin_interno.restauracoes_ativas values ('${a.id}', pg_current_xact_id())`)).rejects.toThrow('permission denied');
    });
    await comoUsuario(claims, async (q) => {
      const { rows } = await q(`select nonatofin_interno.restauracao_em_andamento('${a.id}') v`);
      expect((rows[0] as { v: boolean }).v).toBe(false);
    });
  });

  it('sessão sem login recente por senha é recusada pelo BANCO (mesmo com a frase certa)', async () => {
    const antes = await contagens(a.id);
    const agora = Math.floor(Date.now() / 1000);
    for (const amr of [undefined, [], [{ method: 'password', timestamp: agora - 200 }], [{ method: 'otp', timestamp: agora }], ['password']]) {
      await comoUsuario({ sub: a.id, role: 'authenticated', ...(amr ? { amr } : {}) }, async (q) => {
        await expect(q(`select public.limpar_dados('completo', '${FRASE_COMPLETO}')`)).rejects.toThrow('Confirme sua senha');
      });
    }
    expect(await contagens(a.id)).toEqual(antes);
  });

  it('com login por senha agora mesmo (claims simuladas), a operação é aceita pelo banco', async () => {
    await comoUsuario({ sub: a.id, role: 'authenticated', amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }] }, async (q) => {
      const { rows } = await q(`select public.limpar_dados('financeiro', '${FRASE_FINANCEIRO}') r`);
      expect(rows[0]).toBeTruthy();
    }); // ROLLBACK: nada é mantido
  });
});

// =============================================================================
describe('reautenticação com o Supabase Auth real', () => {
  let a: UsuarioTeste;

  beforeAll(async () => {
    a = await novoUsuario();
    await semear(a);
  });

  it('o token traz amr "password" com o horário do login', async () => {
    const { data } = await a.cliente.auth.getSession();
    const amr = decodificar(data.session!.access_token).amr as { method: string; timestamp: number }[];
    const senha = amr.find((x) => x.method === 'password');
    expect(senha).toBeDefined();
    expect(Math.abs(senha!.timestamp - Date.now() / 1000)).toBeLessThan(60);
  });

  it('renovar o token NÃO atualiza o horário do login por senha', async () => {
    const { data: antes } = await a.cliente.auth.getSession();
    const t0 = (decodificar(antes.session!.access_token).amr as { method: string; timestamp: number }[]).find((x) => x.method === 'password')!.timestamp;
    await new Promise((r) => setTimeout(r, 2_000));
    const { data: depois, error } = await a.cliente.auth.refreshSession();
    expect(error).toBeNull();
    expect(depois.session!.access_token).not.toBe(antes.session!.access_token);
    const t1 = (decodificar(depois.session!.access_token).amr as { method: string; timestamp: number }[]).find((x) => x.method === 'password')!.timestamp;
    expect(t1).toBe(t0);
  });

  it('após 120 s, mesmo com token renovado, o banco recusa; nova senha libera', { timeout: 200_000 }, async () => {
    const antes = await contagens(a.id);
    await new Promise((r) => setTimeout(r, 125_000));
    ok(await a.cliente.auth.refreshSession());
    const recusado = await limpar(a.cliente, 'financeiro');
    expect(recusado.error?.code).toBe('28000');
    expect(await contagens(a.id)).toEqual(antes);

    // Reautenticação (como a Server Action faz): sessão nova, temporária.
    const temporario = clienteAnonimo();
    ok(await temporario.auth.signInWithPassword({ email: a.email, password: 'senha-integracao-123' }));
    const aceito = await limpar(temporario, 'financeiro');
    expect(aceito.error).toBeNull();
    ok(await temporario.auth.signOut({ scope: 'local' }));
  });
});
