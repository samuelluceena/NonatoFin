import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

export function LinkVoltar({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex h-10 items-center gap-1.5 text-sm font-medium text-fg-2 hover:text-fg">
      <ArrowLeft className="size-4" aria-hidden="true" /> {children}
    </Link>
  );
}
