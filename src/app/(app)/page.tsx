import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, CalendarClock, CheckCircle2, ClipboardCheck, Plus } from 'lucide-react';
import { LinkBotao } from '@/components/ui/botao';
import { Cartao } from '@/components/ui/cartao';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { Valor } from '@/components/ui/valor';
import { SaldosDoDia } from '@/features/contas/componentes/saldos-do-dia';
import { listarContas, saidasAteDataPorConta, saldosDasContas } from '@/features/contas/consultas';
import { listarLancamentosTelaInicial } from '@/features/lancamentos/consultas';
import { AvisoSemEmpresa } from '@/features/empresas/componentes/aviso-sem-empresa';
import { obterContextoEmpresas } from '@/features/empresas/consultas';
import { CartaoLancamento } from '@/features/lancamentos/componentes/cartao-lancamento';
import { ListaLancamentos } from '@/features/lancamentos/componentes/lista-lancamentos';
import { exigirUsuario } from '@/lib/auth/sessao';
import { LIMITES } from '@/lib/config';
import { formatarData, hojeISO, nomeDiaDaSemana } from '@/lib/domain/datas';
import { somarCentavos } from '@/lib/domain/dinheiro';
import { linkDaLista } from '@/lib/domain/filtros';

export const metadata: Metadata = { title: 'Hoje' };

export default async function PaginaHoje() {
  const { supabase } = await exigirUsuario();
  const hoje = hojeISO();
  const { empresas, empresaId, selecionada } = await obterContextoEmpresas();
  if (empresas.length === 0) return <AvisoSemEmpresa />;
  const [{ hoje: deHoje, atrasados, proximos }, contas, saldos, saidasHoje] = await Promise.all([
    listarLancamentosTelaInicial(supabase, hoje, empresaId),
    listarContas(supabase, { empresaId, somenteAtivas: true }),
    saldosDasContas(supabase),
    saidasAteDataPorConta(supabase, hoje, empresaId),
  ]);

  const pendentesHoje = deHoje.filter((b) => b.status === 'pendente');
  const pagosHoje = deHoje.length - pendentesHoje.length;
  const totalHoje = somarCentavos(pendentesHoje.map((b) => b.valorCentavos));
  const totalAtrasados = somarCentavos(atrasados.map((b) => b.valorCentavos));

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="titulo-hoje">
        <Cartao className="mb-4 overflow-hidden p-0">
          <div className="flex items-start justify-between gap-4 p-5">
            <div>
              <h1 id="titulo-hoje" className="text-[13px] font-semibold tracking-wide text-fg-3 uppercase">
                Hoje — {formatarData(hoje)}
              </h1>
              <p className="text-sm text-fg-2 first-letter:uppercase">
                {nomeDiaDaSemana(hoje)}
                {selecionada && <span className="text-fg-3"> · {selecionada.apelido}</span>}
              </p>
              <p className="mt-3 text-[15px] text-fg-2" data-testid="qtd-hoje">
                {pendentesHoje.length === 0
                  ? 'Nenhum boleto pendente para hoje'
                  : `${pendentesHoje.length} ${pendentesHoje.length === 1 ? 'boleto a pagar' : 'boletos a pagar'}`}
              </p>
              <Valor centavos={totalHoje} className="mt-1 block text-[32px] leading-tight font-semibold tracking-tight text-fg" />
              {pagosHoje > 0 && (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-success">
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  {pagosHoje} já {pagosHoje === 1 ? 'pago' : 'pagos'} hoje
                </p>
              )}
            </div>
            <div className="hidden shrink-0 sm:block">
              <LinkBotao href="/boletos/novo" icone={<Plus className="size-5" aria-hidden="true" />}>
                NOVO BOLETO
              </LinkBotao>
            </div>
          </div>
          {atrasados.length > 0 && (
            <Link
              href={linkDaLista({ periodo: { tipo: 'todos' }, status: 'atrasados' })}
              className="flex items-center gap-2 border-t border-danger-border bg-danger-soft px-5 py-3 text-sm font-medium text-danger"
            >
              <AlertTriangle className="size-4.5 shrink-0" aria-hidden="true" />
              {atrasados.length} {atrasados.length === 1 ? 'boleto atrasado' : 'boletos atrasados'} ·{' '}
              <Valor centavos={totalAtrasados} />
              <span className="ml-auto text-[13px] underline-offset-2 hover:underline">Ver</span>
            </Link>
          )}
        </Cartao>

        {deHoje.length === 0 ? (
          <EstadoVazio
            icone={<CheckCircle2 />}
            titulo="Nada vence hoje"
            descricao="Aproveite para conferir os próximos vencimentos abaixo."
            acao={
              <LinkBotao href="/boletos/novo" variante="suave" icone={<Plus className="size-5" aria-hidden="true" />}>
                Novo boleto
              </LinkBotao>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="lista-hoje">
            {deHoje.map((b) => (
              <CartaoLancamento key={b.id} lancamento={b} hoje={hoje} variante="destaque" />
            ))}
          </div>
        )}
      </section>

      <SaldosDoDia contas={contas} saldos={saldos} saidas={saidasHoje.porConta} />

      <LinkBotao
        href="/fechar-dia"
        variante="secundario"
        larguraTotal
        icone={<ClipboardCheck className="size-5" aria-hidden="true" />}
        data-testid="fechar-dia"
      >
        Fechar o dia (texto para o WhatsApp)
      </LinkBotao>

      {atrasados.length > 0 && (
        <section aria-labelledby="titulo-atrasados">
          <h2 id="titulo-atrasados" className="mb-3 flex items-center gap-2 text-lg font-semibold text-fg">
            <AlertTriangle className="size-5 text-danger" aria-hidden="true" />
            Atrasados
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {atrasados.map((b) => (
              <CartaoLancamento key={b.id} lancamento={b} hoje={hoje} />
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="titulo-proximos">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="titulo-proximos" className="flex items-center gap-2 text-lg font-semibold text-fg">
            <CalendarClock className="size-5 text-primary-text" aria-hidden="true" />
            Próximos vencimentos
          </h2>
          <Link href={linkDaLista({ periodo: { tipo: 'todos' }, status: 'pendentes' })} className="text-sm font-medium text-primary-text hover:underline">
            Ver todos
          </Link>
        </div>
        {proximos.length === 0 ? (
          <EstadoVazio titulo={`Nenhum vencimento nos próximos ${LIMITES.diasProximosVencimentos} dias`} />
        ) : (
          <ListaLancamentos lancamentos={proximos} hoje={hoje} />
        )}
      </section>
    </div>
  );
}
