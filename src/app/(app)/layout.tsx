import { redirect } from 'next/navigation';
import { BarraInferior } from '@/components/layout/barra-inferior';
import { CabecalhoMobile } from '@/components/layout/cabecalho-mobile';
import { MenuLateral } from '@/components/layout/menu-lateral';
import { contasAConferirHoje } from '@/features/contas/consultas';
import { obterContextoEmpresas } from '@/features/empresas/consultas';
import { DialogoContaDoPagamento } from '@/features/lancamentos/componentes/conta-do-pagamento';
import { exigirUsuario } from '@/lib/auth/sessao';

/**
 * Layout das páginas autenticadas. Além do proxy, valida a sessão aqui
 * (defesa em profundidade): sem usuário, redireciona para /login.
 * No primeiro acesso do dia, exige a conferência dos saldos (/conferir-saldos).
 */
export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const { usuario } = await exigirUsuario();
  if ((await contasAConferirHoje()).length > 0) redirect('/conferir-saldos');
  const { empresas, selecionada } = await obterContextoEmpresas();
  const empresasSeletor = empresas.map((e) => ({ id: e.id, apelido: e.apelido }));
  const selecionadaId = selecionada?.id ?? null;

  return (
    <div className="flex min-h-dvh">
      <MenuLateral email={usuario.email} empresas={empresasSeletor} selecionadaId={selecionadaId} />
      <div className="flex min-w-0 flex-1 flex-col">
        <CabecalhoMobile empresas={empresasSeletor} selecionadaId={selecionadaId} />
        <main id="conteudo" className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-28 sm:px-6 lg:px-10 lg:pt-10 lg:pb-12">
          {children}
        </main>
      </div>
      <BarraInferior />
      <DialogoContaDoPagamento />
    </div>
  );
}
