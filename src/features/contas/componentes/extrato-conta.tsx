import Link from 'next/link';
import { CheckCircle2, Clock, Trash2 } from 'lucide-react';
import { BotaoConfirmar } from '@/components/ui/botao-confirmar';
import { formatarData, type DataISO } from '@/lib/domain/datas';
import { formatarMoeda, formatarMoedaComSinal, type Centavos } from '@/lib/domain/dinheiro';
import { rotuloMovimento } from '@/lib/domain/saldos';
import type { MovimentoConta } from '@/lib/domain/tipos';
import { cn } from '@/lib/utils/cn';
import { confirmarEntrada, excluirMovimento, excluirTransferencia } from '../acoes';
import type { PagamentoDaConta } from '../consultas';

interface LinhaExtrato {
  chave: string;
  data: DataISO;
  ordem: string;
  titulo: string;
  detalhe: string | null;
  valorCentavos: Centavos;
  href?: string;
  movimento?: MovimentoConta;
}


/** Junta movimentos (entradas, transferências, conferências) e pagamentos, do mais recente ao mais antigo. */
export function montarExtrato(movimentos: MovimentoConta[], pagamentos: PagamentoDaConta[], historicoCompleto: boolean): LinhaExtrato[] {
  const confirmados = movimentos.filter((m) => m.confirmado);
  const conferencias = confirmados.filter((m) => m.tipo === 'conferencia');
  const primeiraConferencia = historicoCompleto ? conferencias.at(-1)?.id : undefined;
  return [
    ...confirmados.map((m) => ({
      chave: `m-${m.id}`,
      data: m.data,
      ordem: m.createdAt,
      titulo: rotuloMovimento(m, m.id === primeiraConferencia),
      detalhe:
        m.tipo === 'conferencia'
          ? `Saldo no banco: ${formatarMoeda(m.saldoInformado ?? 0)}`
          : m.descricao,
      valorCentavos: m.valorCentavos,
      movimento: m,
    })),
    ...pagamentos.map((p) => ({
      chave: `p-${p.id}`,
      data: p.data,
      ordem: '',
      titulo: p.fornecedor || 'Pagamento',
      detalhe: p.descricao,
      valorCentavos: -p.valorCentavos,
      href: `/boletos/${p.id}`,
    })),
  ].sort((a, b) => b.data.localeCompare(a.data) || b.ordem.localeCompare(a.ordem));
}

function AcaoMovimento({ m }: { m: MovimentoConta }) {
  const lixeira = <Trash2 className="size-4 text-danger" aria-hidden="true" />;
  if (m.tipo === 'transferencia' && m.transferenciaId) {
    return (
      <BotaoConfirmar
        rotulo={<span className="sr-only">Excluir transferência</span>}
        icone={lixeira}
        variante="fantasma"
        tamanho="sm"
        titulo="Excluir transferência?"
        descricao="Os dois lados (saída e entrada) serão excluídos e os saldos voltam ao que eram."
        acao={excluirTransferencia.bind(null, m.transferenciaId)}
        textoConfirmar="Excluir"
        perigo
      />
    );
  }
  return (
    <BotaoConfirmar
      rotulo={<span className="sr-only">Excluir movimento</span>}
      icone={lixeira}
      variante="fantasma"
      tamanho="sm"
      titulo={m.tipo === 'conferencia' ? 'Excluir conferência?' : 'Excluir entrada?'}
      descricao={
        m.tipo === 'conferencia'
          ? 'O ajuste desta conferência será desfeito e o saldo volta ao calculado antes dela.'
          : 'A entrada sai do extrato e do saldo.'
      }
      acao={excluirMovimento.bind(null, m.id)}
      textoConfirmar="Excluir"
      perigo
    />
  );
}

/**
 * Extrato: movimentos e pagamentos, do mais recente ao mais antigo.
 * Celular: data abaixo da descrição; a partir de md: colunas Data · Descrição · Valor.
 */
