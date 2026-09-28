import { SlidersHorizontal } from 'lucide-react';
import type { ComponentProps } from 'react';
import { Botao } from './botao';

/** Botão "Filtros" com a quantidade de filtros extras ativos (Boletos, Transações). */
export function BotaoFiltros({ quantidade, ...props }: Omit<ComponentProps<typeof Botao>, 'children' | 'icone' | 'variante'> & { quantidade: number }) {
  return (
    <Botao
      variante="secundario"
      icone={<SlidersHorizontal aria-hidden="true" />}
      aria-label={quantidade ? `Mais filtros (${quantidade} ativos)` : 'Mais filtros'}
      {...props}
    >
      Filtros
      {quantidade > 0 && (
        <span className="numeros grid h-5 min-w-5 place-items-center rounded-sm bg-primary px-1 text-caption font-semibold text-primary-fg" aria-hidden="true">
          {quantidade}
        </span>
      )}
    </Botao>
  );
}
