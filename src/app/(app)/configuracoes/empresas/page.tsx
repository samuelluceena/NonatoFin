import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { GerenciarEmpresas } from '@/features/empresas/componentes/gerenciar-empresas';
import { obterContextoEmpresas } from '@/features/empresas/consultas';
import { exigirUsuario } from '@/lib/auth/sessao';

export const metadata: Metadata = { title: 'Empresas' };

export default async function PaginaEmpresas() {
  await exigirUsuario();
  const { empresas } = await obterContextoEmpresas();
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/configuracoes" className="mb-4 inline-flex h-10 items-center gap-1.5 text-sm font-medium text-fg-2 hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden="true" /> Configurações
      </Link>
      <CabecalhoPagina titulo="Empresas" subtitulo="Empresas (CNPJ) cujas contas você controla." />
      <GerenciarEmpresas empresas={empresas} />
    </div>
  );
}
