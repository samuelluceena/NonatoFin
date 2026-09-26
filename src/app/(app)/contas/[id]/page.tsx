import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AlertTriangle, Pencil } from 'lucide-react';
import { LinkBotao } from '@/components/ui/botao';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { LinkVoltar } from '@/components/ui/link-voltar';
import { Selo } from '@/components/ui/selo';
import { Valor } from '@/components/ui/valor';
import { BotaoConferir, BotaoEntrada, BotaoTransferir } from '@/features/contas/componentes/acoes-conta';
import { DadosConta } from '@/features/contas/componentes/dados-conta';
import { EntradasAConfirmar, ExtratoConta, montarExtrato } from '@/features/contas/componentes/extrato-conta';
import { GraficoPrevisao } from '@/features/contas/componentes/grafico-previsao';
import { PrevisaoConta } from '@/features/contas/componentes/previsao-conta';
import { SaldoDestaque } from '@/features/contas/componentes/saldo-destaque';
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
import { projetarSaldo } from '@/lib/domain/saldos';
import { idDaRota } from '@/lib/parametros';
import { cn } from '@/lib/utils/cn';

export const metadata: Metadata = { title: 'Conta' };

const LIMITE_EXTRATO = 200;

/** Ações do cartão de saldo: lista no celular, barra discreta a partir de sm. */
const CLASSE_ACAO = 'w-full justify-start sm:w-auto';

/**
 * Detalhe da conta em níveis: 1. saldo hoje (principal), previsto no fim do
 * mês, alerta de negativo e o gráfico da previsão; 2. dados da conta;
 * 3. entradas a confirmar, próximos dias e extrato.
 * Só apresentação: previsão e alerta vêm de projetarSaldo (lib/domain/saldos.ts).
 */
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
  const aConfirmar = vencidas.filter((m) => m.contaId === conta.id);

  return (
    <div className="mx-auto max-w-5xl">
      <CabecalhoPagina
        voltar={<LinkVoltar href="/contas">Contas</LinkVoltar>}
        titulo={
          <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="min-w-0 truncate">{conta.apelido}</span>
            {conta.padrao && <Selo tom="info">Padrão</Selo>}
            {!conta.ativa && <Selo>Inativa</Selo>}
          </span>
        }
        subtitulo={
          <>
            {conta.banco}
            {conta.final && <span className="numeros"> •••• {conta.final}</span>} · {conta.empresa.apelido}
          </>
        }
        acoes={
          <LinkBotao href={`/contas/${conta.id}/editar`} variante="secundario" icone={<Pencil className="size-4.5" aria-hidden="true" />}>
            Editar
          </LinkBotao>
        }
      />

      <div className="flex flex-col gap-8">
        {/* 1. Saldo, previsão e ações | 2. Dados da conta */}
        <div className="grid items-start gap-6 lg:grid-cols-5">
          <section aria-label="Saldo da conta" className="overflow-hidden rounded-lg border border-border bg-surface lg:col-span-3">
            <div className="p-5 sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-fg-2">Saldo hoje</p>
                  <p className="mt-1 text-display font-semibold tracking-tight text-fg sm:text-5xl" data-testid="saldo-conta">
                    <SaldoDestaque centavos={saldo} classeCentavos="text-xl sm:text-3xl" />
                  </p>
                </div>
                <div className="sm:text-right">
                  <p className="text-meta text-fg-3">Previsto em {formatarData(fimMes)}</p>
                  <span data-testid="saldo-previsto">
                    <Valor centavos={previstoFimDoMes} className={cn('mt-0.5 block text-lead font-semibold', previstoFimDoMes < 0 ? 'text-danger' : 'text-fg-2')} />
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

              <div className="mt-6">
                <p className="mb-3 text-meta font-medium text-fg-3">Saldo previsto · próximos {LIMITES.diasPrevisaoSaldo} dias</p>
                <GraficoPrevisao
                  saldoHoje={saldo}
                  linhas={previsao.linhas.map((l) => ({ dataEfetiva: l.dataEfetiva, saldoApos: l.saldoApos }))}
                  hoje={hoje}
                  ate={horizonte}
                  primeiroNegativo={previsao.primeiroNegativo}
                />
              </div>
            </div>

            <div className="grid divide-y divide-border-subtle border-t border-border px-2 py-1 sm:flex sm:flex-wrap sm:gap-1 sm:divide-y-0 sm:px-3 sm:py-2">
              <BotaoEntrada contaId={conta.id} hoje={hoje} variante="fantasma" className={CLASSE_ACAO} />
              <BotaoTransferir contas={todasAsContas} origemId={conta.id} hoje={hoje} variante="fantasma" className={CLASSE_ACAO} />
              <BotaoConferir conta={conta} saldoCentavos={saldo} hoje={hoje} variante="fantasma" className={CLASSE_ACAO} />
            </div>
          </section>

          <div className="lg:col-span-2">
            <DadosConta conta={conta} />
          </div>
        </div>

        {/* 3. O que pede ação, o que está previsto e o histórico */}
        {aConfirmar.length > 0 && <EntradasAConfirmar entradas={aConfirmar} />}
        <PrevisaoConta linhas={previsao.linhas} dias={LIMITES.diasPrevisaoSaldo} />
        <ExtratoConta linhas={extrato} verTodas={{ href: `/transacoes?conta=${conta.id}&periodo=todos`, rotulo: 'Ver em Transações' }} />
      </div>
    </div>
  );
}
