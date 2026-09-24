/**
 * Cálculos do dashboard, fornecedores e meses.
 *
 * Definições (documentadas em docs/REGRAS-DE-NEGOCIO.md):
 *  - "A pagar" (hoje/amanhã/semana/mês/próximo mês/futuro) considera somente
 *    boletos PENDENTES com vencimento a partir de hoje. Atrasados ficam em
 *    um indicador separado, para não serem contados duas vezes.
 *  - Semana = segunda a domingo da semana atual (a partir de hoje).
 *  - Total pago no mês = boletos pagos cuja DATA DE PAGAMENTO está no mês atual.
 */
import {
  adicionarDias,
  adicionarMeses,
  adicionarMesesNaChave,
  chaveDoMes,
  fimDaSemana,
  fimDoMes,
  inicioDoMes,
  type ChaveMes,
  type DataISO,
} from './datas';
import type { Centavos } from './dinheiro';
import { calcularStatus } from './status';
import type {
  LancamentoResumo,
  Fornecedor,
  IndicadoresDashboard,
  MetricaFornecedor,
  ResumoFornecedor,
  ResumoGrupo,
  ResumoMes,
  ResumoStatus,
  Totalizador,
} from './tipos';

const vazio = (): Totalizador => ({ quantidade: 0, totalCentavos: 0 });

function acumular(t: Totalizador, valor: Centavos): void {
  t.quantidade += 1;
  t.totalCentavos += valor;
}

const entre = (d: DataISO, inicio: DataISO, fim: DataISO) => d >= inicio && d <= fim;

export function calcularIndicadores(
  lancamentos: readonly LancamentoResumo[],
  hoje: DataISO,
): IndicadoresDashboard {
  const amanha = adicionarDias(hoje, 1);
  const fimSemana = fimDaSemana(hoje);
  const fimMes = fimDoMes(hoje);
  const inicioMes = inicioDoMes(hoje);
  const inicioProximo = adicionarMeses(inicioMes, 1);
  const fimProximo = fimDoMes(inicioProximo);

  const r = {
    hoje: vazio(),
    amanha: vazio(),
    semana: vazio(),
    mes: vazio(),
    proximoMes: vazio(),
    atrasados: vazio(),
    futuro: vazio(),
    pagoNoMes: vazio(),
  };

  for (const b of lancamentos) {
    if (b.status === 'pago') {
      if (b.dataPagamento && entre(b.dataPagamento, inicioMes, fimMes)) acumular(r.pagoNoMes, b.valorCentavos);
      continue;
    }
    const v = b.vencimento;
    if (v < hoje) {
      acumular(r.atrasados, b.valorCentavos);
      continue;
    }
    acumular(r.futuro, b.valorCentavos);
    if (v === hoje) acumular(r.hoje, b.valorCentavos);
    if (v === amanha) acumular(r.amanha, b.valorCentavos);
    if (v <= fimSemana) acumular(r.semana, b.valorCentavos);
    if (v <= fimMes) acumular(r.mes, b.valorCentavos);
    if (entre(v, inicioProximo, fimProximo)) acumular(r.proximoMes, b.valorCentavos);
  }

  return { ...r, pendentes: r.futuro.quantidade, atrasadosQuantidade: r.atrasados.quantidade };
}

export function resumoVazio(): ResumoStatus {
  return {
    quantidadeTotal: 0,
    quantidadePendente: 0,
    quantidadePaga: 0,
    quantidadeAtrasada: 0,
    totalCentavos: 0,
    pendenteCentavos: 0,
    pagoCentavos: 0,
    atrasadoCentavos: 0,
  };
}

function somarNoResumo(resumo: ResumoStatus, b: LancamentoResumo, hoje: DataISO): void {
  resumo.quantidadeTotal += 1;
  resumo.totalCentavos += b.valorCentavos;
  const status = calcularStatus(b, hoje);
  if (status === 'pago') {
    resumo.quantidadePaga += 1;
    resumo.pagoCentavos += b.valorCentavos;
  } else if (status === 'atrasado') {
    resumo.quantidadeAtrasada += 1;
    resumo.atrasadoCentavos += b.valorCentavos;
  } else {
    resumo.quantidadePendente += 1;
    resumo.pendenteCentavos += b.valorCentavos;
  }
}

