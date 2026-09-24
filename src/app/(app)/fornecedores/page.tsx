import type { Metadata } from 'next';
import { Building2 } from 'lucide-react';
import { BarrasFornecedores } from '@/components/graficos/barras-fornecedores';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { Cartao, TituloSecao } from '@/components/ui/cartao';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { carregarBaseRelatorios } from '@/features/dashboard/dados';
import { BotaoNovoFornecedor } from '@/features/fornecedores/componentes/botao-novo-fornecedor';
import { CartaoFornecedor } from '@/features/fornecedores/componentes/cartao-fornecedor';
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
          icone={<Building2 />}
          titulo="Nenhum fornecedor cadastrado"
          descricao="Fornecedores também são criados automaticamente ao cadastrar um boleto."
        />
      ) : (
        <div className="flex flex-col gap-6">
          <section aria-labelledby="titulo-comparativo">
            <TituloSecao id="titulo-comparativo" className="mb-2 px-1">
              Comparativo
            </TituloSecao>
            <Cartao className="p-4 sm:p-5">
              <BarrasFornecedores resumos={porFornecedor} limite={10} />
            </Cartao>
          </section>

          <section aria-labelledby="titulo-lista-fornecedores">
            <TituloSecao id="titulo-lista-fornecedores" className="mb-2 px-1">
              Por fornecedor
            </TituloSecao>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {porFornecedor.map((r) => (
                <CartaoFornecedor key={r.fornecedor.id} resumo={r} />
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
