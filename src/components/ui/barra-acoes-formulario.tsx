'use client';

import { Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { Botao } from './botao';

interface Props {
  /** Texto do botão principal (ex.: "Salvar boleto"). */
  rotuloSalvar: ReactNode;
  salvando: boolean;
  textoSalvando?: string;
}

/**
 * Barra "Cancelar / Salvar" dos formulários. No celular fica presa acima da
 * barra de navegação (sempre visível ao rolar); no computador, no fim do form.
 */
export function BarraAcoesFormulario({ rotuloSalvar, salvando, textoSalvando = 'Salvando...' }: Props) {
  const router = useRouter();
  return (
    <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 -mx-4 flex gap-2 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 lg:bottom-0">
      <Botao variante="secundario" tamanho="lg" onClick={() => router.back()} disabled={salvando} className="sm:w-auto">
        Cancelar
      </Botao>
      <Botao
        type="submit"
        tamanho="lg"
        className="flex-1 sm:flex-none"
        carregando={salvando}
        textoCarregando={textoSalvando}
        icone={<Save className="size-5" aria-hidden="true" />}
      >
        {rotuloSalvar}
      </Botao>
    </div>
  );
}
