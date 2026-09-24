'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { destinoSeguro } from '@/lib/auth/sessao';
import { criarClienteServidor } from '@/lib/supabase/server';
import { mensagemDeErro } from '@/lib/acoes/erros';

export interface EstadoLogin {
  erro?: string;
  email?: string;
}

const esquemaLogin = z.object({
  email: z.email('Informe um e-mail válido.').trim().toLowerCase(),
  senha: z.string().min(1, 'Informe a senha.').max(200),
});

/** Login com e-mail e senha. Não existe cadastro público no NonatoFin. */
export async function entrar(_anterior: EstadoLogin, formData: FormData): Promise<EstadoLogin> {
  const email = String(formData.get('email') ?? '');
  const validacao = esquemaLogin.safeParse({ email, senha: formData.get('senha') });
  if (!validacao.success) {
    return { erro: validacao.error.issues[0]?.message ?? 'Dados inválidos.', email };
  }

  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({
    email: validacao.data.email,
    password: validacao.data.senha,
  });

  if (error) {
    // Mensagem genérica: não revela se o e-mail existe.
    if (error.status === 400 || error.code === 'invalid_credentials') {
      return { erro: 'E-mail ou senha incorretos.', email };
    }
    if (error.status === 429) {
      return { erro: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.', email };
    }
    return { erro: mensagemDeErro(error, 'login'), email };
  }

  // Defesa em profundidade: só usuários da lista de autorizados entram.
  const { data: autorizado, error: erroAutorizacao } = await supabase.rpc('usuario_autorizado');
  if (erroAutorizacao || autorizado !== true) {
    await supabase.auth.signOut({ scope: 'local' });
    return { erro: 'Este usuário não tem autorização para acessar o NonatoFin.', email };
  }

  redirect(destinoSeguro(formData.get('voltar')));
}

export async function sair(): Promise<void> {
  const supabase = await criarClienteServidor();
  // 'local': encerra somente a sessão deste aparelho.
  await supabase.auth.signOut({ scope: 'local' });
  redirect('/login');
}
