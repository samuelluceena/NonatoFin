import { describe, expect, it } from 'vitest';
import {
  centavosDosDigitos,
  converterTextoParaCentavos,
  formatarMoeda,
  formatarMoedaComSinal,
  formatarMoedaSaldo,
  formatarNumeroMoeda,
  multiplicarCentavos,
  somarCentavos,
} from '@/lib/domain/dinheiro';

/** Intl usa espaço inquebrável entre "R$" e o número. */
const semNbsp = (s: string) => s.replace(/ /g, ' ');

describe('formatação monetária brasileira', () => {
  it.each([
    [1000, 'R$ 10,00'],
    [10050, 'R$ 100,50'],
    [123456, 'R$ 1.234,56'],
    [10000000, 'R$ 100.000,00'],
    [299500, 'R$ 2.995,00'],
    [5, 'R$ 0,05'],
    [0, 'R$ 0,00'],
  ])('%i centavos -> %s', (centavos, esperado) => {
    expect(semNbsp(formatarMoeda(centavos))).toBe(esperado);
  });

  it('não confunde com formato americano', () => {
    expect(formatarNumeroMoeda(123456)).toBe('1.234,56');
    expect(formatarMoeda(123456)).not.toContain('1,234.56');
  });

  it('rejeita valores não inteiros', () => {
    expect(() => formatarMoeda(10.5)).toThrow();
  });
});

describe('conversão de texto para centavos', () => {
  it.each([
    ['10,00', 1000],
    ['100,50', 10050],
    ['1.234,56', 123456],
    ['100.000,00', 10000000],
    ['R$ 2.995,00', 299500],
    ['2995', 299500],
    ['2995,5', 299550],
    ['100.50', 10050],
    ['1.234', 123400],
    [' 7 ', 700],
  ])('"%s" -> %i', (texto, esperado) => {
    expect(converterTextoParaCentavos(texto)).toBe(esperado);
  });

  it.each(['', 'abc', '1,2,3', '-10,00', '10,999', '1.23.4,00'])('"%s" é inválido', (texto) => {
    expect(converterTextoParaCentavos(texto)).toBeNull();
  });
});

describe('máscara de digitação (preenche da direita)', () => {
  it('converte dígitos em centavos', () => {
    expect(centavosDosDigitos('')).toBe(0);
    expect(centavosDosDigitos('2')).toBe(2);
    expect(centavosDosDigitos('299500')).toBe(299500);
    expect(centavosDosDigitos('R$ 2.995,00')).toBe(299500);
    expect(centavosDosDigitos('000123')).toBe(123);
  });

  it('limita a quantidade de dígitos', () => {
    expect(centavosDosDigitos('9'.repeat(30))).toBe(99999999999);
  });
});

describe('operações sem erro de ponto flutuante', () => {
  it('0,10 + 0,20 = 0,30 exatamente', () => {
    expect(somarCentavos([10, 20])).toBe(30);
  });

  it('R$ 2.995,00 × 5 = R$ 14.975,00', () => {
    expect(multiplicarCentavos(299500, 5)).toBe(1497500);
    expect(semNbsp(formatarMoeda(multiplicarCentavos(299500, 5)))).toBe('R$ 14.975,00');
  });

  it('soma de muitos valores com centavos permanece exata', () => {
    const valores = Array.from({ length: 1000 }, () => 1001); // R$ 10,01 × 1000
    expect(somarCentavos(valores)).toBe(1001000);
    expect(semNbsp(formatarMoeda(somarCentavos(valores)))).toBe('R$ 10.010,00');
  });

  it('rejeita multiplicação por quantidade não inteira', () => {
    expect(() => multiplicarCentavos(100, 1.5)).toThrow();
  });
});

describe('valores com sinal (padrão da interface)', () => {
  it('movimentos: + e − tipográfico, zero sem sinal', () => {
    expect(semNbsp(formatarMoedaComSinal(123456))).toBe('+ R$ 1.234,56');
    expect(semNbsp(formatarMoedaComSinal(-1000))).toBe('− R$ 10,00');
    expect(semNbsp(formatarMoedaComSinal(0))).toBe('R$ 0,00');
  });

  it('saldos: só o negativo leva sinal', () => {
    expect(semNbsp(formatarMoedaSaldo(299500))).toBe('R$ 2.995,00');
    expect(semNbsp(formatarMoedaSaldo(-19000))).toBe('− R$ 190,00');
  });
});
