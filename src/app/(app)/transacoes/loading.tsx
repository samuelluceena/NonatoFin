import { Esqueleto } from '@/components/ui/esqueleto';

/** Carregando Transações: abas de status, filtros, totais e linhas da lista. */
export default function CarregandoTransacoes() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Carregando transações...</span>
      <Esqueleto className="h-8 w-40" />
      <Esqueleto className="mt-2 mb-6 h-4 w-52" />
      <div className="mb-4 flex gap-4 border-b border-border pb-3">
        {[0, 1, 2, 3].map((i) => (
          <Esqueleto key={i} className="h-4 w-16" />
        ))}
      </div>
      <Esqueleto className="mb-5 h-11 rounded-md" />
      <Esqueleto className="mb-5 h-20 rounded-lg" />
      <div className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border bg-surface">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Esqueleto className="size-8 shrink-0" />
            <div className="flex-1">
              <Esqueleto className="h-4 w-1/2" />
              <Esqueleto className="mt-2 h-3 w-1/3" />
            </div>
            <Esqueleto className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
