import Link from 'next/link';
import { AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';
import { Selo } from '@/components/ui/selo';
import { Valor } from '@/components/ui/valor';
import { formatarDataCurta, type DataISO } from '@/lib/domain/datas';
import type { Centavos } from '@/lib/domain/dinheiro';
import { cobertura } from '@/lib/domain/saldos';
import type { ContaBancaria } from '@/lib/domain/tipos';
import { cn } from '@/lib/utils/cn';

/** Larguras das colunas (a partir de md), compartilhadas com o cabeçalho da lista. */
export const COLUNAS_CONTA = { saida: 'md:w-32', cobertura: 'md:w-44', saldo: 'md:w-36' } as const;

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
 * Celular: dois níveis (conta + saldo; saída + cobertura). A partir de md:
 * colunas alinhadas com o cabeçalho da lista.
 */
export function CartaoConta({ conta, saldoCentavos, saidasCentavos, ate }: Props) {
  const { cobre, faltaCentavos } = cobertura(saldoCentavos, saidasCentavos);
  return (
    <Link
      href={`/contas/${conta.id}`}
      className="group flex flex-col gap-2 px-4 py-3.5 transition-colors duration-150 hover:bg-surface-2/60 focus-visible:-outline-offset-2 md:flex-row md:items-center md:gap-4 md:px-5 md:py-4"
      data-testid="item-conta"
    >
      <span className="flex min-w-0 items-start justify-between gap-3 md:flex-1">
        <span className="min-w-0">
          <span className="block truncate text-caption font-medium tracking-wide text-fg-3 uppercase">
            {conta.banco}
            {conta.final && <span className="numeros"> •••• {conta.final}</span>}
          </span>
          <span className="mt-0.5 flex items-center gap-2">
            <span className="truncate text-body font-medium text-fg group-hover:text-primary-text">{conta.apelido}</span>
            {conta.padrao && (
              <Selo tom="info" className="shrink-0">
                Padrão
              </Selo>
            )}
          </span>
        </span>
        <span className="shrink-0 text-right md:hidden">
          <span className="sr-only">Saldo hoje: </span>
          <Valor centavos={saldoCentavos} tom="negativo-perigo" className="text-lead font-semibold" />
        </span>
      </span>

      <span className="flex items-center justify-between gap-3 text-meta md:contents">
        <span className={cn('min-w-0 text-fg-3 md:shrink-0 md:text-right md:text-sm', COLUNAS_CONTA.saida)}>
          <span className="md:sr-only">Sai até {formatarDataCurta(ate)}: </span>
          <Valor centavos={saidasCentavos} className="text-fg-2" />
        </span>
        <span className={cn('shrink-0 text-right', COLUNAS_CONTA.cobertura)}>
          {cobre ? (
            <span className="inline-flex items-center gap-1 text-success">
              <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" /> Cobre
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-semibold text-warning">
              <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" /> Faltam <Valor centavos={faltaCentavos} />
            </span>
          )}
        </span>
      </span>

      <span className={cn('hidden shrink-0 text-right md:block', COLUNAS_CONTA.saldo)}>
        <span className="sr-only">Saldo hoje: </span>
        <Valor centavos={saldoCentavos} tom="negativo-perigo" className="text-lead font-semibold" />
      </span>
      <ChevronRight
        className="hidden size-4 shrink-0 text-fg-3 transition-[color,transform] duration-150 group-hover:translate-x-0.5 group-hover:text-fg md:block"
        aria-hidden="true"
      />
    </Link>
  );
}
