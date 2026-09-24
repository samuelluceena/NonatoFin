import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Logo } from '@/components/layout/logo';
import { Botao } from '@/components/ui/botao';
import { Cartao } from '@/components/ui/cartao';
import { Valor } from '@/components/ui/valor';
import { sair } from '@/features/auth/acoes';
import { ConferenciaDiaria } from '@/features/contas/componentes/conferencia-diaria';
import { contasAConferirHoje, listarContas, saldosDasContas } from '@/features/contas/consultas';
import { BotaoPagamento } from '@/features/lancamentos/componentes/botao-pagamento';
import { DialogoContaDoPagamento } from '@/features/lancamentos/componentes/conta-do-pagamento';
import { listarLancamentos } from '@/features/lancamentos/consultas';
import { exigirUsuario } from '@/lib/auth/sessao';
import { formatarData, hojeISO, nomeDiaDaSemana } from '@/lib/domain/datas';

export const metadata: Metadata = { title: 'Conferir saldos' };

/**
 * Primeiro acesso do dia: confirmar o saldo de cada conta ativa antes de usar
 * o app (obrigatório). Fica fora do grupo (app) para não cair no próprio bloqueio.
 */
export default async function PaginaConferirSaldos() {
  const { supabase } = await exigirUsuario();
  const aConferir = await contasAConferirHoje();
  if (aConferir.length === 0) redirect('/');

  const hoje = hojeISO();
  const [contas, saldos, { lancamentos: vencidos }] = await Promise.all([
    listarContas(supabase, { somenteAtivas: true }),
    saldosDasContas(supabase),
    listarLancamentos(supabase, { criterio: { vencimentoAte: hoje, status: 'pendente', ordem: 'asc' }, limite: 100 }),
  ]);
  const pendentes = contas.filter((c) => aConferir.includes(c.id)).map((conta) => ({ conta, saldoCentavos: saldos.get(conta.id) ?? 0 }));
  // Muda quando um pagamento altera algum saldo: recria o formulário com os valores novos.
  const chave = pendentes.map((p) => `${p.conta.id}:${p.saldoCentavos}`).join('|');

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pt-5 pb-10">
      <header className="mb-6 flex items-center justify-between">
        <Logo />
        <form action={sair}>
          <Botao type="submit" variante="fantasma" tamanho="sm" icone={<LogOut className="size-4" aria-hidden="true" />}>
            Sair
          </Botao>
        </form>
      </header>

      <h1 className="text-2xl font-semibold tracking-tight text-fg">Confira os saldos de hoje</h1>
      <p className="mt-1 text-[15px] text-fg-2 first-letter:uppercase">
        {nomeDiaDaSemana(hoje)}, {formatarData(hoje)}. Digite o saldo que o app de cada banco mostra agora.
      </p>

      {vencidos.length > 0 && (
        <section aria-labelledby="titulo-ja-pagou" className="mt-6">
          <h2 id="titulo-ja-pagou" className="text-[15px] font-semibold text-fg">
            1. Antes: alguma destas já foi paga?
          </h2>
          <p className="mb-3 text-[13px] text-fg-3">
            Marque como pago o que já saiu do banco. Assim o saldo do sistema desconta o pagamento e não sobra ajuste à toa.
          </p>
          <Cartao className="divide-y divide-border" data-testid="vencidos-para-pagar">
            {vencidos.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center gap-3 p-3.5">
                <span className="min-w-48 flex-1">
                  <span className="block truncate text-[15px] text-fg">{l.fornecedor.nome}</span>
                  <span className="numeros block truncate text-[13px] text-fg-3">
                    {formatarData(l.vencimento)} · <Valor centavos={l.valorCentavos} />
                    {l.conta ? ` · ${l.conta.apelido}` : ' · sem conta'}
                  </span>
                </span>
                <BotaoPagamento lancamentoId={l.id} empresaId={l.empresa.id} conta={l.conta} pago={false} tamanho="sm" />
              </div>
            ))}
          </Cartao>
        </section>
      )}

      <section aria-labelledby="titulo-saldos" className="mt-6">
        <h2 id="titulo-saldos" className="mb-3 text-[15px] font-semibold text-fg">
          {vencidos.length > 0 ? '2. Saldo de cada conta' : 'Saldo de cada conta'}
        </h2>
        <ConferenciaDiaria key={chave} contas={pendentes} />
      </section>
      <DialogoContaDoPagamento />
    </div>
  );
}
