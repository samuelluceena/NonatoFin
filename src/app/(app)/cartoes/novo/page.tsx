import type { Metadata } from 'next';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { LinkVoltar } from '@/components/ui/link-voltar';
import { FormularioCartao } from '@/features/cartoes/componentes/formulario-cartao';
import { categoriaPadrao } from '@/features/cartoes/padroes';
import { AvisoSemEmpresa } from '@/features/empresas/componentes/aviso-sem-empresa';
import { listarTodasAsContas } from '@/features/contas/consultas';
import { listarCategorias, obterContextoEmpresas } from '@/features/empresas/consultas';
import { listarFornecedores } from '@/features/fornecedores/consultas';
import { exigirUsuario } from '@/lib/auth/sessao';
import { hojeISO } from '@/lib/domain/datas';
import { contaPadraoDaEmpresa } from '@/lib/domain/saldos';

export const metadata: Metadata = { title: 'Novo cartão' };

export default async function PaginaNovoCartao() {
  const { supabase } = await exigirUsuario();
  const [fornecedores, { empresas, selecionada }, categorias, contas] = await Promise.all([
    listarFornecedores(supabase),
    obterContextoEmpresas(),
    listarCategorias(),
    listarTodasAsContas(),
  ]);
  const empresaInicial = selecionada?.id ?? (empresas.length === 1 ? empresas[0].id : '');

  return (
    <div className="mx-auto max-w-2xl">
      <CabecalhoPagina titulo="Novo cartão" voltar={<LinkVoltar href="/cartoes">Cartões</LinkVoltar>} subtitulo="As faturas viram lançamentos a pagar da empresa do cartão." />
      {empresas.length === 0 ? (
        <AvisoSemEmpresa />
      ) : (
        <>
          <FormularioCartao
            empresas={empresas}
            categorias={categorias}
            fornecedores={fornecedores}
            contas={contas}
            hoje={hojeISO()}
            valoresIniciais={{
              empresaId: empresaInicial,
              nome: '',
              final: '',
              emissorNome: '',
              diaFechamento: 0,
              diaVencimento: 0,
              categoriaFaturaId: categoriaPadrao(categorias, 'Cartão de crédito'),
              contaId: contaPadraoDaEmpresa(contas, empresaInicial),
              ativo: true,
            }}
          />
        </>
      )}
    </div>
  );
}
