import type { Metadata } from 'next';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { Cartao } from '@/components/ui/cartao';
import { FormularioLancamento } from '@/features/lancamentos/componentes/formulario-lancamento';
import { AvisoSemEmpresa } from '@/features/empresas/componentes/aviso-sem-empresa';
import { listarTodasAsContas } from '@/features/contas/consultas';
import { listarCategorias, obterContextoEmpresas } from '@/features/empresas/consultas';
import { listarFornecedores } from '@/features/fornecedores/consultas';
import { exigirUsuario } from '@/lib/auth/sessao';
import { ehDataISOValida } from '@/lib/domain/datas';
import { contaPadraoDaEmpresa } from '@/lib/domain/saldos';

export const metadata: Metadata = { title: 'Novo boleto' };

export default async function PaginaNovoBoleto({ searchParams }: PageProps<'/boletos/novo'>) {
  const { supabase } = await exigirUsuario();
  const params = await searchParams;
  const [fornecedores, { empresas, selecionada }, categorias, contas] = await Promise.all([
    listarFornecedores(supabase),
    obterContextoEmpresas(),
    listarCategorias(),
    listarTodasAsContas(),
  ]);
  const empresaPadrao = selecionada?.id ?? (empresas.length === 1 ? empresas[0].id : '');
  const fornecedorId = typeof params.fornecedor === 'string' ? params.fornecedor : '';
  const fornecedor = fornecedores.find((f) => f.id === fornecedorId);
  const vencimento = typeof params.vencimento === 'string' && ehDataISOValida(params.vencimento) ? params.vencimento : '';

  return (
    <div className="mx-auto max-w-2xl">
      <CabecalhoPagina titulo="Novo boleto" subtitulo="Cadastre um lançamento único ou uma série mensal." />
      {empresas.length === 0 ? (
        <AvisoSemEmpresa />
      ) : (
        <Cartao className="p-4 sm:p-6">
          <FormularioLancamento
            fornecedores={fornecedores}
            empresas={empresas}
            categorias={categorias}
            contas={contas}
            valoresIniciais={{
              empresaId: empresaPadrao,
              categoriaId: categorias[0]?.id ?? '',
              contaId: contaPadraoDaEmpresa(contas, empresaPadrao),
              fornecedorNome: fornecedor?.nome ?? '',
              vencimento,
            }}
          />
        </Cartao>
      )}
    </div>
  );
}
