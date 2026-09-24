import { describe, expect, it } from 'vitest';
import { calcularDigitosCnpj, ehCnpjValido, formatarCnpj, normalizarCnpj } from '@/lib/domain/cnpj';
import {
  descricaoFatura,
  dividirEmParcelas,
  faturaDaCompra,
  fechamentoDaFatura,
  planejarParcelas,
  resumoParcelas,
  validarParcelas,
  vencimentoDaFatura,
} from '@/lib/domain/cartoes';

const semNbsp = (s: string) => s.replace(/ /g, ' ');

describe('CNPJ', () => {
  it('valida CNPJ numérico', () => {
    expect(ehCnpjValido('11.222.333/0001-81')).toBe(true);
    expect(ehCnpjValido('11222333000181')).toBe(true);
    expect(ehCnpjValido('11.222.333/0001-82')).toBe(false);
  });

  it('valida CNPJ alfanumérico (exemplo oficial da Receita: 12.ABC.345/01DE-35)', () => {
    expect(calcularDigitosCnpj('12ABC34501DE')).toBe('35');
    expect(ehCnpjValido('12.ABC.345/01DE-35')).toBe(true);
    expect(ehCnpjValido('12.abc.345/01de-35')).toBe(true); // minúsculas normalizadas
    expect(ehCnpjValido('12.ABC.345/01DE-36')).toBe(false);
  });

  it('rejeita formatos inválidos', () => {
    expect(ehCnpjValido('')).toBe(false);
    expect(ehCnpjValido('00000000000000')).toBe(false);
    expect(ehCnpjValido('1122233300018')).toBe(false); // 13 caracteres
    expect(ehCnpjValido('12ABC34501DEAB')).toBe(false); // DV com letra
  });

  it('normaliza e formata', () => {
    expect(normalizarCnpj(' 12.abc.345/01de-35 ')).toBe('12ABC34501DE35');
    expect(formatarCnpj('11222333000181')).toBe('11.222.333/0001-81');
    expect(formatarCnpj('12ABC34501DE35')).toBe('12.ABC.345/01DE-35');
  });
});

describe('fatura do cartão', () => {
  const venc10fech3 = { diaFechamento: 3, diaVencimento: 10 };
  const venc5fech27 = { diaFechamento: 27, diaVencimento: 5 };

  it('vencimento no dia do cartão, ajustando meses curtos', () => {
    expect(vencimentoDaFatura('2026-10', 10)).toBe('2026-10-10');
    expect(vencimentoDaFatura('2027-02', 31)).toBe('2027-02-28');
    expect(vencimentoDaFatura('2028-02', 30)).toBe('2028-02-29');
  });

  it('fechamento no mesmo mês ou no mês anterior', () => {
    expect(fechamentoDaFatura('2026-10', venc10fech3)).toBe('2026-10-03');
    expect(fechamentoDaFatura('2026-10', venc5fech27)).toBe('2026-09-27');
    expect(fechamentoDaFatura('2027-03', { diaFechamento: 30, diaVencimento: 8 })).toBe('2027-02-28');
  });

  it('compra antes do fechamento entra na fatura do ciclo', () => {
    expect(faturaDaCompra('2026-10-02', venc10fech3)).toBe('2026-10');
    expect(faturaDaCompra('2026-09-20', venc5fech27)).toBe('2026-10');
  });

  it('compra no dia do fechamento ou depois vai para a próxima fatura', () => {
    expect(faturaDaCompra('2026-10-03', venc10fech3)).toBe('2026-11');
    expect(faturaDaCompra('2026-10-25', venc10fech3)).toBe('2026-11');
    expect(faturaDaCompra('2026-09-27', venc5fech27)).toBe('2026-11');
    expect(faturaDaCompra('2026-12-28', venc5fech27)).toBe('2027-02');
  });
});

describe('parcelas da compra', () => {
  it('divide sem perder centavos (sobra na 1ª)', () => {
    expect(dividirEmParcelas(10000, 3)).toEqual([3334, 3333, 3333]);
    expect(dividirEmParcelas(29950, 5)).toEqual([5990, 5990, 5990, 5990, 5990]);
    expect(dividirEmParcelas(100, 1)).toEqual([100]);
    const p = dividirEmParcelas(123457, 7);
    expect(p.reduce((a, b) => a + b, 0)).toBe(123457);
  });

  it('valida quantidade e valor', () => {
    expect(validarParcelas(0)).toBe(false);
    expect(validarParcelas(48)).toBe(true);
    expect(validarParcelas(49)).toBe(false);
    expect(() => dividirEmParcelas(2, 3)).toThrow();
  });

  it('distribui as parcelas em faturas consecutivas', () => {
    expect(planejarParcelas(10000, 3, '2026-11')).toEqual([
      { numero: 1, total: 3, valorCentavos: 3334, faturaMes: '2026-11' },
      { numero: 2, total: 3, valorCentavos: 3333, faturaMes: '2026-12' },
      { numero: 3, total: 3, valorCentavos: 3333, faturaMes: '2027-01' },
    ]);
  });

  it('textos de resumo', () => {
    expect(semNbsp(resumoParcelas(10000, 3))).toBe('3x: 1ª de R$ 33,34 e 2 de R$ 33,33');
    expect(semNbsp(resumoParcelas(30000, 3))).toBe('3x de R$ 100,00');
    expect(semNbsp(resumoParcelas(5000, 1))).toBe('À vista: R$ 50,00');
    expect(descricaoFatura('Nubank PJ', '2026-10')).toBe('Fatura Nubank PJ — Outubro/2026');
  });
});
