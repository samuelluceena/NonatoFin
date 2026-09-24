import { cn } from '@/lib/utils/cn';

/** Símbolo do NonatoFin: "N" azul sobre grafite. */
export function SimboloLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={cn('size-8 shrink-0 rounded-[23%] dark:ring-1 dark:ring-border-strong', className)} aria-hidden="true">
      <rect width="512" height="512" rx="120" fill="#0B0F14" />
      <rect x="136" y="128" width="68" height="256" rx="22" fill="#2563EB" />
      <rect x="308" y="128" width="68" height="256" rx="22" fill="#2563EB" />
      <path d="M176 164 L336 348" stroke="#E8ECF2" strokeWidth="60" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({
  className,
  tamanho = 'md',
  compacto = false,
}: {
  className?: string;
  tamanho?: 'md' | 'lg';
  /** Em telas estreitas mostra só o símbolo (abre espaço para o seletor de empresa). */
  compacto?: boolean;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <SimboloLogo className={tamanho === 'lg' ? 'size-11' : 'size-8'} />
      <span
        className={cn(
          'font-semibold tracking-tight text-fg',
          tamanho === 'lg' ? 'text-[26px]' : 'text-[19px]',
          compacto && 'max-[440px]:sr-only',
        )}
      >
        Nonato<span className="text-primary-text">Fin</span>
      </span>
    </span>
  );
}
