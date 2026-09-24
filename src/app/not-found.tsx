import { SearchX } from 'lucide-react';
import { LinkBotao } from '@/components/ui/botao';

export default function NaoEncontrado() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
      <SearchX className="mb-4 size-10 text-fg-3" aria-hidden="true" />
      <h1 className="text-xl font-semibold text-fg">Página não encontrada</h1>
      <p className="mt-2 text-fg-2">O endereço pode estar errado ou o registro foi excluído.</p>
      <LinkBotao href="/" className="mt-6">
        Voltar ao início
      </LinkBotao>
    </main>
  );
}
