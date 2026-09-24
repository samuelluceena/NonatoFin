import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { GerenciarCategorias } from '@/features/empresas/componentes/gerenciar-categorias';
import { listarCategorias } from '@/features/empresas/consultas';
import { exigirUsuario } from '@/lib/auth/sessao';

export const metadata: Metadata = { title: 'Categorias' };

export default async function PaginaCategorias() {
  await exigirUsuario();
  const categorias = await listarCategorias();
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/configuracoes" className="mb-4 inline-flex h-10 items-center gap-1.5 text-sm font-medium text-fg-2 hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden="true" /> Configurações
      </Link>
      <CabecalhoPagina titulo="Categorias" subtitulo="Organizam os lançamentos e os relatórios. Crie, renomeie ou exclua." />
      <GerenciarCategorias categorias={categorias} />
    </div>
  );
}
