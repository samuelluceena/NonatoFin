import Link from 'next/link';
import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, CircleAlert, Landmark } from 'lucide-react';
import { LinkBotao } from '@/components/ui/botao';
import { Selo } from '@/components/ui/selo';
import { Valor } from '@/components/ui/valor';
import type { Centavos } from '@/lib/domain/dinheiro';
import { cn } from '@/lib/utils/cn';

interface Props {
  /** Quantidade de contas ativas (0 = ainda não há contas). */
  quantidadeContas: number;
  saldoCentavos: Centavos;
  aPagar: { totalCentavos: Centavos; detalhe: string; href: string };
  cobertura: { cobre: boolean; faltaCentavos: Centavos };
  atrasados: { totalCentavos: Centavos; quantidade: number; detalhe: string; href: string };
}

/**
 * Topo do Dashboard: o saldo disponível é o número principal da tela; logo
 * abaixo, o que ele precisa cobrir até o fim do mês e os atrasados.
 * Só apresentação: todos os valores chegam calculados.
 */
export function DestaqueSaldo({ quantidadeContas, saldoCentavos, aPagar, cobertura, atrasados }: Props) {
  const temContas = quantidadeContas > 0;
  return (
    <section aria-label="Situação atual">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-medium text-fg-2 [&_svg]:size-4 [&_svg]:shrink-0">
            <Landmark aria-hidden="true" />
            Saldo disponível
          </p>
          {temContas ? (
            <>
              <p
                className={cn(
                  'mt-1 text-display font-semibold tracking-tight sm:text-5xl',
                  saldoCentavos < 0 ? 'text-danger' : 'text-fg',
                )}
                data-testid="kpi-saldo"
              >
                <Valor centavos={saldoCentavos} />
              </p>
              <p className="mt-1 text-meta text-fg-3">
                {quantidadeContas} {quantidadeContas === 1 ? 'conta ativa' : 'contas ativas'}
              </p>
            </>
          ) : (
            <div className="mt-2 flex flex-col items-start gap-3">
              <p className="text-body text-fg-2">Cadastre as contas bancárias para acompanhar o saldo aqui.</p>
              <LinkBotao href="/contas/nova" variante="secundario" tamanho="sm">
                Cadastrar conta
              </LinkBotao>
            </div>
          )}
        </div>
        {temContas && (
          <div className="flex flex-wrap gap-2">
            <Link
              href="/contas"
              className={cn(
                'inline-flex h-11 items-center gap-2 rounded-full border border-border-strong bg-surface px-4 text-sm font-medium text-fg lg:h-10',
                'transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                '[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-fg-3',
              )}
            >
              <Landmark aria-hidden="true" />
              Contas
            </Link>
          </div>
        )}
      </div>

      <div className="mt-6 grid border-y border-border sm:grid-cols-2 sm:divide-x sm:divide-border">
        <LinhaSituacao
          rotulo="A pagar até o fim do mês"
          href={aPagar.href}
          valor={<Valor centavos={aPagar.totalCentavos} />}
          testId="kpi-ate-fim-do-mes"
          detalhe={aPagar.detalhe}
          extra={
            temContas &&
            (cobertura.cobre ? (
              <Selo tom="sucesso" data-testid="cobertura-mes">
                <CheckCircle2 aria-hidden="true" /> Saldo cobre
              </Selo>
            ) : (
              <Selo tom="aviso" data-testid="cobertura-mes">
                <CircleAlert aria-hidden="true" /> Faltam <Valor centavos={cobertura.faltaCentavos} />
              </Selo>
            ))
          }
        />
        <LinhaSituacao
          rotulo="Atrasados"
          icone={atrasados.quantidade > 0 ? <AlertTriangle className="text-danger" aria-hidden="true" /> : undefined}
          href={atrasados.href}
          valor={<Valor centavos={atrasados.totalCentavos} />}
          perigo={atrasados.totalCentavos > 0}
          testId="kpi-atrasados"
          detalhe={atrasados.detalhe}
          className="border-t border-border sm:border-t-0"
        />
      </div>
    </section>
  );
}

function LinhaSituacao({
  rotulo,
  icone,
  href,
  valor,
  perigo = false,
  testId,
  detalhe,
  extra,
  className,
}: {
  rotulo: string;
  icone?: ReactNode;
  href: string;
  valor: ReactNode;
  perigo?: boolean;
  testId: string;
  detalhe: string;
  extra?: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group flex min-w-0 items-center justify-between gap-3 py-4 focus-visible:-outline-offset-2 sm:px-4 sm:first:pl-0 sm:last:pr-0',
        className,
      )}
    >
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-meta font-medium text-fg-3 [&_svg]:size-3.5 [&_svg]:shrink-0">
          {icone}
          {rotulo}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <p className={cn('text-xl leading-7 font-semibold tracking-tight', perigo ? 'text-danger' : 'text-fg')} data-testid={testId}>
            {valor}
          </p>
          {extra}
        </div>
        <p className="mt-0.5 text-meta text-fg-2">{detalhe}</p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-fg-3 transition-[color,transform] duration-150 group-hover:translate-x-0.5 group-hover:text-fg" aria-hidden="true" />
    </Link>
  );
}
