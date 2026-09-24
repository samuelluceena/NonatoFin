import Link from 'next/link';
import { SeletorEmpresa } from '@/features/empresas/componentes/seletor-empresa';
import { APP } from '@/lib/config';
import { Logo } from './logo';
import { SeletorTemaCompacto } from './seletor-tema';

/** Cabeçalho do celular/tablet (abaixo de 1024px). */
interface Props {
  empresas: { id: string; apelido: string }[];
  selecionadaId: string | null;
}

export function CabecalhoMobile({ empresas, selecionadaId }: Props) {
  const comSeletor = empresas.length > 1;
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg/90 pt-safe backdrop-blur-md lg:hidden">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-2 px-4">
        <Link href="/" className="shrink-0 rounded-md" aria-label={`${APP.nome} — início`}>
          <Logo compacto={comSeletor} />
        </Link>
        <SeletorEmpresa empresas={empresas} selecionadaId={selecionadaId} className="max-w-56 flex-1" />
        <SeletorTemaCompacto />
      </div>
    </header>
  );
}
