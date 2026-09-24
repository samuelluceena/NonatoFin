import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import type { StatusLancamento } from '@/lib/domain/tipos';
import { ROTULOS_STATUS } from '@/lib/domain/status';
import { cn } from '@/lib/utils/cn';

const ESTILOS: Record<StatusLancamento, string> = {
  pago: 'bg-success-soft text-success border-success-border',
  pendente: 'bg-primary-soft text-primary-soft-fg border-transparent',
  atrasado: 'bg-danger-soft text-danger border-danger-border',
};

const ICONES = { pago: CheckCircle2, pendente: Clock, atrasado: AlertTriangle } as const;

/** Status sempre com ícone + texto (nunca somente cor). */
export function SeloStatus({ status, className }: { status: StatusLancamento; className?: string }) {
  const Icone = ICONES[status];
  return (
    <span
      data-status={status}
      className={cn(
        'inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-xs font-semibold',
        ESTILOS[status],
        className,
      )}
    >
      <Icone className="size-3.5" aria-hidden="true" />
      {ROTULOS_STATUS[status]}
    </span>
  );
}
