import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { formatarMoeda } from '@/lib/domain/dinheiro';
import type { ResumoStatus } from '@/lib/domain/tipos';

/**
 * Barra única "Pago × Pendente × Atrasado" + legenda em lista (ícone, rótulo,
 * valor, % e quantidade): o estado nunca depende só da cor. Uma barra
 * empilhada compara melhor as partes do que um gráfico de pizza.
 */
export function ComposicaoStatus({ resumo }: { resumo: ResumoStatus }) {
  const total = Math.max(1, resumo.totalCentavos);
  const partes = [
    { chave: 'pago', rotulo: 'Pago', valor: resumo.pagoCentavos, qtd: resumo.quantidadePaga, cor: 'bg-chart-2', Icone: CheckCircle2, icone: 'text-success' },
    { chave: 'pendente', rotulo: 'Pendente', valor: resumo.pendenteCentavos, qtd: resumo.quantidadePendente, cor: 'bg-chart-1', Icone: Clock, icone: 'text-primary-text' },
    { chave: 'atrasado', rotulo: 'Atrasado', valor: resumo.atrasadoCentavos, qtd: resumo.quantidadeAtrasada, cor: 'bg-chart-3', Icone: AlertTriangle, icone: 'text-danger' },
  ];
  const visiveis = partes.filter((p) => p.valor > 0);

  return (
    <figure className="m-0">
      <p className="text-meta text-fg-3">Total cadastrado</p>
      <p className="numeros mt-0.5 text-xl font-semibold tracking-tight text-fg">{formatarMoeda(resumo.totalCentavos)}</p>
      <div className="mt-4 flex h-2.5 w-full gap-[2px] overflow-hidden rounded-[4px] bg-chart-track" aria-hidden="true">
        {visiveis.map((p) => (
          <div key={p.chave} className={p.cor} style={{ width: `${(p.valor / total) * 100}%` }} />
        ))}
      </div>
      <ul className="mt-4 divide-y divide-border-subtle">
        {partes.map((p) => (
          <li key={p.chave} className="flex items-center gap-2.5 py-2.5 text-sm first:pt-0 last:pb-0">
            <span className={`size-2.5 shrink-0 rounded-[3px] ${p.cor}`} aria-hidden="true" />
            <p.Icone className={`size-4 shrink-0 ${p.icone}`} aria-hidden="true" />
            <span className="text-fg-2">{p.rotulo}</span>
            <span className="numeros ml-auto text-meta text-fg-3">
              {Math.round((p.valor / total) * 100)}% · {p.qtd}
            </span>
            <span className="numeros w-28 text-right font-medium text-fg">{formatarMoeda(p.valor)}</span>
          </li>
        ))}
      </ul>
      <figcaption className="sr-only">Distribuição dos valores por status</figcaption>
    </figure>
  );
}
