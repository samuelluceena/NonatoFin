'use client';

import { CheckCircle2, Undo2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useTransition } from 'react';
import { toast } from 'sonner';
import { Botao, type TamanhoBotao } from '@/components/ui/botao';
import type { ContaResumida } from '@/lib/domain/tipos';
import { definirPagamento } from '../acoes';
import { buscarContasDaEmpresa, pedirContaDoPagamento } from './conta-do-pagamento';

interface Props {
  lancamentoId: string;
  pago: boolean;
  empresaId: string;
  /** Conta prevista (pendente) ou a que pagou (pago). */
  conta: ContaResumida | null;
  tamanho?: TamanhoBotao;
  className?: string;
}

/**
 * Marcar como pago / desfazer pagamento, com proteção contra toque duplo.
 * Com conta prevista: paga em um toque (o aviso oferece "Trocar conta").
 * Sem conta prevista e com contas na empresa: pergunta por qual conta pagou.
 */
export function BotaoPagamento({ lancamentoId, pago, empresaId, conta, tamanho = 'md', className }: Props) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const emAndamento = useRef(false);

  function alterar(novoPago: boolean) {
    if (emAndamento.current) return;
    emAndamento.current = true;
    iniciar(async () => {
      try {
        if (novoPago && !conta) {
          const contas = await buscarContasDaEmpresa(empresaId);
          if (contas.length > 0) {
            pedirContaDoPagamento({ lancamentoId, modo: 'pagar', contas });
            return;
          }
        }
        const r = await definirPagamento(lancamentoId, novoPago);
        if (!r.ok) {
          toast.error(r.erro);
          return;
        }
        toast.success(novoPago && conta ? `Pago pela conta ${conta.apelido}.` : r.mensagem, {
          cancel:
            novoPago && conta
              ? {
                  label: 'Trocar conta',
                  onClick: async () => {
                    const contas = await buscarContasDaEmpresa(empresaId);
                    pedirContaDoPagamento({ lancamentoId, modo: 'trocar', contas, contaSugeridaId: conta.id });
                  },
                }
              : undefined,
          action: novoPago
            ? {
                label: 'Desfazer',
                onClick: async () => {
                  const d = await definirPagamento(lancamentoId, false);
                  if (d.ok) toast.success(d.mensagem);
                  else toast.error(d.erro);
                  router.refresh();
                },
              }
            : undefined,
        });
        router.refresh();
      } finally {
        emAndamento.current = false;
      }
    });
  }

  if (pago) {
    return (
      <Botao
        variante="secundario"
        tamanho={tamanho}
        className={className}
        onClick={() => alterar(false)}
        carregando={pendente}
        textoCarregando="Salvando..."
        icone={<Undo2 className="size-4.5" aria-hidden="true" />}
        data-testid="desfazer-pagamento"
      >
        Desfazer pagamento
      </Botao>
    );
  }

  return (
    <Botao
      variante="secundario"
      tamanho={tamanho}
      className={className}
      onClick={() => alterar(true)}
      carregando={pendente}
      textoCarregando="Salvando..."
      icone={<CheckCircle2 className="size-4.5 text-success" aria-hidden="true" />}
      data-testid="marcar-pago"
    >
      Marcar como pago
    </Botao>
  );
}
