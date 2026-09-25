/**
 * Lista de transações: no celular/tablet, linhas agrupadas por dia (toque
 * abre o detalhe existente); a partir de 1280px, uma tabela financeira densa
 * com as ações secundárias no menu de três pontos.
 *
 * Cor é só reforço: cada item tem ícone e rótulo do tipo, status com texto e
 * valor com sinal (+/−) — ver `tomDoValor`/`textoDoValor` em lib/domain.
 */
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Scale,
  type LucideIcon,
} from 'lucide-react';
import { MenuAcoes } from '@/components/ui/menu-acoes';
import { CabecalhoTabela, CorpoTabela, LinhaTabela, Tabela, Td, Th } from '@/components/ui/tabela';
import { Selo, type TomSelo } from '@/components/ui/selo';
import { formatarData, type DataISO } from '@/lib/domain/datas';
import { rotuloConta } from '@/lib/domain/saldos';
import {
  ROTULO_STATUS_TRANSACAO,
  ROTULO_TIPO,
  agruparPorData,
  textoDoValor,
  tomDoValor,
  valorPorExtenso,
  type StatusTransacao,
  type TipoTransacao,
  type Transacao,
} from '@/lib/domain/transacoes';
import { cn } from '@/lib/utils/cn';
import { rotuloDia } from '@/features/lancamentos/componentes/lista-lancamentos';

const ICONE_TIPO: Record<TipoTransacao, LucideIcon> = {
  entrada: ArrowDownLeft,
  'conta-a-pagar': CalendarClock,
  pagamento: ArrowUpRight,
  transferencia: ArrowLeftRight,
  ajuste: Scale,
  'compra-cartao': CreditCard,
};

/** Fundo do ícone: forte só para o que já movimentou dinheiro. */
function classeIcone(t: Transacao): string {
  const tom = tomDoValor(t);
  if (tom === 'entrada') return 'border-success-border bg-success-soft text-success';
  if (tom === 'saida') return 'border-danger-border bg-danger-soft text-danger';
  if (t.status === 'atrasado') return 'border-danger-border bg-surface text-danger';
  if (t.tipo === 'transferencia') return 'border-transparent bg-primary-soft text-primary-soft-fg';
  return 'border-border bg-surface-2 text-fg-2';
}

const CLASSE_VALOR = { entrada: 'text-success', saida: 'text-danger', neutro: 'text-fg' } as const;

const ESTILO_STATUS: Record<StatusTransacao, { icone: LucideIcon; tom: TomSelo }> = {
  pendente: { icone: Clock, tom: 'info' },
  atrasado: { icone: AlertTriangle, tom: 'perigo' },
  pago: { icone: CheckCircle2, tom: 'sucesso' },
  previsto: { icone: CalendarClock, tom: 'aviso' },
  confirmado: { icone: Check, tom: 'neutro' },
  'na-fatura': { icone: CreditCard, tom: 'neutro' },
};

export function SeloTransacao({ status, className }: { status: StatusTransacao; className?: string }) {
  const { icone: Icone, tom } = ESTILO_STATUS[status];
  return (
    <Selo tom={tom} data-status={status} className={className}>
      <Icone aria-hidden="true" />
      {ROTULO_STATUS_TRANSACAO[status]}
    </Selo>
  );
}

function IconeTipo({ t, className }: { t: Transacao; className?: string }) {
  const Icone = ICONE_TIPO[t.tipo];
  return (
    <span className={cn('grid size-9 shrink-0 place-items-center rounded-md border [&_svg]:size-4.5', classeIcone(t), className)} aria-hidden="true">
      <Icone />
    </span>
  );
}

function ValorTransacao({ t, className }: { t: Transacao; className?: string }) {
  // Obrigação/previsão: cor mais discreta (o dinheiro ainda não se moveu).
  const cor = t.efetivo || t.sinal === 0 ? CLASSE_VALOR[tomDoValor(t)] : 'text-fg-2';
  return (
    <span className={cn('numeros font-semibold whitespace-nowrap', cor, className)}>
      <span aria-hidden="true">{textoDoValor(t)}</span>
      <span className="sr-only">{valorPorExtenso(t)}</span>
    </span>
  );
}

/** Conta exibida: origem → destino nas transferências. */
function textoConta(t: Transacao): string | null {
  if (t.tipo === 'transferencia') return t.complemento;
  return t.conta ? rotuloConta(t.conta) : null;
}

function itensDoMenu(t: Transacao) {
  return [{ rotulo: 'Ver detalhes', href: t.href }, ...t.links.filter((l) => l.href !== t.href)];
}

interface Props {
  itens: Transacao[];
  hoje: DataISO;
  /** Mostrar a empresa em cada item (seletor do topo em "Todas" com 2+ empresas). */
  mostrarEmpresa: boolean;
}

