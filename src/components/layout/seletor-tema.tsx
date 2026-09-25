'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { classesBotaoIcone } from '@/components/ui/botao';
import { Segmentado } from '@/components/ui/segmentado';

export type Tema = 'light' | 'dark';

export const OPCOES_TEMA: { valor: Tema; rotulo: string }[] = [
  { valor: 'light', rotulo: 'Claro' },
  { valor: 'dark', rotulo: 'Escuro' },
];

const ICONES = { light: Sun, dark: Moon } as const;

/** true somente após montar no navegador (o tema salvo só existe lá). */
function useMontado() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/** Tema aplicado; qualquer valor antigo (ex.: "system" salvo) conta como o que está na tela. */
function temaAtual(resolvedTheme: string | undefined): Tema {
  return resolvedTheme === 'dark' ? 'dark' : 'light';
}

/** Seletor da página de Configurações: Claro / Escuro. */
export function SeletorTema() {
  const { resolvedTheme, setTheme } = useTheme();
  const montado = useMontado();
  const valor = montado ? temaAtual(resolvedTheme) : 'light';

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

/**
 * Botão do cabeçalho: sol no claro, lua no escuro; um clique alterna.
 * Os dois ícones são renderizados e a classe `.dark` (aplicada antes da
 * primeira pintura pelo next-themes) decide qual aparece — sem piscar e
 * sem diferença entre o HTML do servidor e a hidratação.
 */
export function SeletorTemaCompacto({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const montado = useMontado();
  const escuro = montado && temaAtual(resolvedTheme) === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(escuro ? 'light' : 'dark')}
      className={classesBotaoIcone('md', className)}
      aria-label="Tema escuro"
      aria-pressed={montado ? escuro : undefined}
      title={escuro ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'}
      data-testid="alternar-tema"
    >
      <Sun className="dark:hidden" aria-hidden="true" />
      <Moon className="hidden dark:block" aria-hidden="true" />
    </button>
  );
}
