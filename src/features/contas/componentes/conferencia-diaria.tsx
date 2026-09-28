'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Botao } from '@/components/ui/botao';
import { Cartao } from '@/components/ui/cartao';
import { CampoSaldo } from '@/components/ui/campo-saldo';
import { formatarMoeda, type Centavos } from '@/lib/domain/dinheiro';
import { ajusteDaConferencia, rotuloConta } from '@/lib/domain/saldos';
import type { ContaBancaria } from '@/lib/domain/tipos';
import { conferirSaldosDoDia } from '../acoes';

interface Props {
  contas: { conta: ContaBancaria; saldoCentavos: Centavos }[];
}

/**
 * Formulário do primeiro acesso do dia: o saldo que o banco mostra para cada
 * conta. Já vem com o saldo do sistema; se o banco mostrar o mesmo valor, é
 * só confirmar. Diferenças viram ajuste (conferência com o extrato).
 */
export function ConferenciaDiaria({ contas }: Props) {
  const router = useRouter();
  const enviando = useRef(false);
  const [salvando, setSalvando] = useState(false);
  const [valores, setValores] = useState<Record<string, Centavos>>(() =>
    Object.fromEntries(contas.map((c) => [c.conta.id, c.saldoCentavos])),
  );

  async function confirmar() {
    if (enviando.current) return;
    enviando.current = true;
    setSalvando(true);
    try {
      const r = await conferirSaldosDoDia(contas.map((c) => ({ contaId: c.conta.id, saldoCentavos: valores[c.conta.id] ?? 0 })));
      if (!r.ok) {
        toast.error(r.erro);
        return;
      }
      toast.success(r.mensagem ?? 'Saldos conferidos.');
      router.replace('/');
    } catch {
      toast.error('Erro de conexão. Tente novamente.');
    } finally {
      enviando.current = false;
      setSalvando(false);
    }
  }

  const porEmpresa = [...new Set(contas.map((c) => c.conta.empresa.apelido))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void confirmar();
      }}
      className="flex flex-col gap-5"
      data-testid="conferencia-diaria"
    >
      {porEmpresa.map((empresa) => (
        <section key={empresa} aria-label={empresa}>
          <h2 className="mb-2 px-1 text-sm font-medium text-fg-2">{empresa}</h2>
          <Cartao className="divide-y divide-border">
            {contas
              .filter((c) => c.conta.empresa.apelido === empresa)
              .map(({ conta, saldoCentavos }) => {
                const id = `saldo-${conta.id}`;
                const ajuste = ajusteDaConferencia(saldoCentavos, valores[conta.id] ?? 0);
                return (
                  <div key={conta.id} className="flex flex-col gap-2 p-4" data-testid="conta-a-conferir">
                    <div className="flex items-baseline justify-between gap-3">
                      <label htmlFor={id} className="min-w-0 truncate font-medium text-fg">
                        {rotuloConta(conta)}
                      </label>
                      <span className="numeros shrink-0 text-meta text-fg-3">sistema: {formatarMoeda(saldoCentavos)}</span>
                    </div>
                    <CampoSaldo id={id} valor={valores[conta.id] ?? 0} onChange={(v) => setValores((atual) => ({ ...atual, [conta.id]: v }))} />
                    <p className={ajuste === 0 ? 'text-meta text-success' : 'text-meta text-fg-2'}>
                      {ajuste === 0 ? 'Igual ao sistema' : `Ajuste de ${ajuste > 0 ? '+' : '−'} ${formatarMoeda(Math.abs(ajuste))}`}
                    </p>
                  </div>
                );
              })}
          </Cartao>
        </section>
      ))}
      <Botao type="submit" tamanho="lg" larguraTotal carregando={salvando} textoCarregando="Salvando..." data-testid="confirmar-saldos">
        Confirmar saldos
      </Botao>
    </form>
  );
}
