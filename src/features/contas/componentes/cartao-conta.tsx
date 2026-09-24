import Link from 'next/link';
import { AlertTriangle, Landmark } from 'lucide-react';
import { Cartao } from '@/components/ui/cartao';
import { Valor } from '@/components/ui/valor';
import { formatarData, type DataISO } from '@/lib/domain/datas';
import type { Centavos } from '@/lib/domain/dinheiro';
import { cobertura, rotuloConta } from '@/lib/domain/saldos';
import type { ContaBancaria } from '@/lib/domain/tipos';
import { cn } from '@/lib/utils/cn';

interface Props {
  conta: ContaBancaria;
  saldoCentavos: Centavos;
  /** Contas pendentes que saem desta conta até `ate` (inclusive vencidas). */
  saidasCentavos: Centavos;
  ate: DataISO;
}

/** Resumo de uma conta: saldo de hoje e se cobre o que sai até o fim do mês. */
export function CartaoConta({ conta, saldoCentavos, saidasCentavos, ate }: Props) {
  const { cobre, faltaCentavos } = cobertura(saldoCentavos, saidasCentavos);
  return (
    <Link href={`/contas/${conta.id}`} className="block rounded-lg focus-visible:outline-2" data-testid="item-conta">
      <Cartao className="flex h-full flex-col gap-3 p-4 transition-colors hover:border-primary/40">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary-soft text-primary-soft-fg">
            <Landmark className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-fg">{rotuloConta(conta)}</p>
            <p className="truncate text-[13px] text-fg-2">
              {conta.banco}
              {conta.padrao && <span className="ml-1.5 font-medium text-primary-text">· padrão</span>}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[13px] text-fg-3">Saldo hoje</p>
            <Valor centavos={saldoCentavos} className={cn('block text-lg font-semibold', saldoCentavos < 0 && 'text-danger')} />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border pt-3 text-[13px]">
          <span className="text-fg-2">
            Sai até {formatarData(ate)}: <Valor centavos={saidasCentavos} className="font-medium text-fg" />
          </span>
          {cobre ? (
            <span className="font-medium text-success">Cobre</span>
          ) : (
            <span className="inline-flex items-center gap-1 font-medium text-danger">
              <AlertTriangle className="size-3.5" aria-hidden="true" />
              Faltam <Valor centavos={faltaCentavos} />
            </span>
          )}
        </div>
      </Cartao>
    </Link>
  );
}
