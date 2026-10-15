import Link from 'next/link';
import { Building2, ChevronRight } from 'lucide-react';
import { Valor } from '@/components/ui/valor';
import { cn } from '@/lib/utils/cn';
import type { ContagemSemEmpresa } from '../consultas';

interface Props {
  contagem: ContagemSemEmpresa;
  /** Texto de contexto (ex.: "não entram nos totais desta empresa"). */
  complemento?: string;
  className?: string;
}

/**
 * Aviso discreto de lançamentos sem empresa definida (ex.: importados de uma
 * planilha), com atalho para atribuir as empresas em lote.
 */
export function AvisoLancamentosSemEmpresa({ contagem, complemento, className }: Props) {
  if (contagem.quantidade === 0) return null;
  const n = contagem.quantidade;
  return (
    <Link
      href="/boletos/sem-empresa"
      data-testid="aviso-sem-empresa"
      className={cn(
        'group flex items-center gap-3 rounded-lg border border-warning-border bg-warning-soft px-4 py-3 text-sm transition-colors hover:brightness-[0.98] dark:hover:brightness-110',
        className,
      )}
    >
      <Building2 className="size-5 shrink-0 text-warning" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-fg">
          {n} {n === 1 ? 'lançamento sem empresa definida' : 'lançamentos sem empresa definida'} · <Valor centavos={contagem.totalCentavos} className="numeros" />
        </span>
        <span className="block text-meta text-fg-2">{complemento ?? 'Defina a empresa para que entrem nos saldos, contas e relatórios por empresa.'}</span>
      </span>
      <span className="hidden shrink-0 items-center gap-1 font-medium text-fg sm:inline-flex">
        Atribuir empresas <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
      <ChevronRight className="size-4 shrink-0 text-fg-3 sm:hidden" aria-hidden="true" />
    </Link>
  );
}
