import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, ChevronRight, Info, Landmark, Plus } from 'lucide-react';
import { LinkBotao } from '@/components/ui/botao';
import { BotaoConfirmar } from '@/components/ui/botao-confirmar';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { Valor } from '@/components/ui/valor';
import { aplicarContaPadrao } from '@/features/contas/acoes';
import { BotaoTransferir } from '@/features/contas/componentes/acoes-conta';
import { agruparSaldos, rotuloConta } from '@/lib/domain/saldos';
import { COLUNAS_CONTA, CartaoConta } from '@/features/contas/componentes/cartao-conta';
import { SaldoDestaque } from '@/features/contas/componentes/saldo-destaque';
import { listarContas, pendentesSemContaPorEmpresa, saidasAteDataPorConta, saldosDasContas } from '@/features/contas/consultas';
import { AvisoSemEmpresa } from '@/features/empresas/componentes/aviso-sem-empresa';
import { obterContextoEmpresas } from '@/features/empresas/consultas';
import { exigirUsuario } from '@/lib/auth/sessao';
import { fimDoMes, formatarDataCurta, hojeISO } from '@/lib/domain/datas';
import { cn } from '@/lib/utils/cn';

export const metadata: Metadata = { title: 'Contas' };

/**
 * Contas em níveis: 1. saldo total (principal); 2. contas por empresa, com o
 * que sai até o fim do mês e se o saldo cobre; 3. avisos e contas inativas
 * (recolhidas). Só apresentação: saldos e cobertura vêm de lib/domain/saldos.ts.
 */
