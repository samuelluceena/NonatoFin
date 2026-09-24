import type { Metadata } from 'next';
import { Logo } from '@/components/layout/logo';
import { SeletorTemaCompacto } from '@/components/layout/seletor-tema';
import { APP } from '@/lib/config';
import { FormularioLogin } from './formulario-login';

export const metadata: Metadata = { title: 'Entrar' };

export default async function PaginaLogin({ searchParams }: PageProps<'/login'>) {
  const params = await searchParams;
  const voltar = typeof params.voltar === 'string' ? params.voltar : '/';

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-10 pt-safe">
      <div className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4">
        <SeletorTemaCompacto />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo tamanho="lg" />
          <p className="mt-3 text-[15px] text-fg-2">Boletos, contas a pagar e planejamento financeiro.</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-md">
          <h1 className="mb-5 text-lg font-semibold">Entrar no {APP.nome}</h1>
          <FormularioLogin voltar={voltar} />
        </div>
        <p className="mt-6 text-center text-[13px] text-fg-3">
          Acesso restrito. Não há cadastro público.
        </p>
      </div>
    </main>
  );
}
