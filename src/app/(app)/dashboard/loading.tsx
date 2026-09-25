import { Esqueleto } from '@/components/ui/esqueleto';

/** Carregando o Dashboard: mesma estrutura da tela (painéis e gráficos). */
export default function CarregandoDashboard() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-8">
      <span className="sr-only">Carregando o dashboard...</span>
      <div>
        <Esqueleto className="h-8 w-40" />
        <Esqueleto className="mt-2 h-4 w-64 max-w-full" />
      </div>
      <Esqueleto className="h-36 rounded-lg" />
      <Esqueleto className="h-24 rounded-lg" />
      <div className="grid gap-6 lg:grid-cols-5">
        <Esqueleto className="h-72 rounded-lg lg:col-span-3" />
        <Esqueleto className="h-72 rounded-lg lg:col-span-2" />
      </div>
    </div>
  );
}
