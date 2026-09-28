import type { Metadata } from 'next';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { LinkVoltar } from '@/components/ui/link-voltar';
import { GerenciarCategorias } from '@/features/empresas/componentes/gerenciar-categorias';
import { listarCategorias, listarUsoDasCategorias } from '@/features/empresas/consultas';
import { exigirUsuario } from '@/lib/auth/sessao';

export const metadata: Metadata = { title: 'Categorias' };

/** De onde se chegou (o "voltar" leva de volta). Valor fora da lista = Configurações. */
const ORIGENS = {
  transacoes: { href: '/transacoes', rotulo: 'Transações' },
  configuracoes: { href: '/configuracoes', rotulo: 'Configurações' },
} as const;

export default async function PaginaCategorias({ searchParams }: PageProps<'/configuracoes/categorias'>) {
  const { supabase } = await exigirUsuario();
  const { origem } = await searchParams;
  const voltar = origem === 'transacoes' ? ORIGENS.transacoes : ORIGENS.configuracoes;
  // Lista primeiro: no primeiro uso ela cria as categorias padrão.
  const categorias = await listarCategorias();
  const uso = await listarUsoDasCategorias(supabase);
  return (
    <div className="mx-auto max-w-2xl">
      <CabecalhoPagina
        voltar={<LinkVoltar href={voltar.href}>{voltar.rotulo}</LinkVoltar>}
        titulo="Categorias"
        subtitulo="Organizam lançamentos, compras no cartão e relatórios. Categoria em uso pode ser editada, mas não excluída."
      />
      <GerenciarCategorias categorias={categorias} uso={Object.fromEntries(uso)} />
    </div>
  );
}
