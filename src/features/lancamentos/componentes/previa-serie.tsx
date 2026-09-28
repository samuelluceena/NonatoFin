import { CalendarDays, Info } from 'lucide-react';
import { LIMITES } from '@/lib/config';
import { ehDataISOValida, formatarData } from '@/lib/domain/datas';
import { gerarVencimentosMensais, mensagemResumoSerie } from '@/lib/domain/recorrencia';

/**
 * Prévia de "vários meses" no cadastro: resumo do valor e as datas que serão
 * criadas (mostra as 5 primeiras e as 2 últimas quando a série é longa).
 */
export function PreviaSerie({ vencimento, quantidade, valorCentavos }: { vencimento: string; quantidade: number; valorCentavos: number }) {
  const valida =
    ehDataISOValida(vencimento) &&
    Number.isInteger(quantidade) &&
    quantidade >= LIMITES.parcelasMin &&
    quantidade <= LIMITES.parcelasMax;
  if (!valida) {
    return <p className="text-sm text-fg-3">Informe o primeiro vencimento e a quantidade para ver a prévia.</p>;
  }
  const datas = gerarVencimentosMensais(vencimento, quantidade);
  const visiveis = datas.length <= 8 ? datas.map((d, i) => ({ d, i })) : [...datas.slice(0, 5).map((d, i) => ({ d, i })), ...datas.slice(-2).map((d, i) => ({ d, i: datas.length - 2 + i }))];

  return (
    <div className="rounded-md border border-info-border bg-info-soft p-3.5" data-testid="previa-serie">
      {valorCentavos > 0 && (
        <p className="mb-2 flex gap-2 text-sm font-medium text-info" role="status">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {mensagemResumoSerie(valorCentavos, quantidade)}
        </p>
      )}
      <ol className="numeros grid grid-cols-2 gap-x-4 gap-y-1 text-meta text-fg-2 sm:grid-cols-3">
        {visiveis.map(({ d, i }, pos) => (
          <li key={d} className="flex items-center gap-1.5">
            {pos === 5 && datas.length > 8 && <span className="sr-only">...</span>}
            <CalendarDays className="size-3.5 text-fg-3" aria-hidden="true" />
            {formatarData(d)} — {i + 1}/{quantidade}
          </li>
        ))}
      </ol>
      {datas.length > 8 && <p className="mt-1 text-meta text-fg-3">… e mais {datas.length - 7} datas intermediárias.</p>}
    </div>
  );
}
