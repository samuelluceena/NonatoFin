import Link from 'next/link';
import { AlertTriangle, CheckCircle2, ChevronRight, Landmark } from 'lucide-react';
import { IconeLista } from '@/components/ui/lista-painel';
import { Selo } from '@/components/ui/selo';
import { Valor } from '@/components/ui/valor';
import { formatarDataCurta, type DataISO } from '@/lib/domain/datas';
import type { Centavos } from '@/lib/domain/dinheiro';
import { cobertura, rotuloConta } from '@/lib/domain/saldos';
import type { ContaBancaria } from '@/lib/domain/tipos';

interface Props {
  conta: ContaBancaria;
  saldoCentavos: Centavos;
  /** Contas pendentes que saem desta conta até `ate` (inclusive vencidas). */
  saidasCentavos: Centavos;
  ate: DataISO;
}

/**
 * Linha de uma conta (dentro da lista da empresa): saldo de hoje e se ele
 * cobre o que sai da conta até o fim do mês (regra: `cobertura`).
 */
export function CartaoConta({ conta, saldoCentavos, saidasCentavos, ate }: Props) {
  const { cobre, faltaCentavos } = cobertura(saldoCentavos, saidasCentavos);
  return (
    <Link
      href={`/contas/${conta.id}`}
      className="group flex min-h-16 items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-surface-2/60 focus-visible:-outline-offset-2"
      data-testid="item-conta"
    >
      <IconeLista>
        <Landmark />
      </IconeLista>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-body font-medium text-fg group-hover:text-primary-text">{rotuloConta(conta)}</span>
          {conta.padrao && (
            <Selo tom="info" className="shrink-0">
              Padrão
            </Selo>
          )}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-meta text-fg-3">
          <span>{conta.banco}</span>
          <span aria-hidden="true">·</span>
          <span>
            Sai até {formatarDataCurta(ate)}: <Valor centavos={saidasCentavos} className="text-fg-2" />
          </span>
          {cobre ? (
            <span className="inline-flex items-center gap-1 text-success">
              <CheckCircle2 className="size-3.5" aria-hidden="true" /> Cobre
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-medium text-warning">
              <AlertTriangle className="size-3.5" aria-hidden="true" /> Faltam <Valor centavos={faltaCentavos} />
            </span>
          )}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-caption text-fg-3">Saldo hoje</span>
        <Valor centavos={saldoCentavos} tom="negativo-perigo" className="block text-lead font-semibold" />
      </span>
      <ChevronRight className="size-4 shrink-0 text-fg-3" aria-hidden="true" />
    </Link>
  );
}
