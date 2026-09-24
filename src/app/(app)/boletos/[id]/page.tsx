import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Info, Pencil } from 'lucide-react';
import { LinkBotao } from '@/components/ui/botao';
import { Cartao } from '@/components/ui/cartao';
import { LinhaDetalhe, ListaDetalhes } from '@/components/ui/lista-detalhes';
import { LinkVoltar } from '@/components/ui/link-voltar';
import { SeloStatus } from '@/components/ui/selo-status';
import { Valor } from '@/components/ui/valor';
import { listarSerie, obterLancamento } from '@/features/lancamentos/consultas';
import { BotaoCopiarCodigo } from '@/features/lancamentos/componentes/botao-copiar-codigo';
import { BotaoExcluir } from '@/features/lancamentos/componentes/botao-excluir';
import { BotaoPagamento } from '@/features/lancamentos/componentes/botao-pagamento';
import { BotaoTrocarContaDoPagamento } from '@/features/lancamentos/componentes/conta-do-pagamento';
import { rotuloConta } from '@/lib/domain/saldos';
import { ListaSerie } from '@/features/lancamentos/componentes/lista-serie';
import { infoSerie } from '@/features/lancamentos/serie';
import { ComprasDaFatura } from '@/features/cartoes/componentes/compras-da-fatura';
import { DialogoAjusteFatura } from '@/features/cartoes/componentes/dialogo-ajuste-fatura';
import { listarParcelasDaFatura, obterCartao } from '@/features/cartoes/consultas';
import { exigirUsuario } from '@/lib/auth/sessao';
import { formatarCnpj } from '@/lib/domain/cnpj';
import { formatarCodigo } from '@/lib/domain/codigo-barras';
import { formatarData, formatarDataHora, formatarMes, hojeISO } from '@/lib/domain/datas';
import { somarCentavos } from '@/lib/domain/dinheiro';
import { calcularStatus } from '@/lib/domain/status';
import { cn } from '@/lib/utils/cn';
import { idDaRota } from '@/lib/parametros';

export const metadata: Metadata = { title: 'Boleto' };

