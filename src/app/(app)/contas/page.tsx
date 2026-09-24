import type { Metadata } from 'next';
import Link from 'next/link';
import { Landmark, Plus } from 'lucide-react';
import { LinkBotao } from '@/components/ui/botao';
import { BotaoConfirmar } from '@/components/ui/botao-confirmar';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { Cartao, TituloSecao } from '@/components/ui/cartao';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { Valor } from '@/components/ui/valor';
import { aplicarContaPadrao } from '@/features/contas/acoes';
import { BotaoTransferir } from '@/features/contas/componentes/acoes-conta';
import { agruparSaldos, rotuloConta } from '@/lib/domain/saldos';
import { CartaoConta } from '@/features/contas/componentes/cartao-conta';
import { listarContas, pendentesSemContaPorEmpresa, saidasAteDataPorConta, saldosDasContas } from '@/features/contas/consultas';
import { AvisoSemEmpresa } from '@/features/empresas/componentes/aviso-sem-empresa';
import { obterContextoEmpresas } from '@/features/empresas/consultas';
import { exigirUsuario } from '@/lib/auth/sessao';
import { fimDoMes, hojeISO } from '@/lib/domain/datas';
import { cn } from '@/lib/utils/cn';

export const metadata: Metadata = { title: 'Contas' };

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

  return (
    <>
      <CabecalhoPagina
        titulo="Contas"
        subtitulo={
          contas.length > 0 ? (
            <span data-testid="saldo-total">
              {selecionada ? `${selecionada.apelido} · ` : empresas.length > 1 ? 'Todas as empresas · ' : ''}
              Saldo total: <Valor centavos={grupos.totalCentavos} className={cn('font-semibold', grupos.totalCentavos < 0 ? 'text-danger' : 'text-fg')} />
            </span>
          ) : undefined
        }
        acoes={
          <>
            <LinkBotao href="/contas/nova" variante="secundario" icone={<Plus className="size-4.5" aria-hidden="true" />}>
              Nova conta
            </LinkBotao>
            {contas.filter((c) => c.ativa).length >= 2 && <BotaoTransferir contas={contas} hoje={hoje} />}
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
        <div className="flex flex-col gap-6">
          {grupos.empresas.map((g) => {
            const padrao = g.contas.find((c) => c.conta.padrao);
            const quantosSemConta = semConta.get(g.empresa.id) ?? 0;
            return (
              <section key={g.empresa.id} aria-labelledby={`empresa-${g.empresa.id}`} data-testid="grupo-empresa">
                <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
                  <TituloSecao id={`empresa-${g.empresa.id}`}>{g.empresa.apelido}</TituloSecao>
                  <Valor centavos={g.totalCentavos} className={cn('text-sm font-semibold', g.totalCentavos < 0 && 'text-danger')} />
                </div>
                <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {g.contas.map(({ conta, saldoCentavos }) => (
                    <li key={conta.id} className="min-w-0">
                      <CartaoConta conta={conta} saldoCentavos={saldoCentavos} saidasCentavos={saidas.porConta.get(conta.id) ?? 0} ate={ate} />
                    </li>
                  ))}
                </ul>
                {quantosSemConta > 0 && padrao && (
                  <Cartao className="mt-3 flex flex-col gap-3 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-fg-2">
                      {quantosSemConta === 1 ? '1 lançamento em aberto está' : `${quantosSemConta} lançamentos em aberto estão`} sem conta de débito.
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
                  </Cartao>
                )}
              </section>
            );
          })}

          {saidas.semContaQuantidade > 0 && (
            <p className="px-1 text-[13px] text-fg-3" data-testid="saidas-sem-conta">
              Sem conta definida: {saidas.semContaQuantidade} {saidas.semContaQuantidade === 1 ? 'conta' : 'contas'} até o fim do mês (
              <Valor centavos={saidas.semContaCentavos} />) não entram no saldo de nenhuma conta.
            </p>
          )}

          {inativas.length > 0 && (
            <section aria-labelledby="titulo-inativas">
              <TituloSecao id="titulo-inativas" className="mb-2 px-1">
                Contas inativas
              </TituloSecao>
              <Cartao className="divide-y divide-border">
                {inativas.map((c) => (
                  <Link key={c.id} href={`/contas/${c.id}`} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-surface-2">
                    <span className="truncate text-fg-2">
                      {rotuloConta(c)} — {c.empresa.apelido}
                    </span>
                    <Valor centavos={saldos.get(c.id) ?? 0} className="text-fg-3" />
                  </Link>
                ))}
              </Cartao>
            </section>
          )}
        </div>
      )}
    </>
  );
}
