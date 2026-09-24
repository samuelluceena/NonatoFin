import type { Metadata } from 'next';
import Link from 'next/link';
import { CreditCard, Plus, ShoppingBag } from 'lucide-react';
import { LinkBotao } from '@/components/ui/botao';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { Cartao } from '@/components/ui/cartao';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { Valor } from '@/components/ui/valor';
import { listarCartoes, resumirFaturasPendentes } from '@/features/cartoes/consultas';
import { AvisoSemEmpresa } from '@/features/empresas/componentes/aviso-sem-empresa';
import { obterContextoEmpresas } from '@/features/empresas/consultas';
import { exigirUsuario } from '@/lib/auth/sessao';
import { formatarData, formatarMes } from '@/lib/domain/datas';
import { somarCentavos } from '@/lib/domain/dinheiro';
import { cn } from '@/lib/utils/cn';

export const metadata: Metadata = { title: 'Cartões' };

export default async function PaginaCartoes() {
  const { supabase } = await exigirUsuario();
  const { empresas, empresaId, selecionada } = await obterContextoEmpresas();
  if (empresas.length === 0) {
    return (
      <>
        <CabecalhoPagina titulo="Cartões" />
        <AvisoSemEmpresa />
      </>
    );
  }

  const cartoes = await listarCartoes(supabase, { empresaId });
  const resumos = await resumirFaturasPendentes(
    supabase,
    cartoes.map((c) => c.id),
  );
  const totalPendente = somarCentavos([...resumos.values()].map((r) => r.pendenteCentavos));
  const temAtivo = cartoes.some((c) => c.ativo);

  return (
    <>
      <CabecalhoPagina
        titulo="Cartões"
        subtitulo={
          cartoes.length > 0 ? (
            <span data-testid="resumo-cartoes">
              {selecionada ? `${selecionada.apelido} · ` : ''}
              Faturas em aberto: <Valor centavos={totalPendente} />
            </span>
          ) : undefined
        }
        acoes={
          <div className="flex gap-2">
            <LinkBotao href="/cartoes/novo" variante="secundario" icone={<Plus className="size-4.5" aria-hidden="true" />}>
              Novo cartão
            </LinkBotao>
            {temAtivo && (
              <LinkBotao href="/cartoes/compras/nova" icone={<ShoppingBag className="size-4.5" aria-hidden="true" />} className="max-sm:hidden">
                Nova compra
              </LinkBotao>
            )}
          </div>
        }
      />

      {cartoes.length === 0 ? (
        <EstadoVazio
          icone={<CreditCard />}
          titulo="Nenhum cartão cadastrado"
          descricao="Cadastre o cartão com os dias de fechamento e vencimento. As compras parceladas viram faturas a pagar automaticamente."
          acao={<LinkBotao href="/cartoes/novo">Cadastrar cartão</LinkBotao>}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {cartoes.map((c) => {
            const r = resumos.get(c.id);
            return (
              <li key={c.id} className="min-w-0">
                <Link href={`/cartoes/${c.id}`} className="block rounded-lg focus-visible:outline-2" data-testid="item-cartao">
                  <Cartao className={cn('flex h-full flex-col gap-3 p-4 transition-colors hover:border-primary/40', !c.ativo && 'opacity-60')}>
                    <div className="flex items-start gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary-soft text-primary-soft-fg">
                        <CreditCard className="size-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-fg">
                          {c.nome}
                          {c.final && <span className="numeros ml-1.5 font-normal text-fg-3">•••• {c.final}</span>}
                        </p>
                        <p className="truncate text-[13px] text-fg-2">
                          {c.empresa.apelido} · {c.emissor.nome}
                        </p>
                        <p className="text-[13px] text-fg-3">
                          Fecha dia {c.diaFechamento} · vence dia {c.diaVencimento}
                          {!c.ativo && ' · Inativo'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-auto grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
                      <div className="min-w-0">
                        <p className="text-[13px] text-fg-3">Próxima fatura</p>
                        {r?.proxima ? (
                          <>
                            <Valor centavos={r.proxima.valorCentavos} className="block font-semibold" />
                            <p className="truncate text-[13px] text-fg-2">{formatarMes(r.proxima.mes)}</p>
                            <p className="numeros text-[13px] text-fg-3">vence {formatarData(r.proxima.vencimento)}</p>
                          </>
                        ) : (
                          <p className="text-fg-2">Nada em aberto</p>
                        )}
                      </div>
                      <div className="min-w-0 text-right">
                        <p className="text-[13px] text-fg-3">Total em aberto</p>
                        <Valor centavos={r?.pendenteCentavos ?? 0} className="block font-semibold" />
                        <p className="text-[13px] text-fg-2">
                          {r?.faturasPendentes ?? 0} {r?.faturasPendentes === 1 ? 'fatura' : 'faturas'}
                        </p>
                      </div>
                    </div>
                  </Cartao>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {temAtivo && (
        <div className="mt-6 sm:hidden">
          <LinkBotao href="/cartoes/compras/nova" larguraTotal tamanho="lg" icone={<ShoppingBag className="size-5" aria-hidden="true" />}>
            Nova compra no cartão
          </LinkBotao>
        </div>
      )}
    </>
  );
}
