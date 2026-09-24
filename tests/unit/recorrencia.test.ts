import { describe, expect, it } from 'vitest';
import { adicionarMeses, formatarData } from '@/lib/domain/datas';
import {
  gerarLancamentosSerie,
  gerarVencimentosMensais,
  mensagemResumoSerie,
  totalDaSerie,
  validarQuantidadeParcelas,
} from '@/lib/domain/recorrencia';

const br = (datas: string[]) => datas.map(formatarData);

describe('recorrência mensal preservando o dia', () => {
  it('TESTE OBRIGATÓRIO: 31/01/2027 -> 28/02 -> 31/03 -> 30/04 -> 31/05', () => {
    expect(br(gerarVencimentosMensais('2027-01-31', 5))).toEqual([
      '31/01/2027',
      '28/02/2027',
      '31/03/2027',
      '30/04/2027',
      '31/05/2027',
    ]);
  });

  it('mudança de mês e de ano (exemplo 09/11/2026 x5)', () => {
    expect(br(gerarVencimentosMensais('2026-11-09', 5))).toEqual([
      '09/11/2026',
      '09/12/2026',
      '09/01/2027',
      '09/02/2027',
      '09/03/2027',
    ]);
  });

  it('dia 28 é sempre preservado', () => {
    expect(br(gerarVencimentosMensais('2026-12-28', 4))).toEqual([
      '28/12/2026',
      '28/01/2027',
      '28/02/2027',
      '28/03/2027',
    ]);
  });

  it('dia 29 em ano não bissexto e bissexto', () => {
    expect(br(gerarVencimentosMensais('2027-01-29', 3))).toEqual(['29/01/2027', '28/02/2027', '29/03/2027']);
    expect(br(gerarVencimentosMensais('2028-01-29', 3))).toEqual(['29/01/2028', '29/02/2028', '29/03/2028']);
  });

  it('ano bissexto: 31/01/2028 -> 29/02/2028', () => {
    expect(adicionarMeses('2028-01-31', 1)).toBe('2028-02-29');
    expect(adicionarMeses('2028-02-29', 12)).toBe('2029-02-28');
  });

  it('dia 30 em fevereiro e depois volta ao 30', () => {
    expect(br(gerarVencimentosMensais('2027-01-30', 4))).toEqual([
      '30/01/2027',
      '28/02/2027',
      '30/03/2027',
      '30/04/2027',
    ]);
  });

  it('dia 31 atravessando o ano', () => {
    expect(br(gerarVencimentosMensais('2026-10-31', 6))).toEqual([
      '31/10/2026',
      '30/11/2026',
      '31/12/2026',
      '31/01/2027',
      '28/02/2027',
      '31/03/2027',
    ]);
  });

  it('não usa a data anterior como base (o dia não "encolhe" permanentemente)', () => {
    const datas = gerarVencimentosMensais('2027-01-31', 13);
    expect(datas[12]).toBe('2028-01-31');
    expect(datas.filter((d) => d.endsWith('-31'))).toHaveLength(8);
  });
});

describe('geração de lançamentos da série', () => {
  const base = {
    primeiroVencimento: '2026-11-09',
    quantidade: 5,
    valorCentavos: 299500,
    codigoBarras: '00190000090123456789012345678901234567890123456',
    mesmoCodigoEmTodos: false,
  };

  it('valor informado é o valor de CADA lançamento (não divide)', () => {
    const lancamentos = gerarLancamentosSerie(base);
    expect(lancamentos).toHaveLength(5);
    expect(lancamentos.every((l) => l.valorCentavos === 299500)).toBe(true);
    expect(lancamentos.map((l) => `${l.parcela}/${l.totalParcelas}`)).toEqual(['1/5', '2/5', '3/5', '4/5', '5/5']);
  });

  it('R$ 2.995,00 × 5 = R$ 14.975,00', () => {
    expect(totalDaSerie(299500, 5)).toBe(1497500);
    expect(mensagemResumoSerie(299500, 5).replace(/ /g, ' ')).toBe(
      'Serão criados 5 lançamentos de R$ 2.995,00, totalizando R$ 14.975,00.',
    );
  });

  it('por padrão só o primeiro lançamento recebe o código', () => {
    const lancamentos = gerarLancamentosSerie(base);
    expect(lancamentos[0].codigoBarras).toBe(base.codigoBarras);
    expect(lancamentos.slice(1).every((l) => l.codigoBarras === null)).toBe(true);
  });

  it('com a opção marcada, todos recebem o mesmo código', () => {
    const lancamentos = gerarLancamentosSerie({ ...base, mesmoCodigoEmTodos: true });
    expect(lancamentos.every((l) => l.codigoBarras === base.codigoBarras)).toBe(true);
  });

  it('valida a quantidade de parcelas', () => {
    expect(validarQuantidadeParcelas(1)).toBe(false);
    expect(validarQuantidadeParcelas(2)).toBe(true);
    expect(validarQuantidadeParcelas(120)).toBe(true);
    expect(validarQuantidadeParcelas(121)).toBe(false);
    expect(validarQuantidadeParcelas(2.5)).toBe(false);
    expect(() => gerarLancamentosSerie({ ...base, quantidade: 0 })).toThrow();
  });
});
