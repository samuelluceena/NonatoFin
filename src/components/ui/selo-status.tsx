import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import type { StatusLancamento } from '@/lib/domain/tipos';
import { ROTULOS_STATUS } from '@/lib/domain/status';
import { Selo, type TomSelo } from './selo';

const TONS: Record<StatusLancamento, TomSelo> = { pago: 'sucesso', pendente: 'info', atrasado: 'perigo' };
const ICONES = { pago: CheckCircle2, pendente: Clock, atrasado: AlertTriangle } as const;

/** Status sempre com ícone + texto (nunca somente cor). */
export function SeloStatus({ status, className }: { status: StatusLancamento; className?: string }) {
  const Icone = ICONES[status];
  return (
    <Selo tom={TONS[status]} data-status={status} className={className}>
      <Icone aria-hidden="true" />
      {ROTULOS_STATUS[status]}
    </Selo>
  );
}
