import { Esqueleto } from '@/components/ui/esqueleto';

/** Carregando Contas: saldo total e a lista de contas de uma empresa. */
export default function CarregandoContas() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-8">
      <span className="sr-only">Carregando contas...</span>
      <div>
        <Esqueleto className="h-8 w-32" />
        <Esqueleto className="mt-2 h-4 w-40" />
      </div>
      <div>
        <Esqueleto className="h-4 w-24" />
        <Esqueleto className="mt-2 h-10 w-64 max-w-full sm:h-12" />
        <Esqueleto className="mt-2 h-3 w-28" />
      </div>
      <div>
        <Esqueleto className="mb-2.5 h-5 w-40" />
        <div className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border bg-surface">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between gap-4 px-4 py-4 md:px-5">
              <div className="flex-1">
                <Esqueleto className="h-3 w-24" />
                <Esqueleto className="mt-2 h-4 w-40 max-w-full" />
              </div>
              <Esqueleto className="h-5 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
