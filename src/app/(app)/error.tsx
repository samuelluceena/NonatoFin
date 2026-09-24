'use client';

import { AlertTriangle, RotateCw } from 'lucide-react';
import { Botao, LinkBotao } from '@/components/ui/botao';

/**
 * Erro inesperado numa página. Mostra mensagem compreensível, sem stack
 * trace. Em produção o Next.js já oculta detalhes internos do servidor.
 */
export default function ErroPagina({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const mensagemSegura =
    error.name === 'ErroConsulta' || /conexão|sessão|permissão|encontrado/i.test(error.message)
      ? error.message
      : 'Algo deu errado ao carregar esta página.';

  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
      <div className="mb-4 grid size-14 place-items-center rounded-full bg-danger-soft text-danger">
        <AlertTriangle className="size-7" aria-hidden="true" />
      </div>
      <h1 className="text-xl font-semibold text-fg">Não foi possível carregar</h1>
      <p className="mt-2 text-fg-2" role="alert">
        {mensagemSegura}
      </p>
      {error.digest && <p className="mt-2 text-[13px] text-fg-3">Código do erro: {error.digest}</p>}
      <div className="mt-6 flex gap-2">
        <Botao onClick={() => retry()} icone={<RotateCw className="size-4.5" aria-hidden="true" />}>
          Tentar novamente
        </Botao>
        <LinkBotao href="/" variante="secundario">
          Início
        </LinkBotao>
      </div>
    </div>
  );
}
