'use client';

import { useActionState } from 'react';
import { LogIn } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Campo, Entrada } from '@/components/ui/campo';
import { entrar, type EstadoLogin } from '@/features/auth/acoes';

export function FormularioLogin({ voltar }: { voltar: string }) {
  const [estado, acao, pendente] = useActionState<EstadoLogin, FormData>(entrar, {});

  return (
    <form action={acao} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="voltar" value={voltar} />
      <Campo id="email" rotulo="E-mail">
        <Entrada
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          required
          defaultValue={estado.email}
          autoCapitalize="none"
          spellCheck={false}
        />
      </Campo>
      <Campo id="senha" rotulo="Senha">
        <Entrada id="senha" name="senha" type="password" autoComplete="current-password" required />
      </Campo>
      {estado.erro && (
        <p role="alert" className="rounded-md border border-danger-border bg-danger-soft px-3 py-2.5 text-sm text-danger">
          {estado.erro}
        </p>
      )}
      <Botao type="submit" tamanho="lg" larguraTotal carregando={pendente} textoCarregando="Entrando..." icone={<LogIn className="size-5" aria-hidden="true" />}>
        Entrar
      </Botao>
    </form>
  );
}