export function resumirStatus(lancamentos: readonly LancamentoResumo[], hoje: DataISO): ResumoStatus {
  const resumo = resumoVazio();
  for (const b of lancamentos) somarNoResumo(resumo, b, hoje);
  return resumo;
}

/** Totais por fornecedor, ordenados pelo total cadastrado (maior primeiro). */
export function resumoPorFornecedor(
  lancamentos: readonly LancamentoResumo[],
  fornecedores: readonly Fornecedor[],
  hoje: DataISO,
): ResumoFornecedor[] {
  const mapa = new Map<string, ResumoFornecedor>();
  for (const f of fornecedores) {
    mapa.set(f.id, { fornecedor: f, proximoVencimento: null, ...resumoVazio() });
  }
  for (const b of lancamentos) {
    const resumo = mapa.get(b.fornecedorId);
    if (!resumo) continue;
    somarNoResumo(resumo, b, hoje);
    if (b.status === 'pendente' && b.vencimento >= hoje) {
      if (!resumo.proximoVencimento || b.vencimento < resumo.proximoVencimento) {
        resumo.proximoVencimento = b.vencimento;
      }
    }
  }
  return ordenarPorMetrica([...mapa.values()], 'total');
}

export function valorDaMetrica(resumo: ResumoStatus, metrica: MetricaFornecedor): Centavos {
  switch (metrica) {
    case 'total':
      return resumo.totalCentavos;
    case 'pendente':
      return resumo.pendenteCentavos;
    case 'pago':
      return resumo.pagoCentavos;
    case 'atrasado':
      return resumo.atrasadoCentavos;
  }
}

export function ordenarPorMetrica<T extends ResumoFornecedor>(
  resumos: T[],
  metrica: MetricaFornecedor,
): T[] {
  return [...resumos].sort(
    (a, b) =>
      valorDaMetrica(b, metrica) - valorDaMetrica(a, metrica) ||
      a.fornecedor.nome.localeCompare(b.fornecedor.nome, 'pt-BR'),
  );
}

/** Totais por mês de vencimento, em ordem cronológica. */
export function resumoPorMes(lancamentos: readonly LancamentoResumo[], hoje: DataISO): ResumoMes[] {
  const mapa = new Map<ChaveMes, ResumoMes>();
  for (const b of lancamentos) {
    const mes = chaveDoMes(b.vencimento);
    let resumo = mapa.get(mes);
    if (!resumo) {
      resumo = { mes, ...resumoVazio() };
      mapa.set(mes, resumo);
    }
    somarNoResumo(resumo, b, hoje);
  }
  return [...mapa.values()].sort((a, b) => a.mes.localeCompare(b.mes));
}

/** Série contínua de meses (preenche meses sem boletos com zero). */
export function serieMensal(
  lancamentos: readonly LancamentoResumo[],
  hoje: DataISO,
  inicio: ChaveMes,
  quantidadeMeses: number,
): ResumoMes[] {
  const porMes = new Map(resumoPorMes(lancamentos, hoje).map((r) => [r.mes, r]));
  return Array.from({ length: quantidadeMeses }, (_, i) => {
    const mes = adicionarMesesNaChave(inicio, i);
    return porMes.get(mes) ?? { mes, ...resumoVazio() };
  });
}

/**
 * Totais por um agrupamento (empresa, categoria...), ordenados pelo total.
 * Grupos sem boletos ficam de fora.
 */
export function resumoPorGrupo(
  lancamentos: readonly LancamentoResumo[],
  grupos: readonly { id: string; nome: string }[],
  chave: (b: LancamentoResumo) => string,
  hoje: DataISO,
): ResumoGrupo[] {
  const mapa = new Map<string, ResumoGrupo>(grupos.map((g) => [g.id, { id: g.id, nome: g.nome, ...resumoVazio() }]));
  for (const b of lancamentos) {
    const resumo = mapa.get(chave(b));
    if (resumo) somarNoResumo(resumo, b, hoje);
  }
  return [...mapa.values()]
    .filter((r) => r.quantidadeTotal > 0)
    .sort((a, b) => b.totalCentavos - a.totalCentavos || a.nome.localeCompare(b.nome, 'pt-BR'));
}