export default async function PaginaContas() {
  const { supabase } = await exigirUsuario();
  const { empresas, empresaId, selecionada } = await obterContextoEmpresas();
  if (empresas.length === 0) {
    return (
      <>
        <CabecalhoPagina titulo="Contas" />
        <AvisoSemEmpresa />
      </>
    );
  }

  const hoje = hojeISO();
  const ate = fimDoMes(hoje);
  const [contas, saldos, saidas, semConta] = await Promise.all([
    listarContas(supabase, { empresaId }),
    saldosDasContas(supabase),
    saidasAteDataPorConta(supabase, ate, empresaId),
    pendentesSemContaPorEmpresa(supabase),
  ]);
  const grupos = agruparSaldos(contas, saldos);
  const inativas = contas.filter((c) => !c.ativa);
  const quantidadeAtivas = contas.length - inativas.length;

  return (
    <>
      <CabecalhoPagina
        titulo="Contas"
        subtitulo={selecionada ? selecionada.apelido : empresas.length > 1 ? 'Todas as empresas' : undefined}
        acoes={
          <>
            <LinkBotao href="/contas/nova" variante="secundario" icone={<Plus className="size-4.5" aria-hidden="true" />}>
              Nova conta
            </LinkBotao>
            {quantidadeAtivas >= 2 && <BotaoTransferir contas={contas} hoje={hoje} />}
          </>
        }
      />

      {contas.length === 0 ? (
        <EstadoVazio
          icone={<Landmark />}
          titulo="Nenhuma conta bancária cadastrada"
          descricao="Cadastre as contas de cada empresa com o saldo de hoje. Os pagamentos passam a sair do saldo da conta escolhida."
          acao={<LinkBotao href="/contas/nova">Cadastrar conta</LinkBotao>}
        />
      ) : (
        <div className="flex flex-col gap-8">
          {/* 1. Saldo total */}
          <section aria-label="Saldo total">
            <p className="text-sm font-medium text-fg-2">Saldo total</p>
            <p className="mt-1 text-display font-semibold tracking-tight text-fg sm:text-5xl" data-testid="saldo-total">
              <SaldoDestaque centavos={grupos.totalCentavos} classeCentavos="text-xl sm:text-3xl" />
            </p>
            <p className="mt-1 text-meta text-fg-3">
              {quantidadeAtivas} {quantidadeAtivas === 1 ? 'conta ativa' : 'contas ativas'}
              {grupos.empresas.length > 1 && ` em ${grupos.empresas.length} empresas`}
            </p>
          </section>

          {/* 2. Contas por empresa */}
          {grupos.empresas.map((g) => {
            const padrao = g.contas.find((c) => c.conta.padrao);
            const quantosSemConta = semConta.get(g.empresa.id) ?? 0;
            return (
              <section key={g.empresa.id} aria-labelledby={`empresa-${g.empresa.id}`} data-testid="grupo-empresa">
                <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-1">
                  <h2 id={`empresa-${g.empresa.id}`} className="text-body font-semibold text-fg">
                    {g.empresa.apelido}
                  </h2>
                  <p className="text-meta text-fg-3">
                    Total <Valor centavos={g.totalCentavos} tom="negativo-perigo" className="text-sm font-semibold text-fg" />
                  </p>
                </div>
                <div className="overflow-hidden rounded-lg border border-border bg-surface">
                  <div className="hidden items-center gap-4 border-b border-border-subtle px-5 pt-3 pb-2 text-caption font-medium text-fg-3 md:flex" aria-hidden="true">
                    <span className="flex-1">Conta</span>
                    <span className={cn('shrink-0 text-right', COLUNAS_CONTA.saida)}>Sai até {formatarDataCurta(ate)}</span>
                    <span className={cn('shrink-0 text-right', COLUNAS_CONTA.cobertura)}>Cobertura</span>
                    <span className={cn('shrink-0 text-right', COLUNAS_CONTA.saldo)}>Saldo hoje</span>
                    <span className="w-4 shrink-0" />
                  </div>
                  <ul className="divide-y divide-border-subtle">
                    {g.contas.map(({ conta, saldoCentavos }) => (
                      <li key={conta.id} className="min-w-0">
                        <CartaoConta conta={conta} saldoCentavos={saldoCentavos} saidasCentavos={saidas.porConta.get(conta.id) ?? 0} ate={ate} />
                      </li>
                    ))}
                  </ul>
                  {quantosSemConta > 0 && padrao && (
                    <div className="flex flex-col gap-3 border-t border-warning-border bg-warning-soft px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between md:px-5">
                      <p className="flex items-start gap-2 text-fg">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                        <span>
                          {quantosSemConta === 1 ? '1 lançamento em aberto está' : `${quantosSemConta} lançamentos em aberto estão`} sem conta de débito.
                        </span>
                      </p>
                      <BotaoConfirmar
                        rotulo={`Usar ${padrao.conta.apelido}`}
                        titulo="Aplicar a conta padrão"
                        descricao={`Os lançamentos em aberto de ${g.empresa.apelido} sem conta passam a sair de ${rotuloConta(padrao.conta)}.`}
                        acao={aplicarContaPadrao.bind(null, g.empresa.id)}
                        textoConfirmar="Aplicar"
                        tamanho="sm"
                        testId="aplicar-conta-padrao"
                      />
                    </div>
                  )}
                </div>
              </section>
            );
          })}

          {/* 3. Avisos e contas inativas */}
          {saidas.semContaQuantidade > 0 && (
            <p className="-mt-4 flex items-start gap-2 px-1 text-meta text-fg-3" data-testid="saidas-sem-conta">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>
                Sem conta definida: {saidas.semContaQuantidade} {saidas.semContaQuantidade === 1 ? 'lançamento' : 'lançamentos'} até o fim do mês (
                <Valor centavos={saidas.semContaCentavos} />) não entram no saldo de nenhuma conta.
              </span>
            </p>
          )}

          {inativas.length > 0 && (
            <details className="group">
              <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 rounded-md px-1 text-sm font-medium text-fg-2 hover:text-fg [&::-webkit-details-marker]:hidden">
                <ChevronRight className="size-4 shrink-0 transition-transform duration-150 group-open:rotate-90" aria-hidden="true" />
                Contas inativas ({inativas.length})
              </summary>
              <ul className="mt-1 divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle">
                {inativas.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/contas/${c.id}`}
                      className="flex min-h-12 items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors duration-150 hover:bg-surface-2/60 focus-visible:-outline-offset-2"
                    >
                      <span className="min-w-0 truncate text-fg-2">
                        {rotuloConta(c)} <span className="text-fg-3">— {c.empresa.apelido}</span>
                      </span>
                      <Valor centavos={saldos.get(c.id) ?? 0} className="text-fg-3" />
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </>
  );
}
