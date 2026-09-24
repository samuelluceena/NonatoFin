import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';

config({ path: '.env.test', quiet: true });

const PORTA = Number(process.env.E2E_PORTA ?? 3100);
const BASE = `http://localhost:${PORTA}`;

/** Chromium do sistema (opcional). Sem a variável, usa o navegador do Playwright. */
const executavel = process.env.PLAYWRIGHT_CHROMIUM_PATH;

const comum = {
  locale: 'pt-BR',
  timezoneId: 'America/Sao_Paulo',
  permissions: ['clipboard-read', 'clipboard-write'],
  launchOptions: executavel ? { executablePath: executavel } : {},
};

/**
 * Testes E2E. Requisitos:
 *  1. Supabase local rodando (npx supabase start  OU  npm run supabase:local)
 *  2. Build de produção: npm run build
 * Depois: npm run test:e2e
 */
export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL: BASE,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    storageState: 'tests/e2e/.auth/sessao.json',
  },
  projects: [
    { name: 'celular-375x667', use: { ...devices['iPhone SE'], ...comum, browserName: 'chromium', viewport: { width: 375, height: 667 } } },
    { name: 'celular-390x844', use: { ...devices['iPhone 13'], ...comum, browserName: 'chromium', viewport: { width: 390, height: 844 } } },
    { name: 'celular-430x932', use: { ...devices['Pixel 7'], ...comum, browserName: 'chromium', viewport: { width: 430, height: 932 } } },
    { name: 'tablet-768x1024', use: { ...devices['iPad Mini'], ...comum, browserName: 'chromium', viewport: { width: 768, height: 1024 } } },
    { name: 'desktop-1440x900', use: { ...devices['Desktop Chrome'], ...comum, viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: `npx next start -p ${PORTA}`,
    url: `${BASE}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      SUPABASE_URL: process.env.SUPABASE_URL ?? '',
      SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY ?? '',
    },
  },
});
