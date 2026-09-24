/** Esqueleto exibido enquanto a página carrega dados do servidor. */
export default function Carregando() {
  return (
    <div className="animate-pulse" role="status" aria-live="polite">
      <span className="sr-only">Carregando...</span>
      <div className="mb-5 h-8 w-48 rounded-md bg-surface-3" />
      <div className="mb-6 h-36 rounded-lg bg-surface-2" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-44 rounded-lg bg-surface-2" />
        ))}
      </div>
    </div>
  );
}
