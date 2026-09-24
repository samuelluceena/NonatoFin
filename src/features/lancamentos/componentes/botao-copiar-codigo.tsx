'use client';

import { Check, Copy, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Botao, type TamanhoBotao } from '@/components/ui/botao';
import { Dialogo } from '@/components/ui/dialogo';
import { formatarCodigo } from '@/lib/domain/codigo-barras';
import { copiarTexto } from '@/lib/utils/area-transferencia';
import { cn } from '@/lib/utils/cn';
import { DialogoCodigo } from './dialogo-codigo';

interface Props {
  lancamentoId: string;
  codigo: string | null;
  tamanho?: TamanhoBotao;
  className?: string;
}

/**
 * Botão principal do fluxo: copia SOMENTE a linha digitável (dígitos).
 * Sem código cadastrado, vira "Adicionar código".
 */
export function BotaoCopiarCodigo({ lancamentoId, codigo, tamanho = 'lg', className }: Props) {
  const [copiado, setCopiado] = useState(false);
  const [manual, setManual] = useState(false);
  const [adicionar, setAdicionar] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  if (!codigo) {
    return (
      <>
        <Botao
          variante="suave"
          tamanho={tamanho}
          larguraTotal
          className={className}
          icone={<Plus className="size-5" aria-hidden="true" />}
          onClick={() => setAdicionar(true)}
        >
          ADICIONAR CÓDIGO
        </Botao>
        <DialogoCodigo lancamentoId={lancamentoId} aberto={adicionar} onFechar={() => setAdicionar(false)} />
      </>
    );
  }

  async function copiar() {
    if (!codigo) return;
    const ok = await copiarTexto(codigo);
    if (!ok) {
      setManual(true);
      return;
    }
    setCopiado(true);
    toast.success('Código copiado!', { description: 'Cole no aplicativo do seu banco.' });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopiado(false), 2500);
  }

  return (
    <>
      <Botao
        variante="primario"
        tamanho={tamanho}
        larguraTotal
        onClick={copiar}
        className={cn('tracking-wide', copiado && '!bg-success-soft !text-success border border-success-border !shadow-none', className)}
        icone={copiado ? <Check className="size-5" aria-hidden="true" /> : <Copy className="size-5" aria-hidden="true" />}
        aria-live="polite"
        data-testid="copiar-codigo"
      >
        {copiado ? 'CÓDIGO COPIADO!' : 'COPIAR CÓDIGO'}
      </Botao>
      <Dialogo
        aberto={manual}
        onFechar={() => setManual(false)}
        titulo="Copie o código manualmente"
        descricao="Seu navegador bloqueou a cópia automática. Toque e segure o código abaixo e escolha Copiar."
      >
        <p className="mb-4 select-all break-all rounded-md border border-border bg-surface-2 p-3 font-mono text-[15px]">
          {formatarCodigo(codigo)}
        </p>
      </Dialogo>
    </>
  );
}
