/**
 * Auxiliares dos testes de integração: criam usuários reais no Supabase local
 * e devolvem clientes autenticados (exatamente como o app usa).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import pg from 'pg';
import type { Database } from '@/lib/supabase/tipos-banco';

export type Cliente = SupabaseClient<Database>;

const url = () => process.env.SUPABASE_URL!;
const chavePublica = () => process.env.SUPABASE_PUBLISHABLE_KEY!;

export function clienteAdmin(): SupabaseClient {
  return createClient(url(), process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function clienteAnonimo(): Cliente {
  return createClient<Database>(url(), chavePublica(), { auth: { persistSession: false, autoRefreshToken: false } });
}

export function bancoDireto(): pg.Pool {
  return new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
}

export interface UsuarioTeste {
  id: string;
  email: string;
  cliente: Cliente;
  /** Empresa padrão criada para o usuário (vazio se não autorizado). */
  empresaId: string;
  /** Categorias padrão por nome (ex.: 'Boleto de fornecedor'). */
  categorias: Record<string, string>;
  /** Categoria "Boleto de fornecedor" (atalho). */
  categoriaId: string;
}

/** Campos obrigatórios de empresa/categoria para inserir boletos. */
export function vinculo(u: UsuarioTeste): { empresa_id: string; categoria_id: string } {
  return { empresa_id: u.empresaId, categoria_id: u.categoriaId };
}

let contador = 0;

/** Cria um usuário (autorizado ou não) e retorna um cliente logado. */
export async function criarUsuarioTeste(autorizado = true): Promise<UsuarioTeste> {
  contador += 1;
  const email = `int-${Date.now()}-${contador}-${Math.random().toString(36).slice(2, 7)}@teste.local`;
  const senha = 'senha-integracao-123';
  const admin = clienteAdmin();
  const { data, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
  if (error) throw error;
  if (autorizado) {
    const { error: e2 } = await admin.from('usuarios_autorizados').insert({ user_id: data.user.id });
    if (e2) throw e2;
  }
  const cliente = clienteAnonimo();
  const { error: e3 } = await cliente.auth.signInWithPassword({ email, password: senha });
  if (e3) throw e3;
  if (!autorizado) return { id: data.user.id, email, cliente, empresaId: '', categorias: {}, categoriaId: '' };

  const { error: e4 } = await cliente.rpc('garantir_categorias_padrao');
  if (e4) throw e4;
  const { data: cats, error: e5 } = await cliente.from('categorias').select('id, nome');
  if (e5) throw e5;
  const categorias = Object.fromEntries((cats ?? []).map((c) => [c.nome, c.id]));
  const { data: empresa, error: e6 } = await cliente
    .from('empresas')
    .insert({ apelido: 'Empresa Teste', cnpj: '11222333000181' })
    .select('id')
    .single();
  if (e6) throw e6;
  return {
    id: data.user.id,
    email,
    cliente,
    empresaId: empresa.id,
    categorias,
    categoriaId: categorias['Boleto de fornecedor'],
  };
}

export async function removerUsuario(id: string): Promise<void> {
  // on delete cascade remove fornecedores, boletos e autorização.
  const { error } = await clienteAdmin().auth.admin.deleteUser(id);
  if (error) throw new Error(`remover usuário de teste: ${error.message}`);
}

export async function criarFornecedor(cliente: Cliente, nome: string): Promise<string> {
  const { data, error } = await cliente.rpc('obter_ou_criar_fornecedor', { p_nome: nome });
  if (error) throw error;
  return data;
}
