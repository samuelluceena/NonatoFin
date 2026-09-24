import { describe, expect, it } from 'vitest';
import {
  agruparSaldos,
  ajusteDaConferencia,
  cobertura,
  contaPadraoDaEmpresa,
  entradaNasceConfirmada,
  projetarSaldo,
  rotuloMovimento,
  type EventoPrevisto,
} from '@/lib/domain/saldos';
import type { ContaBancaria } from '@/lib/domain/tipos';

const HOJE = '2026-09-24';

const saida = (data: string, valor: number, descricao = 'Conta'): EventoPrevisto => ({ data, valorCentavos: valor, descricao, tipo: 'saida' });
const entrada = (data: string, valor: number, descricao = 'Vendas'): EventoPrevisto => ({ data, valorCentavos: valor, descricao, tipo: 'entrada' });

describe('conferência com o extrato', () => {
  it('o ajuste é a diferença entre o saldo do banco e o calculado', () => {
    expect(ajusteDaConferencia(823015, 823015)).toBe(0);
    expect(ajusteDaConferencia(823015, 800000)).toBe(-23015);
    expect(ajusteDaConferencia(-5000, 10000)).toBe(15000);
  });

  it('entrada até hoje entra confirmada; com data futura fica prevista', () => {
    expect(entradaNasceConfirmada('2026-09-24', HOJE)).toBe(true);
    expect(entradaNasceConfirmada('2026-09-01', HOJE)).toBe(true);
    expect(entradaNasceConfirmada('2026-09-25', HOJE)).toBe(false);
  });
});

describe('previsão de saldo', () => {
  it('subtrai saídas e soma entradas em ordem, com o saldo após cada uma', () => {
    const p = projetarSaldo(100000, [saida('2026-09-30', 30000), entrada('2026-09-28', 20000), saida('2026-09-25', 85000)], HOJE, '2026-10-31');
    expect(p.linhas.map((l) => [l.data, l.saldoApos])).toEqual([
      ['2026-09-25', 15000],
      ['2026-09-28', 35000],
      ['2026-09-30', 5000],
    ]);
    expect(p.saldoFinal).toBe(5000);
    expect(p.primeiroNegativo).toBeNull();
  });

  it('conta vencida e não paga entra como saída de hoje', () => {
    const p = projetarSaldo(10000, [saida('2026-09-20', 4000, 'Atrasada')], HOJE, '2026-10-31');
    expect(p.linhas[0]).toMatchObject({ data: '2026-09-20', dataEfetiva: HOJE, saldoApos: 6000 });
  });

  it('entrada prevista com data passada (não confirmada) não entra', () => {
    const p = projetarSaldo(10000, [entrada('2026-09-20', 50000)], HOJE, '2026-10-31');
    expect(p.linhas).toHaveLength(0);
    expect(p.saldoFinal).toBe(10000);
  });

  it('ignora o que passa do fim do período', () => {
    const p = projetarSaldo(10000, [saida('2026-11-01', 1)], HOJE, '2026-10-31');
    expect(p.linhas).toHaveLength(0);
  });

  it('alerta o primeiro dia que TERMINA negativo (entrada do mesmo dia compensa)', () => {
    const mesmoDia = projetarSaldo(1000, [saida('2026-10-05', 5000), entrada('2026-10-05', 6000)], HOJE, '2026-10-31');
    expect(mesmoDia.primeiroNegativo).toBeNull();
    expect(mesmoDia.linhas.map((l) => l.tipo)).toEqual(['entrada', 'saida']);

    const negativo = projetarSaldo(1000, [saida('2026-10-05', 500), saida('2026-10-18', 820)], HOJE, '2026-10-31');
    expect(negativo.primeiroNegativo).toEqual({ data: '2026-10-18', saldoCentavos: -320 });
  });

  it('saldo de hoje já negativo gera alerta para hoje', () => {
    expect(projetarSaldo(-100, [], HOJE, '2026-10-31').primeiroNegativo).toEqual({ data: HOJE, saldoCentavos: -100 });
  });
});

describe('cobertura das saídas', () => {
  it('diz se o saldo cobre e quanto falta', () => {
    expect(cobertura(823000, 85000)).toEqual({ cobre: true, faltaCentavos: 0 });
    expect(cobertura(12000, 41000)).toEqual({ cobre: false, faltaCentavos: 29000 });
    expect(cobertura(-500, 0)).toEqual({ cobre: false, faltaCentavos: 500 });
  });
});

describe('extrato e contas', () => {
  it('rótulos dos movimentos', () => {
    expect(rotuloMovimento({ tipo: 'conferencia', valorCentavos: 100, confirmado: true }, true)).toBe('Saldo inicial');
    expect(rotuloMovimento({ tipo: 'conferencia', valorCentavos: -100, confirmado: true })).toBe('Conferência com o extrato');
    expect(rotuloMovimento({ tipo: 'transferencia', valorCentavos: -100, confirmado: true })).toBe('Transferência enviada');
    expect(rotuloMovimento({ tipo: 'transferencia', valorCentavos: 100, confirmado: true })).toBe('Transferência recebida');
    expect(rotuloMovimento({ tipo: 'entrada', valorCentavos: 100, confirmado: false })).toBe('Entrada prevista');
  });

  const conta = (id: string, empresa: string, apelido: string, extra: Partial<ContaBancaria> = {}): ContaBancaria => ({
    id,
    empresa: { id: empresa, apelido: empresa === 'e1' ? 'J F Lima' : 'Cristina Lucena' },
    apelido,
    banco: 'Banco',
    final: null,
    padrao: false,
    ativa: true,
    ...extra,
  });
  const contas = [
    conta('c1', 'e1', 'Nubank PJ'),
    conta('c2', 'e1', 'Itaú PJ', { padrao: true }),
    conta('c3', 'e2', 'Bradesco', { padrao: true }),
    conta('c4', 'e2', 'Antiga', { ativa: false }),
  ];

  it('conta padrão ativa da empresa', () => {
    expect(contaPadraoDaEmpresa(contas, 'e1')).toBe('c2');
    expect(contaPadraoDaEmpresa(contas, 'e3')).toBe('');
  });

  it('agrupa saldos: total geral, por empresa e por conta (ignora inativas)', () => {
    const g = agruparSaldos(contas, new Map([['c1', 104000], ['c2', 823015], ['c3', 12000], ['c4', 999999]]));
    expect(g.totalCentavos).toBe(939015);
    expect(g.empresas.map((e) => [e.empresa.apelido, e.totalCentavos, e.contas.map((c) => c.conta.apelido)])).toEqual([
      ['Cristina Lucena', 12000, ['Bradesco']],
      ['J F Lima', 927015, ['Itaú PJ', 'Nubank PJ']],
    ]);
  });
});
