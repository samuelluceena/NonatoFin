import Link from 'next/link';
import { AlertTriangle, CheckCircle2, ChevronRight, Clock } from 'lucide-react';
import { Valor } from '@/components/ui/valor';
import { formatarData } from '@/lib/domain/datas';
import type { ResumoFornecedor } from '@/lib/domain/tipos';

/** Resumo de um fornecedor: quantidades e valores por status. */
export function CartaoFornecedor({ resumo }: { resumo: ResumoFornecedor }) {
  const r = resumo;
  return (
    <Link
      href={`/fornecedores/${r.fornecedor.id}`}
      data-testid="cartao-fornecedor"
      className="group block rounded-lg border border-border bg-surface p-4 shadow-sm transition-colors hover:border-border-strong"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold uppercase tracking-wide text-fg group-hover:text-primary-text">{r.fornecedor.nome}</h3>
          <p className="text-sm text-fg-2">
            {r.quantidadeTotal} {r.quantidadeTotal === 1 ? 'boleto' : 'boletos'}
            {r.proximoVencimento && <> · próximo em {formatarData(r.proximoVencimento)}</>}
          </p>
        </div>
        <ChevronRight className="mt-1 size-4 shrink-0 text-fg-3" aria-hidden="true" />
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-fg-2">
        <li className="inline-flex items-center gap-1">
          <Clock className="size-3.5 text-primary-text" aria-hidden="true" />
          Pendentes: <strong className="font-semibold text-fg">{r.quantidadePendente}</strong>
        </li>
        <li className="inline-flex items-center gap-1">
          <CheckCircle2 className="size-3.5 text-success" aria-hidden="true" />
          Pagos: <strong className="font-semibold text-fg">{r.quantidadePaga}</strong>
        </li>
        <li className="inline-flex items-center gap-1">
          <AlertTriangle className="size-3.5 text-danger" aria-hidden="true" />
          Atrasados: <strong className="font-semibold text-fg">{r.quantidadeAtrasada}</strong>
        </li>
      </ul>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-3 text-sm">
        <div>
          <dt className="text-[12px] text-fg-3">Total cadastrado</dt>
          <dd><Valor centavos={r.totalCentavos} className="font-semibold text-fg" /></dd>
        </div>
        <div>
          <dt className="text-[12px] text-fg-3">A pagar</dt>
          <dd><Valor centavos={r.pendenteCentavos} className="font-medium text-fg" /></dd>
        </div>
        <div>
          <dt className="text-[12px] text-fg-3">Pago</dt>
          <dd><Valor centavos={r.pagoCentavos} className="font-medium text-fg" /></dd>
        </div>
        <div>
          <dt className="text-[12px] text-fg-3">Atrasado</dt>
          <dd><Valor centavos={r.atrasadoCentavos} className={r.atrasadoCentavos > 0 ? 'font-medium text-danger' : 'font-medium text-fg'} /></dd>
        </div>
      </dl>
    </Link>
  );
}
