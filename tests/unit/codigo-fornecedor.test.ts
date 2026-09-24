import { describe, expect, it } from 'vitest';
import { ehCodigoValido, formatarCodigo, normalizarCodigo } from '@/lib/domain/codigo-barras';
import { limparNome, mesmoFornecedor, normalizarNome } from '@/lib/domain/fornecedores';

describe('código de barras / linha digitável', () => {
  const linha47 = '00190000090123456789012345678901234567890123456';

  it('normaliza para somente dígitos', () => {
    expect(normalizarCodigo('00190.00009 01234.567890 12345.678901 2 34567890123456')).toBe(
      '00190000090123456789012345678901234567890123456',
    );
    expect(normalizarCodigo(null)).toBe('');
  });

  it('aceita 44, 47 e 48 dígitos', () => {
    expect(ehCodigoValido('1'.repeat(44))).toBe(true);
    expect(ehCodigoValido(linha47)).toBe(true);
    expect(ehCodigoValido('8'.repeat(48))).toBe(true);
    expect(ehCodigoValido('1'.repeat(46))).toBe(false);
    expect(ehCodigoValido('')).toBe(false);
  });

  it('formata a linha digitável para leitura', () => {
    expect(formatarCodigo(linha47)).toBe('00190.00009 01234.567890 12345.678901 2 34567890123456');
    expect(formatarCodigo('836200000005667800481000180975657313001589636081')).toBe(
      '83620000000-5 66780048100-0 18097565731-3 00158963608-1',
    );
  });
});

describe('nomes de fornecedores', () => {
  it('Via da Moda, via da moda e VIA DA MODA são o mesmo fornecedor', () => {
    expect(normalizarNome('Via da Moda')).toBe('via da moda');
    expect(mesmoFornecedor('Via da Moda', 'via da moda')).toBe(true);
    expect(mesmoFornecedor('Via da Moda', 'VIA DA MODA')).toBe(true);
    expect(mesmoFornecedor('Via da Moda', '  VIA   DA   MÓDA ')).toBe(true);
    expect(mesmoFornecedor('Via da Moda', 'Via Moda')).toBe(false);
  });

  it('limpa espaços mantendo a grafia', () => {
    expect(limparNome('  Energia   Loja  Iguatu ')).toBe('Energia Loja Iguatu');
  });
});
