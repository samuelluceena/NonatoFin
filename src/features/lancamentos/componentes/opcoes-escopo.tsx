'use client';

import type { EscopoSerie } from '@/lib/domain/tipos';
import { cn } from '@/lib/utils/cn';

export interface InfoSerie {
  parcela: number;
  totalParcelas: number;
  /** Quantas parcelas da série ainda existem. */
  existentes: number;
  /** Quantas existem a partir desta (inclusive). */
  daquiEmDiante: number;
}

function opcoes(info: InfoSerie, verbo: string): { valor: EscopoSerie; titulo: string; detalhe: string }[] {
  return [
    { valor: 'este', titulo: `${verbo} somente este`, detalhe: `Apenas a parcela ${info.parcela}/${info.totalParcelas}.` },
    {
      valor: 'proximos',
      titulo: `${verbo} este e os próximos`,
      detalhe: `${info.daquiEmDiante} lançamento(s): parcela ${info.parcela} em diante.`,
    },
    { valor: 'todos', titulo: `${verbo} todos`, detalhe: `Todos os ${info.existentes} lançamento(s) da série.` },
  ];
}

/** Lista de escolha "somente este / este e os próximos / todos". */
export function OpcoesEscopo({
  nome,
  info,
  verbo,
  valor,
  onChange,
}: {
  nome: string;
  info: InfoSerie;
  verbo: string;
  valor: EscopoSerie;
  onChange: (valor: EscopoSerie) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium text-fg">Aplicar em:</legend>
      {opcoes(info, verbo).map((o) => (
        <label
          key={o.valor}
          className={cn(
            'flex min-h-14 cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring',
            valor === o.valor ? 'border-primary bg-primary-soft' : 'border-border hover:bg-surface-2',
          )}
        >
          <input
            type="radio"
            name={nome}
            value={o.valor}
            checked={valor === o.valor}
            onChange={() => onChange(o.valor)}
            className="mt-0.5 size-5 accent-[var(--primary)]"
          />
          <span>
            <span className="block text-[15px] font-medium text-fg">{o.titulo}</span>
            <span className="block text-[13px] text-fg-2">{o.detalhe}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
