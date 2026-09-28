import { Esqueleto } from '@/components/ui/esqueleto';

/** Carregando o Dashboard: mesma estrutura da tela (saldo, contas, listas e gráficos). */
export default function CarregandoDashboard() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-8 lg:gap-10">
      <span className="sr-only">Carregando o dashboard...</span>
      <div>
        <Esqueleto className="h-8 w-40" />
        <Esqueleto className="mt-2 h-4 w-64 max-w-full" />
      </div>
      <div>
        <Esqueleto className="h-4 w-32" />
        <Esqueleto className="mt-2 h-10 w-64 max-w-full sm:h-12" />
        <Esqueleto className="mt-6 h-20 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Esqueleto className="h-14 rounded-md" />
        <Esqueleto className="h-14 rounded-md" />
        <Esqueleto className="hidden h-14 rounded-md lg:block" />
        <Esqueleto className="hidden h-14 rounded-md lg:block" />
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <Esqueleto className="h-72 rounded-lg lg:col-span-3" />
        <Esqueleto className="h-72 rounded-lg lg:col-span-2" />
      </div>
    </div>
  );
}
