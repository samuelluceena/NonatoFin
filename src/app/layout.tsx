import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Provedores } from '@/components/providers/provedores';
import { APP } from '@/lib/config';
import './globals.css';

export const metadata: Metadata = {
  title: { default: APP.nome, template: `%s · ${APP.nome}` },
  description: APP.descricao,
  applicationName: APP.nome,
  appleWebApp: { capable: true, title: APP.nome, statusBarStyle: 'default' },
  formatDetection: { telephone: false, email: false, address: false },
  // Sistema pessoal: não deve ser indexado por buscadores.
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/icons/icon.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f7f9' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0c10' },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: o next-themes ajusta a classe do <html> antes
    // da hidratação (script bloqueante), evitando o "flash" de tema errado.
    <html lang="pt-BR" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <Provedores>{children}</Provedores>
      </body>
    </html>
  );
}
