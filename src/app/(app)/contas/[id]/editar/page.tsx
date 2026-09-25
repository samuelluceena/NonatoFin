import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { BotaoConfirmar } from '@/components/ui/botao-confirmar';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
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
    <div className="mx-auto max-w-xl">
      <CabecalhoPagina
        voltar={<LinkVoltar href={`/contas/${conta.id}`}>{conta.apelido}</LinkVoltar>}
        titulo="Editar conta"
        subtitulo={
          <>
            {conta.banco}
            {conta.final && <span className="numeros"> •••• {conta.final}</span>} · {conta.empresa.apelido}
          </>
        }
      />
      <>
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
      </>
      {/* Ação destrutiva longe do Salvar, numa seção própria. */}
      <section aria-labelledby="titulo-excluir-conta" className="mt-12 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <h2 id="titulo-excluir-conta" className="text-body font-semibold text-fg">
            Excluir conta
          </h2>
          <p className="mt-1 text-meta text-fg-3">
            Só é possível excluir contas sem lançamentos ou cartões ligados. Se a conta já foi usada, desmarque “Conta ativa” acima.
          </p>
        </div>
        <BotaoConfirmar
          rotulo="Excluir conta"
          icone={<Trash2 className="size-4.5 text-danger" aria-hidden="true" />}
          titulo="Excluir conta?"
          descricao={`A conta “${conta.apelido}” e seu extrato serão excluídos. Só é possível excluir contas que não estão ligadas a lançamentos ou cartões — nesse caso, desative-a.`}
          acao={excluirConta.bind(null, conta.id)}
          destino="/contas"
          textoConfirmar="Excluir"
          perigo
          testId="excluir-conta"
        />
      </section>
    </div>
  );
}
