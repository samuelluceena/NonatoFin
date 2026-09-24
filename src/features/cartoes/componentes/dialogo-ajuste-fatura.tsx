'use client';

import { SlidersHorizontal } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Botao } from '@/components/ui/botao';
import { AreaTexto, Campo } from '@/components/ui/campo';
import { CampoMoeda } from '@/components/ui/campo-moeda';
import { Dialogo } from '@/components/ui/dialogo';
import { Segmentado } from '@/components/ui/segmentado';
import { LIMITES } from '@/lib/config';
import { formatarMoeda } from '@/lib/domain/dinheiro';
import { definirAjusteFatura } from '../acoes';

interface Props {
  lancamentoId: string;
  ajusteAtual: number;
  observacaoAtual: string | null;
  somaParcelas: number;
}

type Sentido = 'acrescimo' | 'desconto';

/**
 * Ajuste manual da fatura: juros, anuidade, IOF (acréscimo) ou estorno,
 * crédito, pagamento antecipado (desconto). O valor da fatura passa a ser
 * soma das parcelas + ajuste.
 */
export function DialogoAjusteFatura({ lancamentoId, ajusteAtual, observacaoAtual, somaParcelas }: Props) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [sentido, setSentido] = useState<Sentido>(ajusteAtual < 0 ? 'desconto' : 'acrescimo');
  const [valor, setValor] = useState(Math.abs(ajusteAtual));
  const [observacao, setObservacao] = useState(observacaoAtual ?? '');
  const [salvando, setSalvando] = useState(false);
  const emAndamento = useRef(false);

  const ajuste = sentido === 'desconto' ? -valor : valor;
  const novoTotal = somaParcelas + ajuste;

  function abrir() {
    setSentido(ajusteAtual < 0 ? 'desconto' : 'acrescimo');
    setValor(Math.abs(ajusteAtual));
    setObservacao(observacaoAtual ?? '');
    setAberto(true);
  }

  async function salvar() {
    if (emAndamento.current) return;
    if (novoTotal <= 0) {
      toast.error('O valor da fatura precisa ficar maior que zero.');
      return;
    }
    emAndamento.current = true;
    setSalvando(true);
    try {
      const r = await definirAjusteFatura(lancamentoId, { ajusteCentavos: ajuste, observacao });
      if (!r.ok) {
        toast.error(r.erro);
        return;
      }
      toast.success(r.mensagem);
      setAberto(false);
      router.refresh();
    } catch {
      toast.error('Erro de conexão. Tente novamente.');
    } finally {
      emAndamento.current = false;
      setSalvando(false);
    }
  }

  return (
    <>
      <Botao variante="secundario" onClick={abrir} icone={<SlidersHorizontal className="size-4.5" aria-hidden="true" />} data-testid="ajustar-fatura">
        Ajustar valor
      </Botao>
      <Dialogo
        aberto={aberto}
        onFechar={() => setAberto(false)}
        titulo="Ajustar fatura"
        descricao="Use para juros, anuidade ou IOF (acréscimo) e para estornos ou créditos (desconto)."
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setAberto(false)} disabled={salvando}>
              Cancelar
            </Botao>
            <Botao onClick={salvar} carregando={salvando} textoCarregando="Salvando..." data-testid="salvar-ajuste">
              Salvar ajuste
            </Botao>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Segmentado
            nome="sentido-ajuste"
            rotulo="Tipo de ajuste"
            valor={sentido}
            onChange={setSentido}
            opcoes={[
              { valor: 'acrescimo', rotulo: 'Acréscimo' },
              { valor: 'desconto', rotulo: 'Desconto' },
            ]}
          />
          <Campo id="valorAjuste" rotulo="Valor do ajuste" dica="Deixe R$ 0,00 para remover o ajuste.">
            <CampoMoeda id="valorAjuste" aria-describedby="valorAjuste-dica" valor={valor} onValorChange={setValor} />
          </Campo>
          <Campo id="observacaoAjuste" rotulo="Observação" opcional>
            <AreaTexto
              id="observacaoAjuste"
              rows={2}
              maxLength={LIMITES.observacaoMax}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </Campo>
          <dl className="numeros grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded-md bg-surface-2 p-3 text-sm" data-testid="resumo-ajuste">
            <dt className="text-fg-2">Compras</dt>
            <dd className="text-right">{formatarMoeda(somaParcelas)}</dd>
            <dt className="text-fg-2">Ajuste</dt>
            <dd className="text-right">{ajuste < 0 ? `− ${formatarMoeda(-ajuste)}` : formatarMoeda(ajuste)}</dd>
            <dt className="font-medium text-fg">Total da fatura</dt>
            <dd className={novoTotal > 0 ? 'text-right font-semibold' : 'text-right font-semibold text-danger'}>{formatarMoeda(novoTotal)}</dd>
          </dl>
        </div>
      </Dialogo>
    </>
  );
}
