'use client';

import { ThemeProvider, useTheme } from 'next-themes';
import { useEffect, type ReactNode } from 'react';
import { Toaster } from 'sonner';

/** Chave do localStorage onde a preferência de tema fica salva. */
export const CHAVE_TEMA = 'nonatofin-tema';

/** Igual a --bg de cada tema (globals.css). */
const COR_BARRA = { light: '#f6f7f9', dark: '#0a0c10' } as const;

/**
 * Mantém a <meta name="theme-color"> (barra do navegador/PWA) igual ao tema
 * efetivamente aplicado, inclusive quando escolhido manualmente.
 */
function SincronizarCorDaBarra() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    if (resolvedTheme !== 'light' && resolvedTheme !== 'dark') return;
    const cor = COR_BARRA[resolvedTheme];
    for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
      meta.setAttribute('content', cor);
    }
  }, [resolvedTheme]);
  return null;
}

/**
 * Quem tinha "Sistema" salvo (opção removida) passa a ter, fixo, o tema que
 * o aparelho usa agora. Roda uma única vez: depois disso o valor é light/dark.
 */
function MigrarTemaAntigo() {
  const { theme, setTheme } = useTheme();
  useEffect(() => {
    if (theme === undefined || theme === 'light' || theme === 'dark') return;
    setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }, [theme, setTheme]);
  return null;
}

function Notificacoes() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      position="top-center"
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      closeButton
      duration={3500}
      offset={{ top: 'calc(env(safe-area-inset-top) + 12px)' }}
      mobileOffset={{ top: 'calc(env(safe-area-inset-top) + 12px)' }}
      toastOptions={{
        classNames: {
          toast: '!bg-surface-elevated !text-fg !border-border !shadow-lg !rounded-lg !font-sans !text-sm',
          description: '!text-fg-2',
          closeButton: '!bg-surface-elevated !border-border !text-fg-3 hover:!text-fg',
          success: '[&_[data-icon]]:!text-success',
          error: '[&_[data-icon]]:!text-danger',
          actionButton: '!bg-primary !text-primary-fg !font-medium',
        },
      }}
    />
  );
}

export function Provedores({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
      storageKey={CHAVE_TEMA}
      themes={['light', 'dark']}
    >
      <MigrarTemaAntigo />
      <SincronizarCorDaBarra />
      {children}
      <Notificacoes />
    </ThemeProvider>
  );
}
