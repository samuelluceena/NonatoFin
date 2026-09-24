import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { formatarMoeda } from '@/lib/domain/dinheiro';
import type { ResumoStatus } from '@/lib/domain/tipos';

/**
 * Barra única "Pago x Pendente x Atrasado" com legenda textual (ícone + rótulo
 * + valor): o estado nunca depende só da cor.
 */
export function ComposicaoStatus({ resumo }: { resumo: ResumoStatus }) {
  const total = Math.max(1, resumo.totalCentavos);
  const partes = [
    { chave: 'pago', rotulo: 'Pago', valor: resumo.pagoCentavos, qtd: resumo.quantidadePaga, cor: 'bg-chart-2', Icone: CheckCircle2 },
    { chave: 'pendente', rotulo: 'Pendente', valor: resumo.pendenteCentavos, qtd: resumo.quantidadePendente, cor: 'bg-chart-1', Icone: Clock },
    { chave: 'atrasado', rotulo: 'Atrasado', valor: resumo.atrasadoCentavos, qtd: resumo.quantidadeAtrasada, cor: 'bg-chart-3', Icone: AlertTriangle },
  ];
  const visiveis = partes.filter((p) => p.valor > 0);

  return (
    <figure className="m-0">
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-[4px] bg-chart-track" aria-hidden="true">
        {visiveis.map((p) => (
          <div key={p.chave} className={p.cor} style={{ width: `${(p.valor / total) * 100}%` }} />
        ))}
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-3">
        {partes.map((p) => (
          <li key={p.chave} className="flex items-center gap-2 text-sm">
            <span className={`size-2.5 shrink-0 rounded-[3px] ${p.cor}`} aria-hidden="true" />
            <p.Icone className="size-4 shrink-0 text-fg-3" aria-hidden="true" />
            <span className="text-fg-2">{p.rotulo}</span>
            <span className="numeros ml-auto font-medium text-fg sm:ml-1">{formatarMoeda(p.valor)}</span>
            <span className="numeros text-[13px] text-fg-3">
              ({Math.round((p.valor / total) * 100)}% · {p.qtd})
            </span>
          </li>
        ))}
      </ul>
      <figcaption className="sr-only">Distribuição dos valores por status</figcaption>
    </figure>
  );
}
