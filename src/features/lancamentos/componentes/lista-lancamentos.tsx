import { formatarData, formatarDataCurta, nomeDiaDaSemana, adicionarDias, type DataISO } from '@/lib/domain/datas';
import { somarCentavos } from '@/lib/domain/dinheiro';
import type { Lancamento } from '@/lib/domain/tipos';
import { Valor } from '@/components/ui/valor';
import { CartaoLancamento } from './cartao-lancamento';

export function rotuloDia(data: DataISO, hoje: DataISO): string {
  if (data === hoje) return `Hoje — ${formatarData(data)}`;
  if (data === adicionarDias(hoje, 1)) return `Amanhã — ${formatarData(data)}`;
  if (data === adicionarDias(hoje, -1)) return `Ontem — ${formatarData(data)}`;
  const dia = nomeDiaDaSemana(data);
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)}, ${formatarDataCurta(data)}/${data.slice(0, 4)}`;
}

/** Lista de boletos agrupada por data de vencimento. */
export function ListaLancamentos({ lancamentos, hoje }: { lancamentos: Lancamento[]; hoje: DataISO }) {
  const grupos = new Map<DataISO, Lancamento[]>();
  for (const b of lancamentos) {
    const lista = grupos.get(b.vencimento) ?? [];
    lista.push(b);
    grupos.set(b.vencimento, lista);
  }

  return (
    <div className="flex flex-col gap-6">
      {[...grupos.entries()].map(([data, itens]) => (
        <section key={data} aria-label={rotuloDia(data, hoje)}>
          <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
            <h2 className="text-sm font-medium text-fg-2">{rotuloDia(data, hoje)}</h2>
            <span className="text-meta text-fg-3">
              {itens.length} {itens.length === 1 ? 'boleto' : 'boletos'} ·{' '}
              <Valor centavos={somarCentavos(itens.map((b) => b.valorCentavos))} />
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {itens.map((b) => (
              <CartaoLancamento key={b.id} lancamento={b} hoje={hoje} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
