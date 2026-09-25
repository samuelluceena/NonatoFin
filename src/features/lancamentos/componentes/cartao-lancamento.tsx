import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { SeloStatus } from '@/components/ui/selo-status';
import { Valor } from '@/components/ui/valor';
import { formatarCodigo } from '@/lib/domain/codigo-barras';
import { formatarData, formatarDataHora, type DataISO } from '@/lib/domain/datas';
import { calcularStatus } from '@/lib/domain/status';
import type { Lancamento } from '@/lib/domain/tipos';
import { cn } from '@/lib/utils/cn';
import { BotaoCopiarCodigo } from './botao-copiar-codigo';
import { BotaoPagamento } from './botao-pagamento';

interface Props {
  lancamento: Lancamento;
  hoje: DataISO;
  /** destaque: tela "Hoje" (botões grandes). compacto: listas longas. */
  variante?: 'destaque' | 'compacto';
}

export function CartaoLancamento({ lancamento, hoje, variante = 'compacto' }: Props) {
  const status = calcularStatus(lancamento, hoje);
  const destaque = variante === 'destaque';
  const pago = status === 'pago';

  return (
    <article
      data-testid="cartao-boleto"
      data-lancamento-id={lancamento.id}
      className={cn(
        'min-w-0 rounded-lg border bg-surface',
        status === 'atrasado' ? 'border-danger-border' : 'border-border',
        destaque ? 'p-4 sm:p-5' : 'p-4',
      )}
    >
      <Link
        href={`/boletos/${lancamento.id}`}
        className="group -m-1 flex items-start justify-between gap-3 rounded-md p-1"
        aria-label={`Ver detalhes: ${lancamento.fornecedor.nome}, ${lancamento.descricao}`}
      >
        <div className="min-w-0">
          <h3 className={cn('truncate font-semibold text-fg group-hover:text-primary-text', destaque ? 'text-lead' : 'text-base')}>
            {lancamento.fornecedor.nome}
          </h3>
          <p className="truncate text-sm text-fg-2">{lancamento.descricao}</p>
          <p className="mt-0.5 truncate text-meta text-fg-3" data-testid="cartao-meta">
            {lancamento.recorrencia && `Parcela ${lancamento.recorrencia.parcela}/${lancamento.recorrencia.totalParcelas} · `}
            {lancamento.categoria.nome} · <span className="font-medium text-fg-2">{lancamento.empresa.apelido}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <SeloStatus status={status} />
          <ChevronRight className="size-4 text-fg-3" aria-hidden="true" />
        </div>
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <Valor
          centavos={lancamento.valorCentavos}
          className={cn('font-semibold tracking-tight text-fg', destaque ? 'text-2xl leading-none' : 'text-xl leading-none')}
        />
        <p className="text-sm text-fg-2">
          Vencimento: <span className={cn('numeros font-medium', status === 'atrasado' ? 'text-danger' : 'text-fg')}>{formatarData(lancamento.vencimento)}</span>
        </p>
      </div>

      {lancamento.conta && (
        <p className="mt-1.5 truncate text-meta text-fg-3" data-testid="cartao-conta">
          {pago ? 'Pago pela conta' : 'Sai de'} <span className="font-medium text-fg-2">{lancamento.conta.apelido}</span>
        </p>
      )}

      {lancamento.codigoBarras && !pago && (
        <p className="mt-2.5 truncate font-mono text-meta text-fg-3" title={formatarCodigo(lancamento.codigoBarras)}>
          <span className="sr-only">Código: </span>
          {formatarCodigo(lancamento.codigoBarras)}
        </p>
      )}

      {pago ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <p className="text-sm text-success">
            {lancamento.pagoEm ? `Pago em ${formatarDataHora(lancamento.pagoEm)}` : 'Pago'}
          </p>
          <BotaoPagamento lancamentoId={lancamento.id} empresaId={lancamento.empresa.id} conta={lancamento.conta} pago tamanho="sm" />
        </div>
      ) : (
        <div className={cn('mt-4 grid gap-2', !destaque && 'sm:grid-cols-2')}>
          <BotaoCopiarCodigo lancamentoId={lancamento.id} codigo={lancamento.codigoBarras} tamanho={destaque ? 'lg' : 'md'} />
          <BotaoPagamento lancamentoId={lancamento.id} empresaId={lancamento.empresa.id} conta={lancamento.conta} pago={false} tamanho={destaque ? 'lg' : 'md'} className="w-full" />
        </div>
      )}
    </article>
  );
}
