import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CreditCard, Pencil, ShoppingBag } from 'lucide-react';
import { LinkBotao } from '@/components/ui/botao';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { Cartao, TituloSecao } from '@/components/ui/cartao';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { LinkVoltar } from '@/components/ui/link-voltar';
import { SeloStatus } from '@/components/ui/selo-status';
import { Valor } from '@/components/ui/valor';
import { listarComprasDoCartao, listarFaturasDoCartao, obterCartao } from '@/features/cartoes/consultas';
import { exigirUsuario } from '@/lib/auth/sessao';
import { resumoParcelas } from '@/lib/domain/cartoes';
import { formatarData, formatarMes, hojeISO } from '@/lib/domain/datas';
import { somarCentavos } from '@/lib/domain/dinheiro';
import { calcularStatus } from '@/lib/domain/status';
import type { Lancamento } from '@/lib/domain/tipos';
import { idDaRota } from '@/lib/parametros';

export const metadata: Metadata = { title: 'Cartão' };

function ListaFaturas({ faturas, hoje }: { faturas: Lancamento[]; hoje: string }) {
  return (
    <Cartao className="divide-y divide-border">
      {faturas.map((f) => (
        <Link key={f.id} href={`/boletos/${f.id}`} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-surface-2" data-testid="item-fatura">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-body font-medium text-fg">{f.fatura ? formatarMes(f.fatura.mes) : f.descricao}</span>
            <span className="numeros block text-meta text-fg-2">Vence {formatarData(f.vencimento)}</span>
          </span>
          <Valor centavos={f.valorCentavos} className="shrink-0 text-body font-semibold" />
          <SeloStatus status={calcularStatus(f, hoje)} className="max-sm:hidden" />
        </Link>
      ))}
    </Cartao>
  );
}

export default async function PaginaCartao({ params }: PageProps<'/cartoes/[id]'>) {
  const id = idDaRota((await params).id);
  const { supabase } = await exigirUsuario();
  const cartao = await obterCartao(supabase, id);
  if (!cartao) notFound();
  const [faturas, compras] = await Promise.all([listarFaturasDoCartao(supabase, id), listarComprasDoCartao(supabase, id)]);

  const hoje = hojeISO();
  const abertas = faturas.filter((f) => f.status === 'pendente').reverse();
  const pagas = faturas.filter((f) => f.status === 'pago').slice(0, 12);
  const emAberto = somarCentavos(abertas.map((f) => f.valorCentavos));

  return (
    <div className="mx-auto max-w-3xl">
      <CabecalhoPagina
        voltar={<LinkVoltar href="/cartoes">Cartões</LinkVoltar>}
        titulo={
          <span className="flex items-center gap-2.5">
            <CreditCard className="size-6 shrink-0 text-primary-text" aria-hidden="true" />
            <span className="min-w-0 truncate">{cartao.nome}</span>
            {cartao.final && <span className="numeros text-lg font-normal text-fg-3">•••• {cartao.final}</span>}
          </span>
        }
        subtitulo={
          <>
            {cartao.empresa.apelido} · {cartao.emissor.nome} · fecha dia {cartao.diaFechamento}, vence dia {cartao.diaVencimento}
            {!cartao.ativo && ' · Inativo'}
          </>
        }
        acoes={
          <>
            <LinkBotao href={`/cartoes/${cartao.id}/editar`} variante="secundario" icone={<Pencil className="size-4.5" aria-hidden="true" />}>
              Editar
            </LinkBotao>
            {cartao.ativo && (
              <LinkBotao href={`/cartoes/compras/nova?cartao=${cartao.id}`} icone={<ShoppingBag className="size-4.5" aria-hidden="true" />}>
                Nova compra
              </LinkBotao>
            )}
          </>
        }
      />

      <section aria-labelledby="titulo-abertas">
        <div className="mb-2 flex items-baseline justify-between px-1">
          <TituloSecao id="titulo-abertas">Faturas em aberto</TituloSecao>
          <Valor centavos={emAberto} className="text-sm font-semibold" />
        </div>
        {abertas.length === 0 ? (
          <Cartao className="p-4 text-sm text-fg-2">Nenhuma fatura em aberto.</Cartao>
        ) : (
          <ListaFaturas faturas={abertas} hoje={hoje} />
        )}
      </section>

      <section aria-labelledby="titulo-compras" className="mt-6">
        <TituloSecao id="titulo-compras" className="mb-2 px-1">
          Compras
        </TituloSecao>
        {compras.length === 0 ? (
          <EstadoVazio
            icone={<ShoppingBag />}
            titulo="Nenhuma compra lançada"
            descricao="Lance as compras do cartão (à vista ou parceladas). Cada parcela entra na fatura do mês certo."
            acao={cartao.ativo ? <LinkBotao href={`/cartoes/compras/nova?cartao=${cartao.id}`} variante="suave">Nova compra</LinkBotao> : undefined}
          />
        ) : (
          <Cartao className="divide-y divide-border">
            {compras.map((c) => (
              <Link
                key={c.id}
                href={`/cartoes/compras/${c.id}/editar`}
                className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-surface-2"
                data-testid="item-compra"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-medium text-fg">{c.descricao}</span>
                  <span className="numeros block truncate text-meta text-fg-2">
                    {formatarData(c.dataCompra)} · {c.categoria.nome}
                  </span>
                  <span className="numeros block text-meta text-fg-3">
                    {resumoParcelas(c.valorTotalCentavos, c.parcelas)} · {c.parcelas === 1 ? 'fatura' : 'desde'} {formatarMes(c.primeiraFaturaMes)}
                  </span>
                </span>
                <Valor centavos={c.valorTotalCentavos} className="shrink-0 text-body font-semibold" />
              </Link>
            ))}
          </Cartao>
        )}
      </section>

      {pagas.length > 0 && (
        <section aria-labelledby="titulo-pagas" className="mt-6">
          <TituloSecao id="titulo-pagas" className="mb-2 px-1">
            Faturas pagas (últimas 12)
          </TituloSecao>
          <ListaFaturas faturas={pagas} hoje={hoje} />
        </section>
      )}
    </div>
  );
}
