'use client';

import { ThemeProvider, useTheme } from 'next-themes';
import { useEffect, type ReactNode } from 'react';
import { Toaster } from 'sonner';

/** Chave do localStorage onde a preferência de tema fica salva. */
export const CHAVE_TEMA = 'nonatofin-tema';

const COR_BARRA = { light: '#f5f7fa', dark: '#0b0f14' } as const;

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
          toast: '!bg-surface !text-fg !border-border !shadow-md !rounded-lg !font-sans',
          description: '!text-fg-2',
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
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey={CHAVE_TEMA}
      themes={['light', 'dark']}
    >
      <SincronizarCorDaBarra />
      {children}
      <Notificacoes />
    </ThemeProvider>
  );
}
