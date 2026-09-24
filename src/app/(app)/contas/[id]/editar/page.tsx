import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { BotaoConfirmar } from '@/components/ui/botao-confirmar';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { Cartao } from '@/components/ui/cartao';
import { LinkVoltar } from '@/components/ui/link-voltar';
import { excluirConta } from '@/features/contas/acoes';
import { FormularioConta } from '@/features/contas/componentes/formulario-conta';
import { obterConta } from '@/features/contas/consultas';
import { obterContextoEmpresas } from '@/features/empresas/consultas';
import { exigirUsuario } from '@/lib/auth/sessao';
import { idDaRota } from '@/lib/parametros';

export const metadata: Metadata = { title: 'Editar conta' };

export default async function PaginaEditarConta({ params }: PageProps<'/contas/[id]/editar'>) {
  const id = idDaRota((await params).id);
  const { supabase } = await exigirUsuario();
  const [conta, { empresas }] = await Promise.all([obterConta(supabase, id), obterContextoEmpresas()]);
  if (!conta) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <CabecalhoPagina voltar={<LinkVoltar href={`/contas/${conta.id}`}>{conta.apelido}</LinkVoltar>} titulo="Editar conta" />
      <Cartao className="p-4 sm:p-6">
        <FormularioConta
          edicaoId={conta.id}
          empresas={empresas}
          valoresIniciais={{
            empresaId: conta.empresa.id,
            apelido: conta.apelido,
            banco: conta.banco,
            final: conta.final ?? '',
            padrao: conta.padrao,
            ativa: conta.ativa,
            saldoInicialCentavos: 0,
          }}
        />
      </Cartao>
      <div className="mt-6 flex justify-end">
        <BotaoConfirmar
          rotulo="Excluir"
          icone={<Trash2 className="size-4.5 text-danger" aria-hidden="true" />}
          titulo="Excluir conta?"
          descricao={`A conta “${conta.apelido}” e seu extrato serão excluídos. Só é possível excluir contas que não estão ligadas a lançamentos ou cartões — nesse caso, desative-a.`}
          acao={excluirConta.bind(null, conta.id)}
          destino="/contas"
          textoConfirmar="Excluir"
          perigo
          testId="excluir-conta"
        />
      </div>
    </div>
  );
}
