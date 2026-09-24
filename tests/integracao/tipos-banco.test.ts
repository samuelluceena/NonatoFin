/**
 * Garante que src/lib/supabase/database.types.ts está em dia com o banco.
 * Se este teste falhar, uma migration mudou e os tipos não foram gerados de
 * novo: rode `npm run db:tipos` (veja docs/MANUTENCAO.md).
 */
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { afterAll, describe, expect, it } from 'vitest';
import { bancoDireto } from './auxiliares';

const db = bancoDireto();
afterAll(() => db.end());

type Membros = Map<string, ts.TypeNode>;

function membros(no: ts.TypeNode | undefined): Membros {
  const mapa: Membros = new Map();
  if (no && ts.isTypeLiteralNode(no)) {
    for (const m of no.members) {
      if (ts.isPropertySignature(m) && m.type) mapa.set(m.name.getText(), m.type);
    }
  }
  return mapa;
}

/** Lê do arquivo gerado: tabela -> colunas e função -> parâmetros. */
function lerArquivoDeTipos() {
  const caminho = 'src/lib/supabase/database.types.ts';
  const fonte = ts.createSourceFile(caminho, readFileSync(caminho, 'utf8'), ts.ScriptTarget.Latest, true);
  const alias = fonte.statements.find((s): s is ts.TypeAliasDeclaration => ts.isTypeAliasDeclaration(s) && s.name.text === 'Database');
  const publico = membros(membros(alias?.type).get('public'));
  const tabelas = new Map<string, string[]>();
  for (const [nome, tipo] of membros(publico.get('Tables'))) {
    tabelas.set(nome, [...membros(membros(tipo).get('Row')).keys()].sort());
  }
  const funcoes = new Map<string, string[]>();
  for (const [nome, tipo] of membros(publico.get('Functions'))) {
    funcoes.set(nome, [...membros(membros(tipo).get('Args')).keys()].sort());
  }
  return { tabelas, funcoes };
}

describe('tipos do banco (database.types.ts) em dia com as migrations', () => {
  const arquivo = lerArquivoDeTipos();

  it('mesmas tabelas e colunas', async () => {
    const { rows } = await db.query<{ tabela: string; colunas: string[] }>(`
      select c.table_name as tabela, array_agg(c.column_name::text order by c.column_name) as colunas
        from information_schema.columns c
        join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
       where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
       group by c.table_name`);
    const banco = new Map(rows.map((r) => [r.tabela, [...r.colunas].sort()]));
    expect([...arquivo.tabelas.keys()].sort()).toEqual([...banco.keys()].sort());
    for (const [tabela, colunas] of banco) expect(arquivo.tabelas.get(tabela), tabela).toEqual(colunas);
  });

  it('mesmas funções e parâmetros (as chamadas via RPC)', async () => {
    const { rows } = await db.query<{ funcao: string; parametros: string[] }>(`
      select p.proname as funcao,
             coalesce(array_agg(a.nome order by a.nome) filter (where a.nome is not null), '{}') as parametros
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        left join lateral unnest(p.proargnames, p.proargmodes::text[]) as a(nome, modo)
               on a.modo is null or a.modo in ('i', 'b')
       where n.nspname = 'public'
         and p.prorettype <> 'trigger'::regtype
       group by p.proname`);
    const banco = new Map(rows.map((r) => [r.funcao, [...r.parametros].sort()]));
    for (const [funcao, parametros] of banco) {
      expect(arquivo.funcoes.has(funcao), `função ${funcao} ausente no arquivo de tipos`).toBe(true);
      expect(arquivo.funcoes.get(funcao), funcao).toEqual(parametros);
    }
    for (const funcao of arquivo.funcoes.keys()) expect(banco.has(funcao), `função ${funcao} não existe mais no banco`).toBe(true);
  });
});
