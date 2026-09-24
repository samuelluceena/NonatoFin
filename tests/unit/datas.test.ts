import { describe, expect, it } from 'vitest';
import {
  adicionarDias,
  adicionarMeses,
  chaveDoMes,
  converterDataBR,
  dataNoFuso,
  diaDaSemana,
  diasNoMes,
  ehDataISOValida,
  fimDaSemana,
  fimDoMes,
  formatarData,
  formatarDataHora,
  formatarMes,
  formatarMesCurto,
  hojeISO,
  inicioDaSemana,
  inicioDoMes,
  instanteInicioDoDia,
  nomeDiaDaSemana,
  adicionarMesesNaChave,
} from '@/lib/domain/datas';

describe('validação e formatação de datas', () => {
  it('valida datas ISO reais', () => {
    expect(ehDataISOValida('2026-08-15')).toBe(true);
    expect(ehDataISOValida('2028-02-29')).toBe(true); // bissexto
    expect(ehDataISOValida('2027-02-29')).toBe(false);
    expect(ehDataISOValida('2026-13-01')).toBe(false);
    expect(ehDataISOValida('2026-04-31')).toBe(false);
    expect(ehDataISOValida('15/08/2026')).toBe(false);
    expect(ehDataISOValida(null)).toBe(false);
  });

  it('formata no padrão brasileiro DD/MM/AAAA', () => {
    expect(formatarData('2026-08-15')).toBe('15/08/2026');
    expect(formatarData('2027-01-05')).toBe('05/01/2027');
  });

  it('converte DD/MM/AAAA para ISO', () => {
    expect(converterDataBR('15/08/2026')).toBe('2026-08-15');
    expect(converterDataBR('31/02/2026')).toBeNull();
    expect(converterDataBR('2026-08-15')).toBeNull();
  });

  it('formata meses em português', () => {
    expect(formatarMes('2026-10')).toBe('Outubro/2026');
    expect(formatarMes('2027-03')).toBe('Março/2027');
    expect(formatarMesCurto('2026-10')).toBe('Out/26');
    expect(chaveDoMes('2026-10-09')).toBe('2026-10');
    expect(adicionarMesesNaChave('2026-12', 1)).toBe('2027-01');
    expect(adicionarMesesNaChave('2026-01', -1)).toBe('2025-12');
  });
});

describe('fuso horário: vencimento é DATA, não instante', () => {
  it('hoje em São Paulo não vira o dia seguinte depois das 21h (UTC já virou)', () => {
    // 15/08/2026 23:30 em São Paulo = 16/08/2026 02:30 UTC
    const instante = new Date('2026-08-16T02:30:00Z');
    expect(hojeISO('America/Sao_Paulo', instante)).toBe('2026-08-15');
  });

  it('hoje em São Paulo logo após a meia-noite', () => {
    // 16/08/2026 00:05 em São Paulo = 16/08/2026 03:05 UTC
    expect(hojeISO('America/Sao_Paulo', new Date('2026-08-16T03:05:00Z'))).toBe('2026-08-16');
  });

  it('formatar uma data não depende do fuso do processo', () => {
    // Não usa new Date(): 15 continua 15 em qualquer fuso.
    expect(formatarData('2026-08-15')).toBe('15/08/2026');
  });

  it('início do dia no fuso (para filtrar pagamentos por data)', () => {
    expect(instanteInicioDoDia('2026-09-23')).toBe('2026-09-23T00:00:00-03:00');
    expect(instanteInicioDoDia('2026-09-23', 'UTC')).toBe('2026-09-23T00:00:00+00:00');
    expect(new Date(instanteInicioDoDia('2026-09-23')).toISOString()).toBe('2026-09-23T03:00:00.000Z');
  });

  it('converte pago_em (timestamp) para a data local correta', () => {
    expect(dataNoFuso('2026-08-16T01:00:00Z')).toBe('2026-08-15');
    expect(formatarDataHora('2026-08-15T17:32:00Z')).toBe('15/08/2026 às 14:32');
  });
});

describe('aritmética de datas', () => {
  it('soma dias atravessando mês e ano', () => {
    expect(adicionarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(adicionarDias('2028-02-28', 1)).toBe('2028-02-29');
    expect(adicionarDias('2027-03-01', -1)).toBe('2027-02-28');
  });

  it('dias no mês, incluindo ano bissexto', () => {
    expect(diasNoMes(2027, 2)).toBe(28);
    expect(diasNoMes(2028, 2)).toBe(29);
    expect(diasNoMes(2100, 2)).toBe(28); // secular não bissexto
    expect(diasNoMes(2000, 2)).toBe(29);
    expect(diasNoMes(2026, 4)).toBe(30);
    expect(diasNoMes(2026, 12)).toBe(31);
  });

  it('semana de segunda a domingo', () => {
    // 23/09/2026 é quarta-feira
    expect(nomeDiaDaSemana('2026-09-23')).toBe('quarta-feira');
    expect(inicioDaSemana('2026-09-23')).toBe('2026-09-21');
    expect(fimDaSemana('2026-09-23')).toBe('2026-09-27');
    // domingo pertence à semana que começou na segunda anterior
    expect(diaDaSemana('2026-09-27')).toBe(0);
    expect(inicioDaSemana('2026-09-27')).toBe('2026-09-21');
    expect(inicioDaSemana('2026-09-21')).toBe('2026-09-21');
  });

  it('início e fim do mês', () => {
    expect(inicioDoMes('2026-09-23')).toBe('2026-09-01');
    expect(fimDoMes('2026-09-23')).toBe('2026-09-30');
    expect(fimDoMes('2028-02-10')).toBe('2028-02-29');
  });

  it('adicionarMeses aceita valores negativos', () => {
    expect(adicionarMeses('2027-03-31', -1)).toBe('2027-02-28');
    expect(adicionarMeses('2027-01-15', -1)).toBe('2026-12-15');
    expect(adicionarMeses('2027-01-15', -13)).toBe('2025-12-15');
  });
});
