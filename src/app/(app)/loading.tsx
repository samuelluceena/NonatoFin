import { Esqueleto } from '@/components/ui/esqueleto';

/** Esqueleto exibido enquanto a página carrega dados do servidor. */
export default function Carregando() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Carregando...</span>
      <Esqueleto className="mb-2 h-8 w-44" />
      <Esqueleto className="mb-6 h-4 w-64 max-w-full" />
      <Esqueleto className="mb-6 h-28 rounded-lg" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Esqueleto key={i} className="h-36 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
