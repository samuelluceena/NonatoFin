import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { Cartao } from '@/components/ui/cartao';
import { LinkVoltar } from '@/components/ui/link-voltar';
import { Trash2 } from 'lucide-react';
import { BotaoConfirmar } from '@/components/ui/botao-confirmar';
import { excluirCompra } from '@/features/cartoes/acoes';
import { FormularioCompra } from '@/features/cartoes/componentes/formulario-compra';
import { listarCartoes, obterCompra } from '@/features/cartoes/consultas';
import { listarCategorias } from '@/features/empresas/consultas';
import { exigirUsuario } from '@/lib/auth/sessao';
import { idDaRota } from '@/lib/parametros';

export const metadata: Metadata = { title: 'Editar compra' };

export default async function PaginaEditarCompra({ params }: PageProps<'/cartoes/compras/[id]/editar'>) {
  const id = idDaRota((await params).id);
  const { supabase } = await exigirUsuario();
  const [compra, cartoes, categorias] = await Promise.all([obterCompra(supabase, id), listarCartoes(supabase), listarCategorias()]);
  if (!compra) notFound();
  // Cartões ativos + o cartão atual da compra (mesmo que esteja inativo).
  const opcoes = cartoes.filter((c) => c.ativo || c.id === compra.cartaoId);
  const cartao = cartoes.find((c) => c.id === compra.cartaoId);

  return (
    <div className="mx-auto max-w-2xl">
      <CabecalhoPagina
        voltar={<LinkVoltar href={`/cartoes/${compra.cartaoId}`}>{cartao?.nome ?? 'Cartão'}</LinkVoltar>}
        titulo="Editar compra"
      />
      <Cartao className="p-4 sm:p-6">
        <FormularioCompra
          edicaoId={compra.id}
          cartoes={opcoes}
          categorias={categorias}
          valoresIniciais={{
            cartaoId: compra.cartaoId,
            categoriaId: compra.categoria.id,
            descricao: compra.descricao,
            dataCompra: compra.dataCompra,
            valorTotalCentavos: compra.valorTotalCentavos,
            parcelas: compra.parcelas,
            primeiraFaturaMes: compra.primeiraFaturaMes,
            observacao: compra.observacao ?? '',
          }}
        />
      </Cartao>
      <div className="mt-6 flex justify-end">
        <BotaoConfirmar
          rotulo="Excluir"
          icone={<Trash2 className="size-4.5 text-danger" aria-hidden="true" />}
          titulo="Excluir compra?"
          descricao={`“${compra.descricao}” e todas as suas parcelas serão excluídas e as faturas em aberto serão recalculadas. Esta ação não pode ser desfeita.`}
          acao={excluirCompra.bind(null, compra.id)}
          destino={`/cartoes/${compra.cartaoId}`}
          textoConfirmar="Excluir"
          perigo
          testId="excluir-compra"
        />
      </div>
    </div>
  );
}
