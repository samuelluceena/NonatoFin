/**
 * Segurança no BANCO (não depende do frontend): RLS, policies, cadastro
 * público, IDOR e tabela de autorização.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  clienteAnonimo,
  criarFornecedor,
  criarUsuarioTeste,
  vinculo,
  removerUsuario,
  type UsuarioTeste,
} from './auxiliares';

let dono: UsuarioTeste;
let intruso: UsuarioTeste; // autenticado e autorizado, mas outra conta
let naoAutorizado: UsuarioTeste; // autenticado, fora da lista de autorizados
let fornecedorDono: string;
let lancamentoDono: string;

beforeAll(async () => {
  [dono, intruso, naoAutorizado] = await Promise.all([
    criarUsuarioTeste(true),
    criarUsuarioTeste(true),
    criarUsuarioTeste(false),
  ]);
  fornecedorDono = await criarFornecedor(dono.cliente, 'Fornecedor Secreto');
  const { data, error } = await dono.cliente
    .from('lancamentos')
    .insert({ ...vinculo(dono), fornecedor_id: fornecedorDono, descricao: 'Boleto secreto', valor_centavos: 12345, vencimento: '2026-10-10' })
    .select('id')
    .single();
  if (error) throw error;
  lancamentoDono = data.id;
});

afterAll(async () => {
  await Promise.all([dono, intruso, naoAutorizado].filter(Boolean).map((u) => removerUsuario(u.id)));
});

describe('visitante NÃO autenticado', () => {
  it('não lê boletos nem fornecedores', async () => {
    const anon = clienteAnonimo();
    const lancamentos = await anon.from('lancamentos').select('*');
    const fornecedores = await anon.from('fornecedores').select('*');
    expect(lancamentos.error?.code).toBe('42501');
    expect(fornecedores.error?.code).toBe('42501');
  });

  it('não insere dados', async () => {
    const r = await clienteAnonimo().from('fornecedores').insert({ nome: 'Hacker' });
    expect(r.error).not.toBeNull();
  });

  it('não executa funções (RPC)', async () => {
    const anon = clienteAnonimo();
    for (const r of [
      await anon.rpc('obter_ou_criar_fornecedor', { p_nome: 'X' }),
      await anon.rpc('definir_pagamento', { p_id: lancamentoDono, p_pago: true }),
      await anon.rpc('excluir_lancamento', { p_id: lancamentoDono, p_escopo: 'todos' }),
      await anon.rpc('usuario_autorizado'),
    ]) {
      expect(r.error).not.toBeNull();
    }
  });

  it('cadastro público está desativado', async () => {
    const { data, error } = await clienteAnonimo().auth.signUp({
      email: `publico-${Date.now()}@teste.local`,
      password: 'senha-qualquer-123',
    });
    expect(error).not.toBeNull();
    expect(data.user).toBeNull();
  });
});

describe('usuário autenticado mas NÃO autorizado', () => {
  it('é identificado como não autorizado', async () => {
    const { data } = await naoAutorizado.cliente.rpc('usuario_autorizado');
    expect(data).toBe(false);
    const { data: ok } = await dono.cliente.rpc('usuario_autorizado');
    expect(ok).toBe(true);
  });

  it('não vê nenhum dado e não consegue gravar', async () => {
    const { data } = await naoAutorizado.cliente.from('lancamentos').select('id');
    expect(data).toEqual([]);
    const r = await naoAutorizado.cliente.rpc('obter_ou_criar_fornecedor', { p_nome: 'Tentativa' });
    expect(r.error?.code).toBe('42501');
  });

  it('não consegue se autoincluir na lista de autorizados', async () => {
    const r = await naoAutorizado.cliente
      .from('usuarios_autorizados' as 'lancamentos')
      .insert({ user_id: naoAutorizado.id } as never);
    expect(r.error).not.toBeNull();
    const { data } = await naoAutorizado.cliente.rpc('usuario_autorizado');
    expect(data).toBe(false);
  });
});

describe('isolamento entre contas (IDOR)', () => {
  it('outro usuário não vê os boletos/fornecedores do dono', async () => {
    const b = await intruso.cliente.from('lancamentos').select('id').eq('id', lancamentoDono);
    const f = await intruso.cliente.from('fornecedores').select('id').eq('id', fornecedorDono);
    expect(b.data).toEqual([]);
    expect(f.data).toEqual([]);
  });

  it('não altera, paga ou exclui boleto do dono (nem via RPC)', async () => {
    const upd = await intruso.cliente.from('lancamentos').update({ descricao: 'invadido' }).eq('id', lancamentoDono).select('id');
    expect(upd.data).toEqual([]);
    const pag = await intruso.cliente.rpc('definir_pagamento', { p_id: lancamentoDono, p_pago: true });
    expect(pag.error?.code).toBe('P0002');
    const exc = await intruso.cliente.rpc('excluir_lancamento', { p_id: lancamentoDono, p_escopo: 'todos' });
    expect(exc.error?.code).toBe('P0002');
    const del = await intruso.cliente.from('lancamentos').delete().eq('id', lancamentoDono).select('id');
    expect(del.data).toEqual([]);

    const { data } = await dono.cliente.from('lancamentos').select('descricao, status').eq('id', lancamentoDono).single();
    expect(data).toEqual({ descricao: 'Boleto secreto', status: 'pendente' });
  });

  it('não cria boleto usando fornecedor de outra conta (FK composta)', async () => {
    const r = await intruso.cliente
      .from('lancamentos')
      .insert({ ...vinculo(intruso), fornecedor_id: fornecedorDono, descricao: 'x', valor_centavos: 100, vencimento: '2026-10-10' });
    expect(r.error).not.toBeNull();
  });

  it('não grava registro em nome de outro usuário (user_id forjado)', async () => {
    const r = await intruso.cliente.from('fornecedores').insert({ nome: 'Forjado', user_id: dono.id });
    expect(r.error?.code).toBe('42501');
  });

  it('não transfere seu registro para outra conta', async () => {
    const meu = await criarFornecedor(intruso.cliente, 'Meu Fornecedor');
    const r = await intruso.cliente.from('fornecedores').update({ user_id: dono.id } as never).eq('id', meu);
    expect(r.error).not.toBeNull();
  });
});
