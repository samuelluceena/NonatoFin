import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { LinkVoltar } from '@/components/ui/link-voltar';
import { Valor } from '@/components/ui/valor';
import { AvisoSemEmpresa } from '@/features/empresas/componentes/aviso-sem-empresa';
import { obterContextoEmpresas } from '@/features/empresas/consultas';
import { TextoFechamento } from '@/features/fechamento/componentes/texto-fechamento';
import { carregarFechamento } from '@/features/fechamento/consultas';
import { exigirUsuario } from '@/lib/auth/sessao';
import { formatarData, formatarDataCurta, hojeISO, nomeDiaDaSemana } from '@/lib/domain/datas';
import { somarCentavos } from '@/lib/domain/dinheiro';
import { montarTextoFechamento } from '@/lib/domain/fechamento';
import { linkDaLista } from '@/lib/domain/filtros';

export const metadata: Metadata = { title: 'Fechar o dia' };

/**
 * "Fechar o dia": gera o texto do fechamento (saldos, pagas, pendentes e
 * próximo dia útil) para copiar ou enviar no WhatsApp. Não grava nada.
 */
export default async function PaginaFecharDia() {
  const { supabase } = await exigirUsuario();
  const { empresas, selecionada } = await obterContextoEmpresas();
  if (empresas.length === 0) return <AvisoSemEmpresa />;
  const hoje = hojeISO();
  const { dados, truncado } = await carregarFechamento(supabase, hoje, selecionada, !selecionada && empresas.length > 1);
  const texto = montarTextoFechamento(dados);
  const totalPendentes = somarCentavos(dados.pendentes.map((p) => p.valorCentavos));

  return (
    <>
      <CabecalhoPagina
        titulo="Fechar o dia"
        voltar={<LinkVoltar href="/">Hoje</LinkVoltar>}
        subtitulo={
          <>
            {formatarData(hoje)} · próximo dia útil: {nomeDiaDaSemana(dados.proximoDiaUtil)}, {formatarDataCurta(dados.proximoDiaUtil)}
          </>
        }
      />

      {dados.pendentes.length > 0 && (
        <Link
          href={linkDaLista({ periodo: { tipo: 'intervalo', de: '', ate: hoje }, status: 'em-aberto' })}
          className="mb-4 flex items-start gap-2.5 rounded-lg border border-warning-border bg-warning-soft px-4 py-3 text-sm text-warning"
          data-testid="aviso-pendentes"
        >
          <AlertTriangle className="mt-0.5 size-4.5 shrink-0" aria-hidden="true" />
          <span>
            {dados.pendentes.length === 1 ? '1 conta que vence até hoje ainda não foi paga' : `${dados.pendentes.length} contas que vencem até hoje ainda não foram pagas`} (
            <Valor centavos={totalPendentes} />
            ). Se já pagou, marque como paga antes de enviar. <span className="font-medium underline underline-offset-2">Ver na lista</span>
          </span>
        </Link>
      )}
      {truncado && (
        <p className="mb-4 text-sm text-warning">Há lançamentos demais para um dia; o texto mostra só os primeiros de cada grupo.</p>
      )}

      <p className="mb-3 text-sm text-fg-2">Confira o texto e envie. Nada é gravado: se algo mudar, é só abrir de novo.</p>
      <TextoFechamento texto={texto} />
    </>
  );
}