export function ExtratoConta({ linhas, verTodas }: { linhas: LinhaExtrato[]; verTodas?: { href: string; rotulo: string } }) {
  return (
    <section aria-labelledby="titulo-extrato">
      <div className="mb-2.5 flex min-h-8 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1">
        <h2 id="titulo-extrato" className="text-body font-semibold text-fg">
          Extrato
        </h2>
        {verTodas && (
          <Link href={verTodas.href} className="rounded-sm text-sm font-medium text-primary-text hover:underline">
            {verTodas.rotulo}
          </Link>
        )}
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-surface" data-testid="extrato">
        {linhas.length === 0 ? (
          <p className="p-4 text-sm text-fg-2">Nenhum movimento ainda.</p>
        ) : (
          <div className="hidden items-center gap-4 border-b border-border-subtle px-5 pt-3 pb-2 text-caption font-medium text-fg-3 md:flex" aria-hidden="true">
            <span className="w-14 shrink-0">Data</span>
            <span className="flex-1">Descrição</span>
            <span className="w-32 shrink-0 text-right">Valor</span>
            <span className="w-9 shrink-0" />
          </div>
        )}
        <div className="divide-y divide-border-subtle">
          {linhas.map((l) => {
            const conteudo = (
              <>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5 md:flex-row md:items-center md:gap-4">
                  <span className="numeros order-2 text-meta text-fg-3 md:order-1 md:w-14 md:shrink-0 md:text-sm md:text-fg-2">{formatarData(l.data).slice(0, 5)}</span>
                  <span className="order-1 min-w-0 md:order-2 md:flex-1">
                    <span className="block truncate text-body text-fg group-hover:text-primary-text">{l.titulo}</span>
                    {l.detalhe && <span className="block truncate text-meta text-fg-3">{l.detalhe}</span>}
                  </span>
                </span>
                <span
                  className={cn(
                    'numeros shrink-0 text-right text-body font-medium md:w-32',
                    l.valorCentavos > 0 ? 'text-success' : l.valorCentavos < 0 ? 'text-fg' : 'text-fg-3',
                  )}
                >
                  {formatarMoedaComSinal(l.valorCentavos)}
                </span>
              </>
            );
            return (
              <div key={l.chave} className="flex min-h-14 items-center gap-2 py-2 pr-2 pl-4 md:gap-4 md:pl-5" data-testid="linha-extrato">
                {l.href ? (
                  <Link href={l.href} className="group flex min-w-0 flex-1 items-center gap-3 rounded-sm focus-visible:outline-offset-2 md:gap-4">
                    {conteudo}
                  </Link>
                ) : (
                  <span className="flex min-w-0 flex-1 items-center gap-3 md:gap-4">{conteudo}</span>
                )}
                {l.movimento ? <AcaoMovimento m={l.movimento} /> : <span className="w-9 shrink-0" aria-hidden="true" />}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** Entradas previstas cuja data passou: confirmar (entrou) ou excluir (não entrou). */
export function EntradasAConfirmar({ entradas }: { entradas: MovimentoConta[] }) {
  if (entradas.length === 0) return null;
  return (
    <section aria-labelledby="titulo-a-confirmar" className="overflow-hidden rounded-lg border border-warning-border bg-warning-soft">
      <h2 id="titulo-a-confirmar" className="flex items-center gap-2 px-4 pt-3 pb-1 text-sm font-medium text-fg md:px-5">
        <Clock className="size-4 shrink-0 text-warning" aria-hidden="true" />
        Entradas previstas para confirmar
      </h2>
      <div className="divide-y divide-warning-border">
        {entradas.map((m) => (
          <div key={m.id} className="flex min-h-14 flex-wrap items-center gap-2 px-4 py-2.5 md:px-5" data-testid="entrada-a-confirmar">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body text-fg">{m.descricao ?? 'Entrada prevista'}</span>
              <span className="numeros block text-meta text-fg-2">
                Prevista para {formatarData(m.data)} · {formatarMoeda(m.valorCentavos)}
              </span>
            </span>
            <BotaoConfirmar
              rotulo="Entrou"
              icone={<CheckCircle2 className="size-4 text-success" aria-hidden="true" />}
              tamanho="sm"
              titulo="Confirmar entrada?"
              descricao={`${formatarMoeda(m.valorCentavos)} passa a contar no saldo de hoje.`}
              acao={confirmarEntrada.bind(null, m.id)}
              textoConfirmar="Confirmar"
              testId="confirmar-entrada"
            />
            <AcaoMovimento m={m} />
          </div>
        ))}
      </div>
    </section>
  );
}
