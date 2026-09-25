import { Esqueleto } from '@/components/ui/esqueleto';

/** Carregando o Detalhe da conta: saldo com gráfico, dados da conta e listas. */
export default function CarregandoConta() {
  return (
    <div role="status" aria-live="polite" className="mx-auto flex max-w-5xl flex-col gap-8">
      <span className="sr-only">Carregando a conta...</span>
      <div>
        <Esqueleto className="h-4 w-20" />
        <Esqueleto className="mt-2 h-8 w-48" />
        <Esqueleto className="mt-2 h-4 w-56 max-w-full" />
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="rounded-lg border border-border bg-surface p-5 sm:p-6 lg:col-span-3">
          <Esqueleto className="h-4 w-24" />
          <Esqueleto className="mt-2 h-10 w-56 max-w-full sm:h-12" />
          <Esqueleto className="mt-6 h-28 rounded-md sm:h-40" />
        </div>
        <Esqueleto className="h-56 rounded-lg lg:col-span-2" />
      </div>
      <Esqueleto className="h-48 rounded-lg" />
      <Esqueleto className="h-64 rounded-lg" />
    </div>
  );
}
