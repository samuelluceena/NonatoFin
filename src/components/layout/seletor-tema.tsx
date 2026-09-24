'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { Segmentado } from '@/components/ui/segmentado';

export type PreferenciaTema = 'light' | 'dark' | 'system';

export const OPCOES_TEMA: { valor: PreferenciaTema; rotulo: string }[] = [
  { valor: 'light', rotulo: 'Claro' },
  { valor: 'dark', rotulo: 'Escuro' },
  { valor: 'system', rotulo: 'Sistema' },
];

const ICONES = { light: Sun, dark: Moon, system: Monitor } as const;

/** true somente após montar no navegador (o tema salvo só existe lá). */
function useMontado() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

function preferenciaAtual(theme: string | undefined): PreferenciaTema {
  return theme === 'light' || theme === 'dark' ? theme : 'system';
}

/** Seletor completo: Claro / Escuro / Sistema (página de Configurações). */
export function SeletorTema() {
  const { theme, setTheme } = useTheme();
  const montado = useMontado();
  const valor = montado ? preferenciaAtual(theme) : 'system';

  return (
    <Segmentado
      nome="tema"
      rotulo="Tema"
      valor={valor}
      onChange={(novo) => setTheme(novo)}
      opcoes={OPCOES_TEMA.map((o) => {
        const Icone = ICONES[o.valor];
        return { ...o, icone: <Icone className="size-4" aria-hidden="true" /> };
      })}
    />
  );
}

/** Botão compacto que alterna Claro → Escuro → Sistema (cabeçalho). */
export function SeletorTemaCompacto() {
  const { theme, setTheme } = useTheme();
  const montado = useMontado();
  const atual = montado ? preferenciaAtual(theme) : 'system';
  const indice = OPCOES_TEMA.findIndex((o) => o.valor === atual);
  const proximo = OPCOES_TEMA[(indice + 1) % OPCOES_TEMA.length];
  const Icone = ICONES[atual];
  const rotuloAtual = OPCOES_TEMA[indice].rotulo;

  return (
    <button
      type="button"
      onClick={() => setTheme(proximo.valor)}
      className="grid size-11 place-items-center rounded-md text-fg-2 transition-colors hover:bg-surface-2 hover:text-fg"
      aria-label={`Tema: ${rotuloAtual}. Tocar para mudar para ${proximo.rotulo}.`}
      title={`Tema: ${rotuloAtual}`}
      data-testid="alternar-tema"
    >
      <Icone className="size-5" aria-hidden="true" />
    </button>
  );
}
