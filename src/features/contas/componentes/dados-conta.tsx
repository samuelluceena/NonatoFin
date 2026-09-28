import type { ReactNode } from 'react';
import type { ContaBancaria } from '@/lib/domain/tipos';

/** Dados cadastrais da conta em pares rótulo/valor (informação secundária). */
export function DadosConta({ conta }: { conta: ContaBancaria }) {
  const itens: { rotulo: string; valor: ReactNode }[] = [
    { rotulo: 'Empresa', valor: conta.empresa.apelido },
    { rotulo: 'Banco', valor: conta.banco },
    { rotulo: 'Final', valor: conta.final ? <span className="numeros">•••• {conta.final}</span> : <span className="text-fg-3">Não informado</span> },
    { rotulo: 'Conta padrão', valor: conta.padrao ? 'Sim, sugerida nos novos lançamentos' : 'Não' },
    { rotulo: 'Situação', valor: conta.ativa ? 'Ativa' : <span className="text-fg-3">Inativa</span> },
  ];
  return (
    <section aria-labelledby="titulo-dados-conta" className="rounded-lg border border-border bg-surface p-5">
      <h2 id="titulo-dados-conta" className="text-sm font-medium text-fg-2">
        Dados da conta
      </h2>
      <dl className="mt-3 divide-y divide-border-subtle text-sm">
        {itens.map((i) => (
          <div key={i.rotulo} className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
            <dt className="shrink-0 text-fg-3">{i.rotulo}</dt>
            <dd className="min-w-0 text-right text-fg">{i.valor}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
