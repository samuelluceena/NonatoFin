'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Botao } from '@/components/ui/botao';
import { Campo, Entrada, ariaCampo } from '@/components/ui/campo';
import { Dialogo } from '@/components/ui/dialogo';
import { definirCodigo } from '../acoes';

/** Modal para colar o código de barras de um boleto que ainda não tem. */
export function DialogoCodigo({ lancamentoId, aberto, onFechar }: { lancamentoId: string; aberto: boolean; onFechar: () => void }) {
  const router = useRouter();
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState<string>();
  const [pendente, iniciar] = useTransition();

  function salvar() {
    if (pendente) return;
    iniciar(async () => {
      const r = await definirCodigo(lancamentoId, codigo);
      if (!r.ok) {
        setErro(r.erro);
        toast.error(r.erro);
        return;
      }
      toast.success(r.mensagem ?? 'Código salvo!');
      setCodigo('');
      setErro(undefined);
      onFechar();
      router.refresh();
    });
  }

  const id = `codigo-${lancamentoId}`;
  return (
    <Dialogo
      aberto={aberto}
      onFechar={onFechar}
      titulo="Adicionar código"
      descricao="Cole a linha digitável ou o código de barras do boleto."
      rodape={
        <>
          <Botao variante="secundario" onClick={onFechar} disabled={pendente}>
            Cancelar
          </Botao>
          <Botao onClick={salvar} carregando={pendente} textoCarregando="Salvando...">
            Salvar código
          </Botao>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
      >
        <Campo id={id} rotulo="Código de barras / linha digitável" erro={erro} dica="44, 47 ou 48 dígitos. Pontos e espaços são ignorados.">
          <Entrada
            {...ariaCampo(id, erro, true)}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            inputMode="numeric"
            autoComplete="off"
            className="font-mono"
            placeholder="00190.00009 01234.567890 ..."
          />
        </Campo>
      </form>
    </Dialogo>
  );
}
