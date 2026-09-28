import type { Metadata } from 'next';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { LinkVoltar } from '@/components/ui/link-voltar';
import { FormularioConta } from '@/features/contas/componentes/formulario-conta';
import { listarTodasAsContas } from '@/features/contas/consultas';
import { AvisoSemEmpresa } from '@/features/empresas/componentes/aviso-sem-empresa';
import { obterContextoEmpresas } from '@/features/empresas/consultas';
import { exigirUsuario } from '@/lib/auth/sessao';

export const metadata: Metadata = { title: 'Nova conta' };

export default async function PaginaNovaConta() {
  await exigirUsuario();
  const [{ empresas, selecionada }, contas] = await Promise.all([obterContextoEmpresas(), listarTodasAsContas()]);
  const empresaInicial = selecionada?.id ?? (empresas.length === 1 ? empresas[0].id : '');
  // A primeira conta da empresa já nasce como padrão.
  const primeiraDaEmpresa = empresaInicial !== '' && !contas.some((c) => c.empresa.id === empresaInicial);

  return (
    <div className="mx-auto max-w-xl">
      <CabecalhoPagina
        voltar={<LinkVoltar href="/contas">Contas</LinkVoltar>}
        titulo="Nova conta bancária"
        subtitulo="De onde saem os pagamentos de uma empresa."
      />
      {empresas.length === 0 ? (
        <AvisoSemEmpresa />
      ) : (
        <>
          <FormularioConta
            empresas={empresas}
            empresasComConta={[...new Set(contas.map((c) => c.empresa.id))]}
            valoresIniciais={{
              empresaId: empresaInicial,
              apelido: '',
              banco: '',
              final: '',
              padrao: primeiraDaEmpresa,
              ativa: true,
              saldoInicialCentavos: 0,
            }}
          />
        </>
      )}
    </div>
  );
}
