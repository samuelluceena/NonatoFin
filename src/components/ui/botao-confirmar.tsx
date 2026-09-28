'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { ResultadoAcao } from '@/lib/acoes/resultado';
import { Botao, type TamanhoBotao, type VarianteBotao } from './botao';
import { Dialogo } from './dialogo';

interface Props {
  /** Texto do botão que abre a confirmação. */
  rotulo: ReactNode;
  titulo: string;
  descricao: ReactNode;
  /** Server Action já com os argumentos (ex.: `excluirConta.bind(null, id)`). */
  acao: () => Promise<ResultadoAcao<unknown>>;
  /** Para onde ir depois; sem destino, a página atual é atualizada. */
  destino?: string;
  textoConfirmar?: string;
  perigo?: boolean;
  variante?: VarianteBotao;
  tamanho?: TamanhoBotao;
  icone?: ReactNode;
  testId?: string;
}

/** Botão que pede confirmação e executa uma Server Action (excluir, confirmar...). */
export function BotaoConfirmar({
  rotulo,
  titulo,
  descricao,
  acao,
  destino,
  textoConfirmar = 'Confirmar',
  perigo = false,
  variante = 'secundario',
  tamanho,
  icone,
  testId,
}: Props) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [executando, setExecutando] = useState(false);
  const emAndamento = useRef(false);

  async function confirmar() {
    if (emAndamento.current) return;
    emAndamento.current = true;
    setExecutando(true);
    try {
      const r = await acao();
      if (!r.ok) {
        toast.error(r.erro);
        return;
      }
      toast.success(r.mensagem ?? 'Concluído.');
      setAberto(false);
      if (destino) router.push(destino);
      else router.refresh();
    } catch {
      toast.error('Erro de conexão. Tente novamente.');
    } finally {
      emAndamento.current = false;
      setExecutando(false);
    }
  }

  return (
    <>
      <Botao variante={variante} tamanho={tamanho} onClick={() => setAberto(true)} icone={icone} data-testid={testId}>
        {rotulo}
      </Botao>
      <Dialogo
        aberto={aberto}
        onFechar={() => setAberto(false)}
        titulo={titulo}
        alerta={perigo ? 'perigo' : undefined}
        descricao={descricao}
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setAberto(false)} disabled={executando}>
              Cancelar
            </Botao>
            <Botao
              variante={perigo ? 'perigo' : 'primario'}
              onClick={confirmar}
              carregando={executando}
              textoCarregando="Aguarde..."
              data-testid={testId ? `${testId}-confirmar` : undefined}
            >
              {textoConfirmar}
            </Botao>
          </>
        }
      />
    </>
  );
}
