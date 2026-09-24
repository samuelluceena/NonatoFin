import { describe, expect, it } from 'vitest';
import {
  calcularIndicadores,
  ordenarPorMetrica,
  resumirStatus,
  resumoPorFornecedor,
  resumoPorGrupo,
  resumoPorMes,
  serieMensal,
} from '@/lib/domain/indicadores';
import { calcularStatus } from '@/lib/domain/status';
import type { LancamentoResumo, Fornecedor } from '@/lib/domain/tipos';

/**
 * Cenário conhecido. HOJE = quarta-feira 23/09/2026.
 * Semana: 21/09 (seg) a 27/09 (dom). Mês: setembro. Próximo mês: outubro.
 */
const HOJE = '2026-09-23';

const VIA: Fornecedor = { id: 'f-via', nome: 'Via da Moda' };
const ENEL: Fornecedor = { id: 'f-enel', nome: 'Enel' };
const BRADESCO: Fornecedor = { id: 'f-bra', nome: 'Bradesco' };
const SEM_LANCAMENTOS: Fornecedor = { id: 'f-vazio', nome: 'Zeta Sem Boletos' };

let seq = 0;
function b(
  fornecedor: Fornecedor,
  vencimento: string,
  valorCentavos: number,
  status: 'pendente' | 'pago' = 'pendente',
  dataPagamento: string | null = null,
): LancamentoResumo {
  seq += 1;
  return {
    id: `b${seq}`,
    fornecedorId: fornecedor.id,
    // empresa/categoria alternadas para os testes de agrupamento
    empresaId: seq % 2 === 0 ? 'emp-a' : 'emp-b',
    categoriaId: fornecedor.id === VIA.id ? 'cat-fornecedor' : 'cat-fixa',
    contaId: null,
    vencimento,
    valorCentavos,
    status,
    dataPagamento: status === 'pago' ? (dataPagamento ?? vencimento) : null,
  };
}

const LANCAMENTOS: LancamentoResumo[] = [
  // atrasados
  b(VIA, '2026-08-10', 299500), // atrasado (mês passado)
  b(ENEL, '2026-09-22', 45000), // atrasado (ontem, mesma semana)
  // hoje
  b(VIA, HOJE, 299500),
  b(ENEL, HOJE, 12345),
  b(BRADESCO, HOJE, 100000, 'pago', HOJE), // pago hoje: não entra em "a pagar"
  // amanhã
  b(BRADESCO, '2026-09-24', 50050),
  // resto da semana (domingo)
  b(VIA, '2026-09-27', 10000),
  // resto do mês (fora da semana)
  b(ENEL, '2026-09-30', 20000),
  // próximo mês
  b(VIA, '2026-10-09', 299500),
  b(BRADESCO, '2026-10-31', 150000),
  // futuro distante
  b(VIA, '2027-01-09', 299500),
  // pagos
  b(VIA, '2026-09-05', 299500, 'pago', '2026-09-04'), // pago neste mês
  b(VIA, '2026-08-05', 299500, 'pago', '2026-08-05'), // pago no mês passado
  b(ENEL, '2026-10-15', 7000, 'pago', '2026-09-20'), // pago adiantado neste mês
];

describe('status derivado', () => {
  it('pendente, atrasado e pago', () => {
    expect(calcularStatus({ status: 'pendente', vencimento: HOJE }, HOJE)).toBe('pendente');
    expect(calcularStatus({ status: 'pendente', vencimento: '2026-09-22' }, HOJE)).toBe('atrasado');
    expect(calcularStatus({ status: 'pago', vencimento: '2026-09-22' }, HOJE)).toBe('pago');
    expect(calcularStatus({ status: 'pendente', vencimento: '2026-09-24' }, HOJE)).toBe('pendente');
  });
});

describe('indicadores do dashboard (cenário conhecido)', () => {
  const ind = calcularIndicadores(LANCAMENTOS, HOJE);

  it('a pagar hoje', () => {
    expect(ind.hoje).toEqual({ quantidade: 2, totalCentavos: 299500 + 12345 });
  });

  it('a pagar amanhã', () => {
    expect(ind.amanha).toEqual({ quantidade: 1, totalCentavos: 50050 });
  });

  it('a pagar na semana (de hoje até domingo)', () => {
    expect(ind.semana).toEqual({ quantidade: 4, totalCentavos: 299500 + 12345 + 50050 + 10000 });
  });

  it('a pagar no mês (de hoje até o fim do mês)', () => {
    expect(ind.mes).toEqual({ quantidade: 5, totalCentavos: 299500 + 12345 + 50050 + 10000 + 20000 });
  });

  it('a pagar no próximo mês', () => {
    expect(ind.proximoMes).toEqual({ quantidade: 2, totalCentavos: 299500 + 150000 });
  });

  it('atrasados', () => {
    expect(ind.atrasados).toEqual({ quantidade: 2, totalCentavos: 299500 + 45000 });
    expect(ind.atrasadosQuantidade).toBe(2);
  });

  it('total futuro a pagar (todos os pendentes a partir de hoje)', () => {
    expect(ind.futuro).toEqual({
      quantidade: 8,
      totalCentavos: 299500 + 12345 + 50050 + 10000 + 20000 + 299500 + 150000 + 299500,
    });
    expect(ind.pendentes).toBe(8);
  });

  it('total pago no mês usa a data do pagamento', () => {
    expect(ind.pagoNoMes).toEqual({ quantidade: 3, totalCentavos: 100000 + 299500 + 7000 });
  });

  it('não há dupla contagem: futuro + atrasados = todos os pendentes', () => {
    const pendentes = LANCAMENTOS.filter((x) => x.status === 'pendente');
    const soma = pendentes.reduce((s, x) => s + x.valorCentavos, 0);
    expect(ind.futuro.totalCentavos + ind.atrasados.totalCentavos).toBe(soma);
  });

  it('lista vazia retorna zeros', () => {
    const vazio = calcularIndicadores([], HOJE);
    expect(vazio.hoje).toEqual({ quantidade: 0, totalCentavos: 0 });
    expect(vazio.futuro.totalCentavos).toBe(0);
  });
});

