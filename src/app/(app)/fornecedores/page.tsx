import type { Metadata } from 'next';
import { Store } from 'lucide-react';
import { BarrasFornecedores } from '@/components/graficos/barras-fornecedores';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { CabecalhoSecao } from '@/components/ui/cabecalho-secao';
import { Cartao } from '@/components/ui/cartao';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { carregarBaseRelatorios } from '@/features/dashboard/dados';
import { BotaoNovoFornecedor } from '@/features/fornecedores/componentes/botao-novo-fornecedor';
import { CabecalhoListaFornecedores, CartaoFornecedor } from '@/features/fornecedores/componentes/cartao-fornecedor';
import { obterContextoEmpresas } from '@/features/empresas/consultas';
import { exigirUsuario } from '@/lib/auth/sessao';
import { hojeISO } from '@/lib/domain/datas';
import { resumoPorFornecedor } from '@/lib/domain/indicadores';

export const metadata: Metadata = { title: 'Fornecedores' };

export default async function PaginaFornecedores() {
  await exigirUsuario();
  const hoje = hojeISO();
  const { resumos, fornecedores } = await carregarBaseRelatorios();
  const { empresaId } = await obterContextoEmpresas();
  // Com uma empresa selecionada, mostra só os fornecedores que têm contas nela.
  const porFornecedor = resumoPorFornecedor(resumos, fornecedores, hoje).filter((r) => !empresaId || r.quantidadeTotal > 0);

  return (
    <>
      <CabecalhoPagina
        titulo="Fornecedores"
        subtitulo={`${fornecedores.length} ${fornecedores.length === 1 ? 'fornecedor' : 'fornecedores'}`}
        acoes={<BotaoNovoFornecedor />}
      />

      {fornecedores.length === 0 ? (
        <EstadoVazio
          icone={<Store />}
          titulo="Nenhum fornecedor cadastrado"
          descricao="Fornecedores também são criados automaticamente ao cadastrar um boleto."
        />
      ) : (
        <div className="flex flex-col gap-6">
          <section aria-labelledby="titulo-comparativo">
            <CabecalhoSecao id="titulo-comparativo" titulo="Comparativo" detalhe="Os 10 maiores pela métrica escolhida" />
            <Cartao className="p-4 sm:p-5">
              <BarrasFornecedores resumos={porFornecedor} limite={10} />
            </Cartao>
          </section>

          <section aria-labelledby="titulo-lista-fornecedores">
            <CabecalhoSecao id="titulo-lista-fornecedores" titulo="Por fornecedor" detalhe={`${porFornecedor.length} com boletos`} />
            {porFornecedor.length === 0 ? (
              <EstadoVazio titulo="Nenhum fornecedor com boletos nesta empresa" descricao="Troque a empresa no topo para ver os demais." />
            ) : (
              <div className="overflow-hidden rounded-lg border border-border bg-surface">
                <CabecalhoListaFornecedores />
                <ul className="divide-y divide-border-subtle">
                  {porFornecedor.map((r) => (
                    <li key={r.fornecedor.id}>
                      <CartaoFornecedor resumo={r} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
