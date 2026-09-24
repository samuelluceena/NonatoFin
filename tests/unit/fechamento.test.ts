import { describe, expect, it } from 'vitest';
import { ehDiaUtil, feriadoEm, pascoa, proximoDiaUtil } from '@/lib/domain/dias-uteis';
import { linkWhatsApp, montarTextoFechamento, saldosAposPagar, type DadosFechamento } from '@/lib/domain/fechamento';

describe('dias úteis', () => {
  it('calcula a Páscoa', () => {
    expect(pascoa(2025)).toBe('2025-04-20');
    expect(pascoa(2026)).toBe('2026-04-05');
    expect(pascoa(2027)).toBe('2027-03-28');
    expect(pascoa(2030)).toBe('2030-04-21');
  });

  it('feriados nacionais fixos e móveis (2026)', () => {
    expect(feriadoEm('2026-01-01')).toBe('Confraternização Universal');
    expect(feriadoEm('2026-11-20')).toBe('Consciência Negra');
    expect(feriadoEm('2026-02-16')).toBe('Carnaval');
    expect(feriadoEm('2026-02-17')).toBe('Carnaval');
    expect(feriadoEm('2026-02-18')).toBeNull(); // quarta de cinzas tem expediente
    expect(feriadoEm('2026-04-03')).toBe('Sexta-feira Santa');
    expect(feriadoEm('2026-06-04')).toBe('Corpus Christi');
    expect(feriadoEm('2026-09-23')).toBeNull();
  });

  it('feriados locais: todo ano (MM-DD) ou um ano só (AAAA-MM-DD)', () => {
    const locais = ['03-19', '2026-12-31'];
    expect(feriadoEm('2027-03-19', locais)).toBe('Feriado local');
    expect(feriadoEm('2026-12-31', locais)).toBe('Feriado local');
    expect(feriadoEm('2027-12-31', locais)).toBeNull();
  });

  it('próximo dia útil pula fim de semana e feriados', () => {
    expect(proximoDiaUtil('2026-09-23')).toBe('2026-09-24'); // quarta → quinta
    expect(proximoDiaUtil('2026-09-25')).toBe('2026-09-28'); // sexta → segunda
    expect(proximoDiaUtil('2026-09-04')).toBe('2026-09-08'); // sexta; segunda 07/09 é feriado
    expect(proximoDiaUtil('2026-02-13')).toBe('2026-02-18'); // sexta antes do Carnaval → quarta de cinzas
    expect(proximoDiaUtil('2026-12-24')).toBe('2026-12-28'); // Natal na sexta
    expect(proximoDiaUtil('2026-09-23', ['09-24'])).toBe('2026-09-25');
    expect(ehDiaUtil('2026-09-26')).toBe(false);
  });
});

const base: DadosFechamento = {
  hoje: '2026-09-25', // sexta
  proximoDiaUtil: '2026-09-28',
  empresa: null,
  contas: [
    { id: 'c1', rotulo: 'Itaú •••• 1234', saldoCentavos: 1_000_000 },
    { id: 'c2', rotulo: 'Caixa', saldoCentavos: 50_000 },
  ],
  pagasHoje: [{ fornecedor: 'Enel', descricao: 'Energia', valorCentavos: 15_000, vencimento: '2026-09-25', contaId: 'c1' }],
  pendentes: [{ fornecedor: 'Via da Moda', descricao: 'Parcela 2/5', valorCentavos: 10_000, vencimento: '2026-09-22', contaId: 'c2' }],
  proximas: [
    { fornecedor: 'Aluguel', descricao: '', valorCentavos: 80_000, vencimento: '2026-09-27', contaId: 'c2' },
    { fornecedor: 'Contador', descricao: 'Honorários', valorCentavos: 30_000, vencimento: '2026-09-28', contaId: null },
  ],
};

describe('fechamento do dia', () => {
  it('saldo após pagar por conta e sem conta', () => {
    const r = saldosAposPagar(base.contas, [...base.pendentes, ...base.proximas]);
    expect(r.porConta.map((c) => [c.conta.id, c.saidasCentavos, c.aposCentavos])).toEqual([
      ['c1', 0, 1_000_000],
      ['c2', 90_000, -40_000],
    ]);
    expect(r.semConta).toEqual({ quantidade: 1, totalCentavos: 30_000 });
  });

  it('item de conta fora da lista (ex.: inativa) conta como sem conta', () => {
    const r = saldosAposPagar(base.contas, [{ ...base.proximas[1], contaId: 'inativa' }]);
    expect(r.semConta.quantidade).toBe(1);
  });

  it('monta o texto completo', () => {
    expect(montarTextoFechamento(base)).toBe(
      [
        '*Fechamento do dia — sexta-feira, 25/09/2026*',
        '',
        '*Saldo disponível*',
        '• Itaú •••• 1234: R$ 10.000,00',
        '• Caixa: R$ 500,00',
        'Total: *R$ 10.500,00*',
        '',
        '*Pagas hoje — 1 conta (R$ 150,00)*',
        '• Enel — Energia: R$ 150,00 (Itaú •••• 1234)',
        '',
        '*Pendentes (vencem até hoje, não pagas) — 1 conta (R$ 100,00)*',
        '• 22/09 · Via da Moda — Parcela 2/5: R$ 100,00',
        '',
        '*Próximo dia útil — segunda-feira, 28/09 — 2 contas (R$ 1.100,00)*',
        '• (venc. 27/09) Aluguel: R$ 800,00',
        '• Contador — Honorários: R$ 300,00',
        '',
        '*Saldo após pagar pendentes e o próximo dia útil*',
        '• Itaú •••• 1234: R$ 10.000,00 (nada a pagar)',
        '• Caixa: R$ 500,00 − R$ 900,00 = *-R$ 400,00* (saldo insuficiente)',
        '• Sem conta definida: R$ 300,00 a pagar (1 conta)',
      ].join('\n'),
    );
  });

  it('dia sem movimento e sem contas bancárias', () => {
    const texto = montarTextoFechamento({ ...base, empresa: 'Loja Centro', contas: [], pagasHoje: [], pendentes: [], proximas: [] });
    expect(texto).toBe(
      [
        '*Fechamento do dia — sexta-feira, 25/09/2026*',
        'Loja Centro',
        '',
        '*Pagas hoje*',
        'Nenhuma conta paga hoje.',
        '',
        '*Pendentes (vencem até hoje, não pagas)*',
        'Nenhuma pendente.',
        '',
        '*Próximo dia útil — segunda-feira, 28/09*',
        'Nenhuma conta para pagar.',
      ].join('\n'),
    );
  });

  it('nunca usa espaço inquebrável e gera o link do WhatsApp', () => {
    const texto = montarTextoFechamento(base);
    expect(texto).not.toMatch(/ /);
    expect(linkWhatsApp('a b\n*c*')).toBe('https://wa.me/?text=a%20b%0A*c*');
  });
});