export default async function PaginaBoleto({ params }: PageProps<'/boletos/[id]'>) {
  const id = idDaRota((await params).id);
  const { supabase } = await exigirUsuario();
  const lancamento = await obterLancamento(supabase, id);
  if (!lancamento) notFound();

  const hoje = hojeISO();
  const status = calcularStatus(lancamento, hoje);
  const serie = lancamento.recorrencia ? await listarSerie(supabase, lancamento.recorrencia.serieId) : [];
  const info = infoSerie(lancamento, serie);
  const fatura = lancamento.fatura;
  const [cartao, parcelas] = fatura
    ? await Promise.all([obterCartao(supabase, fatura.cartaoId), listarParcelasDaFatura(supabase, fatura.cartaoId, fatura.mes)])
    : [null, []];
  const somaParcelas = somarCentavos(parcelas.map((p) => p.valorCentavos));

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4">
        <LinkVoltar href="/boletos">Boletos</LinkVoltar>
      </div>

      <Cartao className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/fornecedores/${lancamento.fornecedor.id}`} className="text-sm font-medium text-primary-text hover:underline">
              {lancamento.fornecedor.nome}
            </Link>
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-fg break-words">{lancamento.descricao}</h1>
          </div>
          <SeloStatus status={status} />
        </div>

        <Valor centavos={lancamento.valorCentavos} className="mt-4 block text-[34px] leading-none font-semibold tracking-tight" />
        <p className="mt-2 text-[15px] text-fg-2">
          Vencimento:{' '}
          <span className={cn('numeros font-medium', status === 'atrasado' ? 'text-danger' : 'text-fg')}>{formatarData(lancamento.vencimento)}</span>
          {fatura && <span className="text-fg-3"> · Fatura {formatarMes(fatura.mes)}</span>}
          {lancamento.recorrencia && (
            <span className="text-fg-3">
              {' '}
              · Parcela {lancamento.recorrencia.parcela}/{lancamento.recorrencia.totalParcelas}
            </span>
          )}
        </p>

        {lancamento.codigoBarras && (
          <div className="mt-5">
            <p className="mb-1.5 text-sm text-fg-3">Código de barras / linha digitável</p>
            <p className="rounded-md border border-border bg-surface-2 p-3 font-mono text-[15px] leading-relaxed break-words select-all" data-testid="codigo-completo">
              {formatarCodigo(lancamento.codigoBarras)}
            </p>
          </div>
        )}

        <div className="mt-5 grid gap-2">
          {status !== 'pago' && <BotaoCopiarCodigo lancamentoId={lancamento.id} codigo={lancamento.codigoBarras} />}
          <BotaoPagamento
            lancamentoId={lancamento.id}
            empresaId={lancamento.empresa.id}
            conta={lancamento.conta}
            pago={status === 'pago'} tamanho="lg" className="w-full" />
        </div>

        <ListaDetalhes className="mt-5 border-t border-border">
          <LinhaDetalhe rotulo="Empresa">
            {lancamento.empresa.apelido}
            {lancamento.empresa.cnpj && <span className="numeros block text-[13px] text-fg-3">CNPJ {formatarCnpj(lancamento.empresa.cnpj)}</span>}
          </LinhaDetalhe>
          <LinhaDetalhe rotulo="Categoria">{lancamento.categoria.nome}</LinhaDetalhe>
          <LinhaDetalhe rotulo={status === 'pago' ? 'Pago pela conta' : 'Debitar da conta'}>
            <span className="inline-flex flex-wrap items-center justify-end gap-2" data-testid="detalhe-conta">
              {lancamento.conta ? (
                <Link href={`/contas/${lancamento.conta.id}`} className="font-medium text-primary-text hover:underline">
                  {rotuloConta(lancamento.conta)}
                </Link>
              ) : (
                <span className="text-fg-3">Não definida</span>
              )}
              {status === 'pago' && (
                <BotaoTrocarContaDoPagamento lancamentoId={lancamento.id} empresaId={lancamento.empresa.id} contaId={lancamento.conta?.id ?? null} />
              )}
            </span>
          </LinhaDetalhe>
          {fatura && (
            <LinhaDetalhe rotulo="Cartão">
              <Link href={`/cartoes/${fatura.cartaoId}`} className="font-medium text-primary-text hover:underline">
                {cartao?.nome ?? 'Ver cartão'}
                {cartao?.final ? ` •••• ${cartao.final}` : ''}
              </Link>
            </LinhaDetalhe>
          )}
          <LinhaDetalhe rotulo="Status">
            <SeloStatus status={status} />
          </LinhaDetalhe>
          {lancamento.pagoEm && <LinhaDetalhe rotulo="Pago em">{formatarDataHora(lancamento.pagoEm)}</LinhaDetalhe>}
          {lancamento.observacao && (
            <LinhaDetalhe rotulo="Observação">
              <span className="whitespace-pre-wrap">{lancamento.observacao}</span>
            </LinhaDetalhe>
          )}
          <LinhaDetalhe rotulo="Cadastrado em">{formatarDataHora(lancamento.createdAt)}</LinhaDetalhe>
        </ListaDetalhes>

        <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-5">
          {fatura ? (
            <>
              {status !== 'pago' && (
                <DialogoAjusteFatura
                  lancamentoId={lancamento.id}
                  ajusteAtual={fatura.ajusteCentavos}
                  observacaoAtual={lancamento.observacao}
                  somaParcelas={somaParcelas}
                />
              )}
              {parcelas.length === 0 && <BotaoExcluir lancamentoId={lancamento.id} descricao={lancamento.descricao} serie={null} />}
            </>
          ) : (
            <>
              <LinkBotao href={`/boletos/${lancamento.id}/editar`} variante="secundario" icone={<Pencil className="size-4.5" aria-hidden="true" />}>
                Editar
              </LinkBotao>
              <BotaoExcluir lancamentoId={lancamento.id} descricao={lancamento.descricao} serie={info} />
            </>
          )}
        </div>
        {fatura && (
          <p className="mt-3 flex gap-2 text-[13px] text-fg-3">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {status === 'pago'
              ? 'Fatura paga: as compras dela ficam travadas. Desfaça o pagamento para alterá-las.'
              : 'O valor da fatura é a soma das parcelas das compras mais o ajuste. Para mudar, edite as compras ou ajuste o valor.'}
          </p>
        )}
      </Cartao>

      {fatura && (
        <ComprasDaFatura
          parcelas={parcelas}
          somaParcelas={somaParcelas}
          ajusteCentavos={fatura.ajusteCentavos}
          totalCentavos={lancamento.valorCentavos}
        />
      )}

      {serie.length > 0 && <ListaSerie serie={serie} atualId={lancamento.id} hoje={hoje} />}
    </div>
  );
}
