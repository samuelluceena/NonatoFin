import Link from 'next/link';
import { CheckCircle2, Trash2 } from 'lucide-react';
import { BotaoConfirmar } from '@/components/ui/botao-confirmar';
import { Cartao, TituloSecao } from '@/components/ui/cartao';
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

export function ExtratoConta({ linhas }: { linhas: LinhaExtrato[] }) {
  return (
    <section aria-labelledby="titulo-extrato" className="mt-6">
      <TituloSecao id="titulo-extrato" className="mb-2 px-1">
        Extrato
      </TituloSecao>
      <Cartao className="divide-y divide-border" data-testid="extrato">
        {linhas.length === 0 && <p className="p-4 text-sm text-fg-2">Nenhum movimento ainda.</p>}
        {linhas.map((l) => {
          const conteudo = (
            <>
              <span className="numeros w-12 shrink-0 text-meta text-fg-3">{formatarData(l.data).slice(0, 5)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body text-fg">{l.titulo}</span>
                {l.detalhe && <span className="block truncate text-meta text-fg-3">{l.detalhe}</span>}
              </span>
              <span className={cn('numeros shrink-0 text-body font-medium', l.valorCentavos > 0 ? 'text-success' : l.valorCentavos < 0 ? 'text-fg' : 'text-fg-3')}>
                {formatarMoedaComSinal(l.valorCentavos)}
              </span>
            </>
          );
          return (
            <div key={l.chave} className="flex min-h-14 items-center gap-2 px-4 py-2.5" data-testid="linha-extrato">
              {l.href ? (
                <Link href={l.href} className="flex min-w-0 flex-1 items-center gap-3 hover:text-primary-text">
                  {conteudo}
                </Link>
              ) : (
                <span className="flex min-w-0 flex-1 items-center gap-3">{conteudo}</span>
              )}
              {l.movimento ? <AcaoMovimento m={l.movimento} /> : <span className="w-9" aria-hidden="true" />}
            </div>
          );
        })}
      </Cartao>
    </section>
  );
}

/** Entradas previstas cuja data passou: confirmar (entrou) ou excluir (não entrou). */
export function EntradasAConfirmar({ entradas }: { entradas: MovimentoConta[] }) {
  if (entradas.length === 0) return null;
  return (
    <section aria-labelledby="titulo-a-confirmar" className="mt-6">
      <TituloSecao id="titulo-a-confirmar" className="mb-2 px-1">
        Entradas previstas para confirmar
      </TituloSecao>
      <Cartao className="divide-y divide-border">
        {entradas.map((m) => (
          <div key={m.id} className="flex min-h-14 flex-wrap items-center gap-2 px-4 py-2.5" data-testid="entrada-a-confirmar">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body text-fg">{m.descricao ?? 'Entrada prevista'}</span>
              <span className="numeros block text-meta text-fg-3">
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
      </Cartao>
    </section>
  );
}
