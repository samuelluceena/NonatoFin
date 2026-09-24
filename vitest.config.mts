import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const alias = {
  '@': fileURLToPath(new URL('./src', import.meta.url)),
  // 'server-only' lança erro fora do Next.js; nos testes vira um módulo vazio.
  'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
};

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          setupFiles: ['tests/unit/setup.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integracao',
          include: ['tests/integracao/**/*.test.ts'],
          environment: 'node',
          setupFiles: ['tests/integracao/setup.ts'],
          // Os testes compartilham o mesmo banco: rodar em série evita interferência.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/features/**/*.ts'],
      reporter: ['text', 'html'],
    },
  },
});
