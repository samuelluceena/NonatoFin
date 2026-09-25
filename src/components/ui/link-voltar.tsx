import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';

export function LinkVoltar({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-9 items-center gap-1 rounded-md px-1 text-sm font-medium text-fg-3 transition-colors hover:text-fg"
    >
      <ChevronLeft className="size-4" aria-hidden="true" /> {children}
    </Link>
  );
}
