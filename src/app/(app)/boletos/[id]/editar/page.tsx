import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { Cartao } from '@/components/ui/cartao';
import { listarSerie, obterLancamento } from '@/features/lancamentos/consultas';
import { FormularioLancamento } from '@/features/lancamentos/componentes/formulario-lancamento';
import { infoSerie } from '@/features/lancamentos/serie';
import { listarTodasAsContas } from '@/features/contas/consultas';
import { listarCategorias, obterContextoEmpresas } from '@/features/empresas/consultas';
import { listarFornecedores } from '@/features/fornecedores/consultas';
import { exigirUsuario } from '@/lib/auth/sessao';
import { formatarCodigo } from '@/lib/domain/codigo-barras';
import { idDaRota } from '@/lib/parametros';

export const metadata: Metadata = { title: 'Editar boleto' };

export default async function PaginaEditarBoleto({ params }: PageProps<'/boletos/[id]/editar'>) {
  const id = idDaRota((await params).id);
  const { supabase } = await exigirUsuario();
  const [lancamento, fornecedores, { empresas }, categorias, contas] = await Promise.all([
    obterLancamento(supabase, id),
    listarFornecedores(supabase),
    obterContextoEmpresas(),
    listarCategorias(),
    listarTodasAsContas(),
  ]);
  if (!lancamento) notFound();
  // Faturas de cartão são ajustadas na própria tela da fatura.
  if (lancamento.fatura) redirect(`/boletos/${lancamento.id}`);
  const serie = lancamento.recorrencia ? await listarSerie(supabase, lancamento.recorrencia.serieId) : [];

  return (
    <div className="mx-auto max-w-2xl">
      <CabecalhoPagina
        titulo="Editar boleto"
        subtitulo={
          lancamento.recorrencia
            ? `${lancamento.fornecedor.nome} · parcela ${lancamento.recorrencia.parcela}/${lancamento.recorrencia.totalParcelas}`
            : lancamento.fornecedor.nome
        }
      />
      <Cartao className="p-4 sm:p-6">
        <FormularioLancamento
          fornecedores={fornecedores}
          empresas={empresas}
          categorias={categorias}
          contas={contas}
          edicao={{ id: lancamento.id, serie: infoSerie(lancamento, serie) }}
          valoresIniciais={{
            empresaId: lancamento.empresa.id,
            categoriaId: lancamento.categoria.id,
            contaId: lancamento.conta?.id ?? '',
            fornecedorNome: lancamento.fornecedor.nome,
            descricao: lancamento.descricao,
            vencimento: lancamento.vencimento,
            valorCentavos: lancamento.valorCentavos,
            codigoBarras: lancamento.codigoBarras ? formatarCodigo(lancamento.codigoBarras) : '',
            observacao: lancamento.observacao ?? '',
            status: lancamento.status,
          }}
        />
      </Cartao>
    </div>
  );
}
