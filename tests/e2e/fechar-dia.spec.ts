/**
 * "Fechar o dia": o texto traz pagas hoje, pendentes e o próximo dia útil;
 * "Copiar texto" copia exatamente o texto e "Enviar no WhatsApp" abre o wa.me com ele.
 */
import { expect, test } from '@playwright/test';
import { proximoDiaUtil } from '../../src/lib/domain/dias-uteis';
import { cadastrarBoleto, dataRelativa, semRolagemHorizontal, unico } from './auxiliares';

test('fechar o dia gera o texto para o WhatsApp', async ({ page, context, browserName }) => {
  const paga = unico('Paga Hoje');
  const pendente = unico('Pendente Ontem');
  const proxima = unico('Proximo Util');

  await cadastrarBoleto(page, { fornecedor: paga, descricao: 'Energia', vencimento: dataRelativa(0), valorDigitos: '15000' });
  await page.getByRole('button', { name: 'MARCAR COMO PAGO' }).click();
  await expect(page.getByText('Boleto marcado como pago!')).toBeVisible();
  await cadastrarBoleto(page, { fornecedor: pendente, descricao: 'Parcela', vencimento: dataRelativa(-1), valorDigitos: '10000' });
  await cadastrarBoleto(page, { fornecedor: proxima, descricao: 'Aluguel', vencimento: proximoDiaUtil(dataRelativa(0)), valorDigitos: '80000' });

  await page.goto('/');
  await page.getByTestId('fechar-dia').click();
  await expect(page).toHaveURL(/\/fechar-dia$/);
  await expect(page.getByRole('heading', { name: 'Fechar o dia' })).toBeVisible();
  await expect(page.getByTestId('aviso-pendentes')).toBeVisible();

  const texto = page.getByTestId('texto-fechamento');
  await expect(texto).toContainText('Fechamento do dia');
  const conteudo = (await texto.innerText()).replace(/\u00a0/g, ' ');
  const secao = (titulo: string) => conteudo.split('\n\n').find((b) => b.includes(titulo)) ?? '';
  expect(secao('Pagas hoje')).toContain(`${paga} — Energia: R$ 150,00`);
  expect(secao('Pendentes')).toContain(`${pendente} — Parcela: R$ 100,00`);
  expect(secao('Próximo dia útil')).toContain(`${proxima} — Aluguel: R$ 800,00`);
  expect(conteudo).not.toMatch(/\d{44,48}/); // nunca código de barras
  await semRolagemHorizontal(page);

  // WhatsApp: o link leva o mesmo texto (com *negrito* do WhatsApp)
  const link = page.getByRole('link', { name: 'Enviar no WhatsApp' });
  const href = (await link.getAttribute('href'))!;
  expect(href.startsWith('https://wa.me/?text=')).toBe(true);
  const textoWhats = decodeURIComponent(href.slice('https://wa.me/?text='.length));
  expect(textoWhats).toMatch(/^\*Fechamento do dia — /);
  expect(textoWhats).toContain(`${paga} — Energia`);
  await expect(link).toHaveAttribute('target', '_blank');

  // Copiar texto
  if (browserName === 'chromium') {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByRole('button', { name: 'Copiar texto' }).click();
    await expect(page.getByText('Texto copiado!')).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(textoWhats);
  }
});