export function ListaTransacoes({ itens, hoje, mostrarEmpresa }: Props) {
  return (
    <>
      <ListaCompacta itens={itens} hoje={hoje} mostrarEmpresa={mostrarEmpresa} />
      <TabelaTransacoes itens={itens} mostrarEmpresa={mostrarEmpresa} />
    </>
  );
}

/** Celular e tablet: agrupada por dia, cada linha abre o detalhe. */
function ListaCompacta({ itens, hoje, mostrarEmpresa }: Props) {
  return (
    <div className="flex flex-col gap-5 xl:hidden" data-testid="lista-transacoes">
      {agruparPorData(itens).map((grupo) => (
        <section key={grupo.data} aria-label={rotuloDia(grupo.data, hoje)}>
          <h2 className="mb-2 px-1 text-sm font-medium text-fg-2">{rotuloDia(grupo.data, hoje)}</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
            {grupo.itens.map((t) => {
              const meta = [ROTULO_TIPO[t.tipo], t.categoria?.nome, textoConta(t), mostrarEmpresa ? t.empresa?.apelido : null].filter(Boolean);
              return (
                <li key={t.chave}>
                  <Link
                    href={t.href}
                    className="flex min-h-16 items-center gap-3 px-3.5 py-3 transition-colors hover:bg-surface-2 focus-visible:-outline-offset-2"
                    data-testid="item-transacao"
                    data-tipo={t.tipo}
                  >
                    <IconeTipo t={t} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-body font-medium text-fg">{t.titulo}</span>
                        <ValorTransacao t={t} className="text-body" />
                      </span>
                      {t.descricao && <span className="mt-0.5 block truncate text-meta text-fg-2">{t.descricao}</span>}
                      <span className="mt-1 flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-meta text-fg-3">{meta.join(' · ')}</span>
                        <SeloTransacao status={t.status} className="shrink-0" />
                      </span>
                      {t.complemento && t.tipo !== 'transferencia' && <span className="mt-0.5 block truncate text-xs text-fg-3">{t.complemento}</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Desktop largo: tabela densa (primitivas compartilhadas de components/ui/tabela). */
function TabelaTransacoes({ itens, mostrarEmpresa }: Omit<Props, 'hoje'>) {
  return (
    <Tabela legenda="Transações" className="hidden xl:block" data-testid="tabela-transacoes">
      <CabecalhoTabela>
        <tr>
          <Th className="w-[6.5rem]">Data</Th>
          <Th>Descrição</Th>
          <Th className="w-[8.5rem]">Categoria</Th>
          <Th className="w-[9rem]">Conta</Th>
          <Th className="w-[8.5rem]">Tipo</Th>
          <Th className="w-[7rem]">Status</Th>
          <Th numerica className="w-[8.5rem]">
            Valor
          </Th>
          <Th className="w-12">
            <span className="sr-only">Ações</span>
          </Th>
        </tr>
      </CabecalhoTabela>
      <CorpoTabela>
        {itens.map((t) => {
          const Icone = ICONE_TIPO[t.tipo];
          return (
            <LinhaTabela key={t.chave} data-testid="linha-transacao" data-tipo={t.tipo}>
              <Td className="numeros text-fg-2">{formatarData(t.data)}</Td>
              <Td>
                <Link href={t.href} className="block truncate font-medium text-fg hover:text-primary-text hover:underline">
                  {t.titulo}
                </Link>
                <span className="block truncate text-meta text-fg-3">
                  {[t.descricao, t.tipo === 'transferencia' ? null : t.complemento, mostrarEmpresa ? t.empresa?.apelido : null].filter(Boolean).join(' · ') || '—'}
                </span>
              </Td>
              <Td className="truncate text-fg-2">{t.categoria?.nome ?? <span className="text-fg-3">—</span>}</Td>
              <Td className="truncate text-fg-2" title={textoConta(t) ?? undefined}>
                {textoConta(t) ?? <span className="text-fg-3">—</span>}
              </Td>
              <Td>
                <span className="inline-flex items-center gap-1.5 text-fg-2">
                  <Icone className={cn('size-4 shrink-0', tomDoValor(t) === 'entrada' && 'text-success', tomDoValor(t) === 'saida' && 'text-danger')} aria-hidden="true" />
                  <span className="truncate">{ROTULO_TIPO[t.tipo]}</span>
                </span>
              </Td>
              <Td>
                <SeloTransacao status={t.status} />
              </Td>
              <Td numerica>
                <ValorTransacao t={t} />
              </Td>
              <Td className="py-1.5 text-right">
                <MenuAcoes rotulo={`Ações: ${t.titulo}`} itens={itensDoMenu(t)} />
              </Td>
            </LinhaTabela>
          );
        })}
      </CorpoTabela>
    </Tabela>
  );
}
