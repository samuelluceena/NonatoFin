import type { Metadata } from 'next';
import { CreditCard } from 'lucide-react';
import { LinkBotao } from '@/components/ui/botao';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { LinkVoltar } from '@/components/ui/link-voltar';
import { FormularioCompra } from '@/features/cartoes/componentes/formulario-compra';
import { listarCartoes } from '@/features/cartoes/consultas';
import { categoriaPadrao } from '@/features/cartoes/padroes';
import { AvisoSemEmpresa } from '@/features/empresas/componentes/aviso-sem-empresa';
import { listarCategorias, obterContextoEmpresas } from '@/features/empresas/consultas';
import { exigirUsuario } from '@/lib/auth/sessao';
import { faturaDaCompra } from '@/lib/domain/cartoes';
import { hojeISO } from '@/lib/domain/datas';

export const metadata: Metadata = { title: 'Nova compra no cartão' };

export default async function PaginaNovaCompra({ searchParams }: PageProps<'/cartoes/compras/nova'>) {
  const { supabase } = await exigirUsuario();
  const params = await searchParams;
  const { empresas, empresaId } = await obterContextoEmpresas();
  const [cartoes, categorias] = await Promise.all([listarCartoes(supabase, { empresaId, somenteAtivos: true }), listarCategorias()]);

  const pedido = typeof params.cartao === 'string' ? params.cartao : '';
  const cartao = cartoes.find((c) => c.id === pedido) ?? (cartoes.length === 1 ? cartoes[0] : undefined);
  const hoje = hojeISO();

  return (
    <div className="mx-auto max-w-xl">
      <CabecalhoPagina
        voltar={<LinkVoltar href={cartao ? `/cartoes/${cartao.id}` : '/cartoes'}>{cartao ? cartao.nome : 'Cartões'}</LinkVoltar>}
        titulo="Nova compra no cartão"
        subtitulo="Informe o valor total; o sistema divide nas parcelas e monta as faturas."
      />
      {empresas.length === 0 ? (
        <AvisoSemEmpresa />
      ) : cartoes.length === 0 ? (
        <EstadoVazio
          icone={<CreditCard />}
          titulo="Cadastre um cartão primeiro"
          descricao="Precisamos dos dias de fechamento e vencimento para saber em qual fatura cada parcela entra."
          acao={<LinkBotao href="/cartoes/novo">Cadastrar cartão</LinkBotao>}
        />
      ) : (
        <>
          <FormularioCompra
            cartoes={cartoes}
            categorias={categorias}
            valoresIniciais={{
              cartaoId: cartao?.id ?? '',
              categoriaId: categoriaPadrao(categorias, 'Despesa variada'),
              descricao: '',
              dataCompra: hoje,
              valorTotalCentavos: 0,
              parcelas: 1,
              primeiraFaturaMes: cartao ? faturaDaCompra(hoje, cartao) : '',
              observacao: '',
            }}
          />
        </>
      )}
    </div>
  );
}
