'use client';

/**
 * "Por qual conta foi pago?" — um único diálogo montado no layout do app,
 * aberto por qualquer botão de pagamento com `pedirContaDoPagamento()`.
 * Fica no layout (e não no cartão) porque o cartão pode sumir da lista
 * logo depois do pagamento.
 */
import { useRouter } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { ArrowLeftRight } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Dialogo } from '@/components/ui/dialogo';
import type { ContaResumida } from '@/lib/domain/tipos';
import { contasParaPagamento } from '@/features/contas/acoes';
import { rotuloConta } from '@/lib/domain/saldos';
import { definirPagamento } from '../acoes';

interface Pedido {
  lancamentoId: string;
  /** 'pagar' = ainda não pago; 'trocar' = já pago, corrigir a conta. */
  modo: 'pagar' | 'trocar';
  contas: ContaResumida[];
  contaSugeridaId: string;
}

let pedidoAtual: Pedido | null = null;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());
const assinar = (f: () => void) => {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
};

/** Contas ativas da empresa (vazio se não houver ou der erro). */
export async function buscarContasDaEmpresa(empresaId: string): Promise<ContaResumida[]> {
  const r = await contasParaPagamento(empresaId);
  return r.ok ? r.dados : [];
}

/** Abre o diálogo. `contaSugeridaId`: a prevista (ou a primeira, que é a padrão). */
export function pedirContaDoPagamento(p: Omit<Pedido, 'contaSugeridaId'> & { contaSugeridaId?: string | null }) {
  pedidoAtual = { ...p, contaSugeridaId: p.contaSugeridaId || p.contas[0]?.id || '' };
  avisar();
}

function fechar() {
  pedidoAtual = null;
  avisar();
}

export function DialogoContaDoPagamento() {
  const pedido = useSyncExternalStore(assinar, () => pedidoAtual, () => null);
  return pedido ? <Conteudo key={`${pedido.lancamentoId}-${pedido.modo}`} pedido={pedido} /> : null;
}

function Conteudo({ pedido }: { pedido: Pedido }) {
  const router = useRouter();
  const [contaId, setContaId] = useState(pedido.contaSugeridaId);
  const [salvando, setSalvando] = useState(false);

  async function confirmar() {
    setSalvando(true);
    try {
      const r = await definirPagamento(pedido.lancamentoId, true, contaId || undefined);
      if (!r.ok) {
        toast.error(r.erro);
        return;
      }
      const conta = pedido.contas.find((c) => c.id === contaId);
      toast.success(pedido.modo === 'trocar' ? 'Conta do pagamento alterada.' : conta ? `Pago pela conta ${conta.apelido}.` : r.mensagem);
      fechar();
      router.refresh();
    } catch {
      toast.error('Erro de conexão. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  const opcoes = [
    ...pedido.contas.map((c) => ({ valor: c.id, rotulo: rotuloConta(c) })),
    ...(pedido.modo === 'pagar' ? [{ valor: '', rotulo: 'Não informar' }] : []),
  ];

  return (
    <Dialogo
      aberto
      onFechar={fechar}
      titulo={pedido.modo === 'trocar' ? 'Trocar a conta do pagamento' : 'Por qual conta foi pago?'}
      descricao="O valor sai do saldo da conta escolhida."
      rodape={
        <>
          <Botao variante="secundario" onClick={fechar} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao onClick={confirmar} carregando={salvando} textoCarregando="Salvando..." data-testid="confirmar-conta-pagamento">
            {pedido.modo === 'trocar' ? 'Salvar' : 'Confirmar pagamento'}
          </Botao>
        </>
      }
    >
      <div className="flex flex-col gap-2" role="radiogroup" aria-label="Conta do pagamento">
        {opcoes.map((o) => (
          <label
            key={o.valor || 'nenhuma'}
            className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border border-border px-3.5 has-[:checked]:border-primary has-[:checked]:bg-primary-soft"
          >
            <input
              type="radio"
              name="conta-pagamento"
              value={o.valor}
              checked={contaId === o.valor}
              onChange={() => setContaId(o.valor)}
              className="size-4.5 accent-[var(--primary)]"
            />
            <span className="text-[15px] text-fg">{o.rotulo}</span>
          </label>
        ))}
      </div>
    </Dialogo>
  );
}

/** Botão "Trocar" ao lado da conta de um lançamento já pago (detalhe). */
export function BotaoTrocarContaDoPagamento({ lancamentoId, empresaId, contaId }: { lancamentoId: string; empresaId: string; contaId: string | null }) {
  const [abrindo, setAbrindo] = useState(false);
  return (
    <Botao
      variante="fantasma"
      tamanho="sm"
      carregando={abrindo}
      icone={<ArrowLeftRight className="size-4" aria-hidden="true" />}
      onClick={async () => {
        setAbrindo(true);
        const contas = await buscarContasDaEmpresa(empresaId);
        setAbrindo(false);
        if (contas.length === 0) {
          toast.error('Esta empresa não tem conta bancária cadastrada.');
          return;
        }
        pedirContaDoPagamento({ lancamentoId, modo: 'trocar', contas, contaSugeridaId: contaId });
      }}
      data-testid="trocar-conta-pagamento"
    >
      Trocar
    </Botao>
  );
}
