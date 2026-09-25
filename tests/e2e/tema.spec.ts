/**
 * Temas: somente Claro e Escuro (sem "Sistema"); persistência, botão sol/lua
 * que alterna em um clique, inicialização sem flash e contraste mínimo
 * (WCAG AA) dos textos nos dois temas.
 */
import { expect, test, type Page } from '@playwright/test';

const classeHtml = (page: Page) => page.evaluate(() => document.documentElement.className);

async function irParaConfiguracoes(page: Page) {
  await page.goto('/configuracoes');
  await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible();
}

test('configurações: somente Claro e Escuro, com persistência', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' }); // o aparelho não decide mais o tema
  await irParaConfiguracoes(page);

  const tema = page.getByRole('group', { name: 'Tema', exact: true });
  await expect(tema.getByRole('radio')).toHaveCount(2);
  await expect(tema.getByText('Sistema')).toHaveCount(0);

  await tema.getByText('Claro', { exact: true }).click();
  await expect(tema.getByLabel('Claro')).toBeChecked();
  expect(await classeHtml(page)).not.toContain('dark');

  await tema.getByText('Escuro', { exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);

  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.getByRole('group', { name: 'Tema', exact: true }).getByLabel('Escuro')).toBeChecked();
  expect(await page.evaluate(() => localStorage.getItem('nonatofin-tema'))).toBe('dark');

  // Claro continua claro mesmo com o aparelho no escuro, inclusive após recarregar
  await page.getByRole('group', { name: 'Tema', exact: true }).getByText('Claro', { exact: true }).click();
  await page.reload();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  expect(await page.evaluate(() => localStorage.getItem('nonatofin-tema'))).toBe('light');
});

test('preferência antiga "Sistema" vira a escolha fixa do tema do aparelho', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/configuracoes');
  await page.evaluate(() => localStorage.setItem('nonatofin-tema', 'system'));
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('nonatofin-tema'))).toBe('dark');
  await page.evaluate(() => localStorage.setItem('nonatofin-tema', 'light'));
});

test('sem flash: o tema salvo é aplicado antes da primeira pintura', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/configuracoes');
  await page.evaluate(() => localStorage.setItem('nonatofin-tema', 'dark'));
  // Registra a classe do <html> no instante em que o primeiro conteúdo visível
  // (cabeçalho/principal) é inserido — antes de hidratar e de pintar.
  await page.addInitScript(() => {
    const w = window as unknown as { __classeInicial?: string };
    const obs = new MutationObserver(() => {
      if (document.querySelector('header, main') && w.__classeInicial === undefined) {
        w.__classeInicial = document.documentElement.className;
        obs.disconnect();
      }
    });
    obs.observe(document, { childList: true, subtree: true });
  });
  await page.reload();
  const inicial = await page.evaluate(() => (window as unknown as { __classeInicial?: string }).__classeInicial);
  expect(inicial).toContain('dark');
  await page.evaluate(() => localStorage.setItem('nonatofin-tema', 'light'));
});

test('botão sol/lua alterna claro ↔ escuro em um clique e persiste', async ({ page }) => {
  const erros: string[] = [];
  page.on('console', (m) => m.type() === 'error' && erros.push(m.text()));
  page.on('pageerror', (e) => erros.push(e.message));
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('nonatofin-tema', 'light'));
  await page.reload();
  const botao = page.getByTestId('alternar-tema').filter({ visible: true }).first();
  await expect(botao).toHaveAttribute('aria-pressed', 'false');
  await expect(botao.locator('svg.lucide-sun')).toBeVisible();
  await expect(botao.locator('svg.lucide-moon')).toBeHidden();

  await botao.click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(botao).toHaveAttribute('aria-pressed', 'true');
  await expect(botao.locator('svg.lucide-moon')).toBeVisible();
  await expect(botao.locator('svg.lucide-sun')).toBeHidden();

  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(botao).toHaveAttribute('aria-pressed', 'true');

  await botao.click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await expect(botao).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => localStorage.getItem('nonatofin-tema'))).toBe('light');
  expect(erros, 'erros no console').toEqual([]);
});

/** Contraste WCAG entre duas cores CSS resolvidas pelo navegador. */
async function contrastes(page: Page) {
  return page.evaluate(() => {
    const cor = (valor: string) => {
      const el = document.createElement('div');
      el.style.color = valor;
      document.body.appendChild(el);
      const rgb = getComputedStyle(el).color.match(/[\d.]+/g)!.map(Number);
      el.remove();
      return rgb;
    };
    const lum = ([r, g, b]: number[]) => {
      const c = [r, g, b].map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const razao = (a: string, b: string) => {
      const [l1, l2] = [lum(cor(a)), lum(cor(b))].sort((x, y) => y - x);
      return (l1 + 0.05) / (l2 + 0.05);
    };
    const v = (n: string) => `var(--${n})`;
    return {
      'fg/bg': razao(v('fg'), v('bg')),
      'fg/surface': razao(v('fg'), v('surface')),
      'fg-2/surface': razao(v('fg-2'), v('surface')),
      'fg-3/surface': razao(v('fg-3'), v('surface')),
      'fg-3/bg': razao(v('fg-3'), v('bg')),
      'fg-3/sidebar': razao(v('fg-3'), v('sidebar')),
      'fg-3/surface-2': razao(v('fg-3'), v('surface-2')),
      'fg-3/surface-elevated': razao(v('fg-3'), v('surface-elevated')),
      'fg-2/bg-subtle': razao(v('fg-2'), v('bg-subtle')),
      'info/surface': razao(v('info'), v('surface')),
      'warning/surface': razao(v('warning'), v('surface')),
      'primary-fg/primary': razao(v('primary-fg'), v('primary')),
      'primary-text/surface': razao(v('primary-text'), v('surface')),
      'danger/surface': razao(v('danger'), v('surface')),
      'success/surface': razao(v('success'), v('surface')),
    };
  });
}

for (const tema of ['light', 'dark'] as const) {
  test(`contraste AA dos textos no tema ${tema === 'light' ? 'claro' : 'escuro'}`, async ({ page }) => {
    await page.goto('/configuracoes');
    await page.evaluate((t) => localStorage.setItem('nonatofin-tema', t), tema);
    await page.reload();
    await expect(page.locator('html')).toHaveClass(tema === 'dark' ? /dark/ : /^(?!.*dark)/);
    const r = await contrastes(page);
    for (const [par, valor] of Object.entries(r)) {
      expect(valor, `${par} = ${valor.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
    await page.evaluate(() => localStorage.setItem('nonatofin-tema', 'light'));
  });
}
