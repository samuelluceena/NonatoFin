import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AlertTriangle, Landmark, Pencil } from 'lucide-react';
import { LinkBotao } from '@/components/ui/botao';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { Cartao } from '@/components/ui/cartao';
import { LinkVoltar } from '@/components/ui/link-voltar';
import { Valor } from '@/components/ui/valor';
import { BotaoConferir, BotaoEntrada, BotaoTransferir } from '@/features/contas/componentes/acoes-conta';
import { projetarSaldo, rotuloConta } from '@/lib/domain/saldos';
import { EntradasAConfirmar, ExtratoConta, montarExtrato } from '@/features/contas/componentes/extrato-conta';
import { PrevisaoConta } from '@/features/contas/componentes/previsao-conta';
import {
  entradasPrevistasVencidas,
  eventosPrevistosDaConta,
  listarMovimentos,
  listarPagamentosDaConta,
  listarTodasAsContas,
  obterConta,
  saldosDasContas,
} from '@/features/contas/consultas';
import { exigirUsuario } from '@/lib/auth/sessao';
import { LIMITES } from '@/lib/config';
import { adicionarDias, fimDoMes, formatarData, hojeISO } from '@/lib/domain/datas';
import { idDaRota } from '@/lib/parametros';
import { cn } from '@/lib/utils/cn';

export const metadata: Metadata = { title: 'Conta' };

const LIMITE_EXTRATO = 200;

export default async function PaginaConta({ params }: PageProps<'/contas/[id]'>) {
  const id = idDaRota((await params).id);
  const { supabase } = await exigirUsuario();
  const conta = await obterConta(supabase, id);
  if (!conta) notFound();

  const hoje = hojeISO();
  const horizonte = adicionarDias(hoje, LIMITES.diasPrevisaoSaldo);
  const [saldos, eventos, movimentos, pagamentos, vencidas, todasAsContas] = await Promise.all([
    saldosDasContas(supabase),
    eventosPrevistosDaConta(supabase, conta.id, hoje, horizonte),
    listarMovimentos(supabase, conta.id, LIMITE_EXTRATO),
    listarPagamentosDaConta(supabase, conta.id, LIMITE_EXTRATO),
    entradasPrevistasVencidas(supabase, hoje),
    listarTodasAsContas(),
  ]);

  const saldo = saldos.get(conta.id) ?? 0;
  const previsao = projetarSaldo(saldo, eventos, hoje, horizonte);
  const fimMes = fimDoMes(hoje);
  const previstoFimDoMes = projetarSaldo(saldo, eventos, hoje, fimMes).saldoFinal;
  const extrato = montarExtrato(movimentos, pagamentos, movimentos.length < LIMITE_EXTRATO);

  return (
    <div className="mx-auto max-w-3xl">
      <CabecalhoPagina
        voltar={<LinkVoltar href="/contas">Contas</LinkVoltar>}
        titulo={
          <span className="flex items-center gap-2.5">
            <Landmark className="size-6 shrink-0 text-primary-text" aria-hidden="true" />
            <span className="min-w-0 truncate">{rotuloConta(conta)}</span>
          </span>
        }
        subtitulo={
          <>
            {conta.empresa.apelido} · {conta.banco}
            {conta.padrao && ' · conta padrão'}
            {!conta.ativa && ' · inativa'}
          </>
        }
        acoes={
          <LinkBotao href={`/contas/${conta.id}/editar`} variante="secundario" icone={<Pencil className="size-4.5" aria-hidden="true" />}>
            Editar
          </LinkBotao>
        }
      />

      <Cartao className="p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-fg-3">Saldo hoje</p>
            <span data-testid="saldo-conta">
              <Valor centavos={saldo} className={cn('mt-1 block text-display leading-none font-semibold tracking-tight', saldo < 0 && 'text-danger')} />
            </span>
          </div>
          <div className="sm:text-right">
            <p className="text-sm text-fg-3">Previsto em {formatarData(fimMes)}</p>
            <span data-testid="saldo-previsto">
              <Valor centavos={previstoFimDoMes} className={cn('mt-1 block text-xl font-semibold', previstoFimDoMes < 0 && 'text-danger')} />
            </span>
          </div>
        </div>
        {previsao.primeiroNegativo && (
          <p className="mt-4 flex gap-2 rounded-md border border-danger-border bg-danger-soft p-3 text-sm font-medium text-danger" role="alert" data-testid="alerta-negativo">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              Fica negativo em {formatarData(previsao.primeiroNegativo.data)} (<Valor centavos={previsao.primeiroNegativo.saldoCentavos} />
              ). Programe uma entrada ou uma transferência.
            </span>
          </p>
        )}
        <div className="mt-5 grid grid-cols-1 gap-2 border-t border-border pt-5 sm:flex sm:flex-wrap">
          <BotaoEntrada contaId={conta.id} hoje={hoje} />
          <BotaoTransferir contas={todasAsContas} origemId={conta.id} hoje={hoje} />
          <BotaoConferir conta={conta} saldoCentavos={saldo} hoje={hoje} />
        </div>
      </Cartao>

      <EntradasAConfirmar entradas={vencidas.filter((m) => m.contaId === conta.id)} />
      <PrevisaoConta linhas={previsao.linhas} dias={LIMITES.diasPrevisaoSaldo} />
      <ExtratoConta linhas={extrato} />
    </div>
  );
}
