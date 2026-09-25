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
import { CorpoTabela, LinhaTabela, Tabela } from '@/components/ui/tabela';
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

const TAMANHO_ICONE = { md: 'size-8 [&_svg]:size-4', sm: 'size-7 [&_svg]:size-3.5' } as const;

function IconeTipo({ t, tamanho = 'md', className }: { t: Transacao; tamanho?: keyof typeof TAMANHO_ICONE; className?: string }) {
  const Icone = ICONE_TIPO[t.tipo];
  return (
    <span className={cn('grid shrink-0 place-items-center rounded-md border', TAMANHO_ICONE[tamanho], classeIcone(t), className)} aria-hidden="true">
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
          <h2 className="mb-1.5 px-1 text-meta font-medium text-fg-3">{rotuloDia(grupo.data, hoje)}</h2>
          <ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border bg-surface">
            {grupo.itens.map((t) => {
              const meta = [ROTULO_TIPO[t.tipo], t.categoria?.nome, textoConta(t), mostrarEmpresa ? t.empresa?.apelido : null].filter(Boolean);
              const complemento = t.tipo === 'transferencia' ? null : t.complemento;
              return (
                <li key={t.chave}>
                  <Link
                    href={t.href}
                    className="flex min-h-16 items-start gap-3 px-3.5 py-3 transition-colors hover:bg-surface-2/60 focus-visible:-outline-offset-2"
                    data-testid="item-transacao"
                    data-tipo={t.tipo}
                  >
                    <IconeTipo t={t} className="mt-0.5" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-body font-medium text-fg">{t.titulo}</span>
                        <ValorTransacao t={t} className="text-body" />
                      </span>
                      <span className="mt-0.5 flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-meta text-fg-2">{[t.descricao, complemento].filter(Boolean).join(' · ')}</span>
                        <SeloTransacao status={t.status} className="shrink-0" />
                      </span>
                      <span className="mt-0.5 block truncate text-meta text-fg-3">{meta.join(' · ')}</span>
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

/** Célula da tabela: mais baixa que o padrão de ui/tabela (≈48px por linha). */
const CELULA = 'px-3 py-2.5 align-middle first:pl-4 last:pr-4';
const CABECALHO = 'px-3 pt-3 pb-2 font-medium first:pl-4 last:pr-4';

/**
 * Desktop largo: tabela financeira densa. O tipo aparece como ícone + texto
 * dentro da descrição (sem coluna própria); valor e status lado a lado.
 */
function TabelaTransacoes({ itens, mostrarEmpresa }: Omit<Props, 'hoje'>) {
  return (
    <Tabela legenda="Transações" className="hidden xl:block" data-testid="tabela-transacoes">
      <thead className="border-b border-border text-left text-caption text-fg-3">
        <tr>
          <th scope="col" className={cn(CABECALHO, 'w-26')}>
            Data
          </th>
          <th scope="col" className={CABECALHO}>
            Descrição
          </th>
          <th scope="col" className={cn(CABECALHO, 'w-36')}>
            Categoria
          </th>
          <th scope="col" className={cn(CABECALHO, 'w-44')}>
            Conta
          </th>
          <th scope="col" className={cn(CABECALHO, 'w-32')}>
            Status
          </th>
          <th scope="col" className={cn(CABECALHO, 'w-36 text-right')}>
            Valor
          </th>
          <th scope="col" className={cn(CABECALHO, 'w-14')}>
            <span className="sr-only">Ações</span>
          </th>
        </tr>
      </thead>
      <CorpoTabela>
        {itens.map((t) => {
          const detalhe = [ROTULO_TIPO[t.tipo], t.descricao, t.tipo === 'transferencia' ? null : t.complemento, mostrarEmpresa ? t.empresa?.apelido : null]
            .filter(Boolean)
            .join(' · ');
          return (
            <LinhaTabela key={t.chave} data-testid="linha-transacao" data-tipo={t.tipo}>
              <td className={cn(CELULA, 'numeros text-fg-2')}>{formatarData(t.data)}</td>
              <td className={CELULA}>
                <div className="flex min-w-0 items-center gap-2.5">
                  <IconeTipo t={t} tamanho="sm" />
                  <div className="min-w-0">
                    <Link href={t.href} className="block truncate font-medium text-fg hover:text-primary-text hover:underline">
                      {t.titulo}
                    </Link>
                    <span className="block truncate text-meta text-fg-3">{detalhe}</span>
                  </div>
                </div>
              </td>
              <td className={cn(CELULA, 'truncate text-fg-2')}>{t.categoria?.nome ?? <span className="text-fg-3">—</span>}</td>
              <td className={cn(CELULA, 'truncate text-fg-2')} title={textoConta(t) ?? undefined}>
                {textoConta(t) ?? <span className="text-fg-3">—</span>}
              </td>
              <td className={CELULA}>
                <SeloTransacao status={t.status} />
              </td>
              <td className={cn(CELULA, 'numeros text-right')}>
                <ValorTransacao t={t} />
              </td>
              <td className={cn(CELULA, 'py-1 text-right')}>
                <MenuAcoes rotulo={`Ações: ${t.titulo}`} itens={itensDoMenu(t)} />
              </td>
            </LinhaTabela>
          );
        })}
      </CorpoTabela>
    </Tabela>
  );
}
