import type { MetadataRoute } from 'next';
import { APP } from '@/lib/config';

/** Manifesto PWA: permite "Adicionar à tela inicial" e abrir como app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: APP.nome,
    short_name: APP.nome,
    description: APP.descricao,
    lang: 'pt-BR',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0b0f14',
    theme_color: '#0b0f14',
    categories: ['finance', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
