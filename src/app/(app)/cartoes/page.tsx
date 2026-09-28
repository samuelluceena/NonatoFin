import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, CreditCard, Plus, ShoppingBag } from 'lucide-react';
import { LinkBotao } from '@/components/ui/botao';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { IconeLista } from '@/components/ui/lista-painel';
import { Selo } from '@/components/ui/selo';
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
        <ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border bg-surface">
          {cartoes.map((c) => {
            const r = resumos.get(c.id);
            return (
              <li key={c.id} className="min-w-0">
                <Link
                  href={`/cartoes/${c.id}`}
                  className={cn('group flex min-h-16 items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-surface-2/60 focus-visible:-outline-offset-2', !c.ativo && 'opacity-70')}
                  data-testid="item-cartao"
                >
                  <IconeLista>
                    <CreditCard />
                  </IconeLista>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-body font-medium text-fg group-hover:text-primary-text">
                        {c.nome}
                        {c.final && <span className="numeros ml-1.5 font-normal text-fg-3">•••• {c.final}</span>}
                      </span>
                      {!c.ativo && <Selo className="shrink-0">Inativo</Selo>}
                    </span>
                    <span className="mt-0.5 block truncate text-meta text-fg-3">
                      {c.empresa.apelido} · {c.emissor.nome} · fecha dia {c.diaFechamento}, vence dia {c.diaVencimento}
                    </span>
                    <span className="mt-0.5 block truncate text-meta text-fg-2 sm:hidden">
                      {r?.proxima ? (
                        <>
                          Próxima: <Valor centavos={r.proxima.valorCentavos} className="font-medium text-fg" /> · vence {formatarData(r.proxima.vencimento)}
                        </>
                      ) : (
                        'Nada em aberto'
                      )}
                    </span>
                  </span>
                  <span className="hidden w-44 shrink-0 text-right sm:block">
                    <span className="block text-caption text-fg-3">Próxima fatura</span>
                    {r?.proxima ? (
                      <>
                        <Valor centavos={r.proxima.valorCentavos} className="block text-sm font-medium text-fg" />
                        <span className="block truncate text-caption text-fg-3">
                          {formatarMes(r.proxima.mes)} · vence {formatarData(r.proxima.vencimento)}
                        </span>
                      </>
                    ) : (
                      <span className="block text-sm text-fg-3">Nada em aberto</span>
                    )}
                  </span>
                  <span className="w-28 shrink-0 text-right">
                    <span className="block text-caption text-fg-3">Em aberto</span>
                    <Valor centavos={r?.pendenteCentavos ?? 0} className="block text-body font-semibold text-fg" />
                    <span className="block text-caption text-fg-3">
                      {r?.faturasPendentes ?? 0} {r?.faturasPendentes === 1 ? 'fatura' : 'faturas'}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-fg-3" aria-hidden="true" />
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