describe('resumo por fornecedor', () => {
  const resumos = resumoPorFornecedor(LANCAMENTOS, [VIA, ENEL, BRADESCO, SEM_LANCAMENTOS], HOJE);
  const via = resumos.find((r) => r.fornecedor.id === VIA.id)!;

  it('Via da Moda: quantidades por status', () => {
    expect(via.quantidadeTotal).toBe(7);
    expect(via.quantidadePendente).toBe(4);
    expect(via.quantidadePaga).toBe(2);
    expect(via.quantidadeAtrasada).toBe(1);
  });

  it('Via da Moda: valores por status', () => {
    expect(via.totalCentavos).toBe(299500 * 6 + 10000);
    expect(via.pendenteCentavos).toBe(299500 * 3 + 10000);
    expect(via.pagoCentavos).toBe(299500 * 2);
    expect(via.atrasadoCentavos).toBe(299500);
    expect(via.pendenteCentavos + via.pagoCentavos + via.atrasadoCentavos).toBe(via.totalCentavos);
  });

  it('próximo vencimento em aberto', () => {
    expect(via.proximoVencimento).toBe(HOJE);
    expect(resumos.find((r) => r.fornecedor.id === BRADESCO.id)!.proximoVencimento).toBe('2026-09-24');
  });

  it('inclui fornecedor sem boletos, zerado, no fim da lista', () => {
    const ultimo = resumos[resumos.length - 1];
    expect(ultimo.fornecedor.id).toBe(SEM_LANCAMENTOS.id);
    expect(ultimo.quantidadeTotal).toBe(0);
    expect(ultimo.proximoVencimento).toBeNull();
  });

  it('ordena por total cadastrado e por outras métricas', () => {
    expect(resumos[0].fornecedor.id).toBe(VIA.id);
    const porPago = ordenarPorMetrica(resumos, 'pago');
    expect(porPago[0].fornecedor.id).toBe(VIA.id);
    const porAtrasado = ordenarPorMetrica(resumos, 'atrasado');
    expect(porAtrasado.map((r) => r.fornecedor.id).slice(0, 2)).toEqual([VIA.id, ENEL.id]);
  });

  it('totais por fornecedor somam o total geral', () => {
    const geral = resumirStatus(LANCAMENTOS, HOJE);
    expect(resumos.reduce((s, r) => s + r.totalCentavos, 0)).toBe(geral.totalCentavos);
    expect(resumos.reduce((s, r) => s + r.quantidadeTotal, 0)).toBe(LANCAMENTOS.length);
  });
});

describe('resumo por grupo (empresa / categoria)', () => {
  const grupos = [
    { id: 'cat-fornecedor', nome: 'Boleto de fornecedor' },
    { id: 'cat-fixa', nome: 'Despesa fixa' },
    { id: 'cat-vazia', nome: 'Empréstimo' },
  ];
  const resumos = resumoPorGrupo(LANCAMENTOS, grupos, (x) => x.categoriaId, HOJE);

  it('soma cada grupo e fecha com o total geral', () => {
    const soma = resumos.reduce((t, r) => t + r.totalCentavos, 0);
    expect(soma).toBe(LANCAMENTOS.reduce((t, x) => t + x.valorCentavos, 0));
    const via = LANCAMENTOS.filter((x) => x.categoriaId === 'cat-fornecedor');
    expect(resumos.find((r) => r.id === 'cat-fornecedor')?.quantidadeTotal).toBe(via.length);
  });

  it('omite grupos sem lançamentos e ordena pelo total', () => {
    expect(resumos.map((r) => r.id)).not.toContain('cat-vazia');
    for (let i = 1; i < resumos.length; i++) expect(resumos[i - 1].totalCentavos).toBeGreaterThanOrEqual(resumos[i].totalCentavos);
  });

  it('agrupa por empresa sem perder lançamentos', () => {
    const porEmpresa = resumoPorGrupo(
      LANCAMENTOS,
      [
        { id: 'emp-a', nome: 'A' },
        { id: 'emp-b', nome: 'B' },
      ],
      (x) => x.empresaId,
      HOJE,
    );
    expect(porEmpresa.reduce((t, r) => t + r.quantidadeTotal, 0)).toBe(LANCAMENTOS.length);
  });
});

describe('resumo por mês', () => {
  it('agrupa por mês de vencimento em ordem cronológica', () => {
    const meses = resumoPorMes(LANCAMENTOS, HOJE);
    expect(meses.map((m) => m.mes)).toEqual(['2026-08', '2026-09', '2026-10', '2027-01']);
    const setembro = meses.find((m) => m.mes === '2026-09')!;
    expect(setembro.quantidadeTotal).toBe(8);
    expect(setembro.quantidadeAtrasada).toBe(1);
    expect(setembro.quantidadePaga).toBe(2);
    expect(setembro.quantidadePendente).toBe(5);
  });

  it('série mensal preenche meses vazios com zero', () => {
    const serie = serieMensal(LANCAMENTOS, HOJE, '2026-10', 4);
    expect(serie.map((m) => m.mes)).toEqual(['2026-10', '2026-11', '2026-12', '2027-01']);
    expect(serie[1].totalCentavos).toBe(0);
    expect(serie[3].totalCentavos).toBe(299500);
  });
});
