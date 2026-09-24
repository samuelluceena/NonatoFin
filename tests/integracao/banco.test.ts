/**
 * Estrutura do banco: constraints, normalização de fornecedores, gatilhos e
 * a equivalência entre a regra de datas do TypeScript e a do Postgres.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adicionarMeses } from '@/lib/domain/datas';
import { bancoDireto, criarFornecedor, criarUsuarioTeste, removerUsuario, vinculo, type UsuarioTeste } from './auxiliares';

let u: UsuarioTeste;
let fornecedor: string;
const db = bancoDireto();

beforeAll(async () => {
  u = await criarUsuarioTeste();
  fornecedor = await criarFornecedor(u.cliente, 'Via da Moda');
});

afterAll(async () => {
  await removerUsuario(u.id);
  await db.end();
});

const lancamentoBase = () => ({ ...vinculo(u), fornecedor_id: fornecedor, descricao: 'Teste', valor_centavos: 1000, vencimento: '2026-10-10' });

describe('fornecedores sem duplicidade', () => {
  it('"Via da Moda", "via da moda", "VIA DA MODA" e "  vía  da  moda " são o mesmo', async () => {
    const ids = await Promise.all(
      ['via da moda', 'VIA DA MODA', '  Vía  da  Moda '].map((n) => criarFornecedor(u.cliente, n)),
    );
    expect(new Set([fornecedor, ...ids]).size).toBe(1);
    const { data } = await u.cliente.from('fornecedores').select('nome');
    expect(data).toEqual([{ nome: 'Via da Moda' }]); // mantém a grafia original
  });

  it('insert direto duplicado é rejeitado pela constraint única', async () => {
    const r = await u.cliente.from('fornecedores').insert({ nome: 'VIA DA MODA' });
    expect(r.error?.code).toBe('23505');
  });

  it('nome vazio é rejeitado', async () => {
    const r = await u.cliente.rpc('obter_ou_criar_fornecedor', { p_nome: '   ' });
    expect(r.error).not.toBeNull();
  });

  it('não exclui fornecedor com boletos (FK restrict)', async () => {
    const f = await criarFornecedor(u.cliente, 'Com Boleto');
    await u.cliente.from('lancamentos').insert({ ...lancamentoBase(), fornecedor_id: f });
    const r = await u.cliente.from('fornecedores').delete().eq('id', f);
    expect(r.error?.code).toBe('23503');
  });
});

describe('constraints de boletos', () => {
  it.each([
    ['valor zero', { valor_centavos: 0 }],
    ['valor negativo', { valor_centavos: -1 }],
    ['código com tamanho inválido', { codigo_barras: '123' }],
    ['código com letras', { codigo_barras: 'a'.repeat(47) }],
    ['status inválido', { status: 'atrasado' }],
    ['pago sem pago_em', { status: 'pago' }],
    ['pendente com pago_em', { pago_em: new Date().toISOString() }],
    ['parcela sem série', { parcela: 1, total_parcelas: 5 }],
    ['parcela maior que o total', { serie_id: crypto.randomUUID(), parcela: 6, total_parcelas: 5 }],
    ['descrição vazia', { descricao: '   ' }],
  ])('rejeita %s', async (_nome, extra) => {
    const r = await u.cliente.from('lancamentos').insert({ ...lancamentoBase(), ...extra } as never);
    expect(r.error?.code).toBe('23514');
  });

  it('aceita códigos de 44, 47 e 48 dígitos', async () => {
    for (const tamanho of [44, 47, 48]) {
      const r = await u.cliente.from('lancamentos').insert({ ...lancamentoBase(), codigo_barras: '1'.repeat(tamanho) });
      expect(r.error).toBeNull();
    }
  });

  it('valores grandes não perdem precisão (bigint em centavos)', async () => {
    const { data } = await u.cliente
      .from('lancamentos')
      .insert({ ...lancamentoBase(), valor_centavos: 99_999_999_999 })
      .select('valor_centavos')
      .single();
    expect(data?.valor_centavos).toBe(99_999_999_999);
  });

  it('vencimento é DATA: 15/08/2026 volta como 2026-08-15 (sem fuso)', async () => {
    const { data } = await u.cliente
      .from('lancamentos')
      .insert({ ...lancamentoBase(), vencimento: '2026-08-15' })
      .select('vencimento')
      .single();
    expect(data?.vencimento).toBe('2026-08-15');
  });

  it('updated_at é atualizado automaticamente', async () => {
    const { data } = await u.cliente.from('lancamentos').insert(lancamentoBase()).select('id, updated_at').single();
    await new Promise((r) => setTimeout(r, 20));
    const { data: depois } = await u.cliente
      .from('lancamentos')
      .update({ descricao: 'Alterado' })
      .eq('id', data!.id)
      .select('updated_at')
      .single();
    expect(new Date(depois!.updated_at).getTime()).toBeGreaterThan(new Date(data!.updated_at).getTime());
  });
});

describe('regra de datas: TypeScript === Postgres', () => {
  it('adicionarMeses (TS) coincide com date + make_interval (SQL) em centenas de casos', async () => {
    const bases = ['2027-01-31', '2027-01-30', '2027-01-29', '2028-01-31', '2026-10-31', '2026-11-09', '2026-12-28', '2028-02-29', '2027-03-31'];
    const casos: [string, number][] = [];
    for (const base of bases) for (let m = -14; m <= 26; m++) casos.push([base, m]);

    const { rows } = await db.query<{ base: string; meses: number; resultado: string }>(
      `select c.base, c.meses, to_char((c.base::date + make_interval(months => c.meses))::date, 'YYYY-MM-DD') as resultado
         from unnest($1::text[], $2::int[]) as c(base, meses)`,
      [casos.map((c) => c[0]), casos.map((c) => c[1])],
    );
    expect(rows).toHaveLength(casos.length);
    for (const r of rows) expect(r.resultado).toBe(adicionarMeses(r.base, r.meses));
  });
});
