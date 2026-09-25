import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { LinkVoltar } from '@/components/ui/link-voltar';
import { Trash2 } from 'lucide-react';
import { BotaoConfirmar } from '@/components/ui/botao-confirmar';
import { excluirCartao } from '@/features/cartoes/acoes';
import { FormularioCartao } from '@/features/cartoes/componentes/formulario-cartao';
import { obterCartao } from '@/features/cartoes/consultas';
import { listarTodasAsContas } from '@/features/contas/consultas';
import { listarCategorias, obterContextoEmpresas } from '@/features/empresas/consultas';
import { listarFornecedores } from '@/features/fornecedores/consultas';
import { exigirUsuario } from '@/lib/auth/sessao';
import { hojeISO } from '@/lib/domain/datas';
import { idDaRota } from '@/lib/parametros';

export const metadata: Metadata = { title: 'Editar cartão' };

export default async function PaginaEditarCartao({ params }: PageProps<'/cartoes/[id]/editar'>) {
  const id = idDaRota((await params).id);
  const { supabase } = await exigirUsuario();
  const [cartao, fornecedores, { empresas }, categorias, contas] = await Promise.all([
    obterCartao(supabase, id),
    listarFornecedores(supabase),
    obterContextoEmpresas(),
    listarCategorias(),
    listarTodasAsContas(),
  ]);
  if (!cartao) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <CabecalhoPagina
        titulo="Editar cartão"
        voltar={<LinkVoltar href={`/cartoes/${cartao.id}`}>{cartao.nome}</LinkVoltar>}
        subtitulo="Mudanças de nome, empresa, emissor, categoria e vencimento são aplicadas às faturas em aberto."
      />
      <>
        <FormularioCartao
          edicaoId={cartao.id}
          empresas={empresas}
          categorias={categorias}
          fornecedores={fornecedores}
          contas={contas}
          hoje={hojeISO()}
          valoresIniciais={{
            empresaId: cartao.empresa.id,
            nome: cartao.nome,
            final: cartao.final ?? '',
            emissorNome: cartao.emissor.nome,
            diaFechamento: cartao.diaFechamento,
            diaVencimento: cartao.diaVencimento,
            categoriaFaturaId: cartao.categoriaFaturaId,
            contaId: cartao.contaId ?? '',
            ativo: cartao.ativo,
          }}
        />
      </>
      <div className="mt-6 flex justify-end">
        <BotaoConfirmar
          rotulo="Excluir"
          icone={<Trash2 className="size-4.5 text-danger" aria-hidden="true" />}
          titulo="Excluir cartão?"
          descricao={`O cartão “${cartao.nome}” será excluído. Só é possível excluir cartões sem compras e sem faturas. Esta ação não pode ser desfeita.`}
          acao={excluirCartao.bind(null, cartao.id)}
          destino="/cartoes"
          textoConfirmar="Excluir"
          perigo
          testId="excluir-cartao"
        />
      </div>
    </div>
  );
}
