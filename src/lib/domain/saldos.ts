/**
 * Regras de saldo das contas bancárias.
 * Documentação: docs/REGRAS-DE-NEGOCIO.md (seção Contas bancárias e saldo).
 *
 *  - Saldo de hoje = movimentos confirmados (entradas, transferências,
 *    conferências) − lançamentos pagos pela conta. É calculado no banco
 *    (função saldos_contas) e nunca digitado.
 *  - Conferência com o extrato: o usuário informa o saldo do banco e o
 *    sistema grava um ajuste = saldo informado − saldo calculado.
 *  - Previsão: parte do saldo de hoje, subtrai as contas pendentes que saem
 *    da conta (as vencidas contam como hoje, pois ainda precisam ser pagas) e
 *    soma as entradas previstas a partir de hoje. Entrada prevista com data
 *    passada e não confirmada NÃO entra (dinheiro que não se sabe se veio).
 */
import type { DataISO } from './datas';
import { somarCentavos, type Centavos } from './dinheiro';
import type { ContaBancaria, MovimentoConta } from './tipos';

export interface EventoPrevisto {
  data: DataISO;
  valorCentavos: Centavos;
  descricao: string;
  tipo: 'saida' | 'entrada';
}

export type LinhaPrevisao<E extends EventoPrevisto = EventoPrevisto> = E & {
  /** Data considerada na previsão (vencidas = hoje). */
  dataEfetiva: DataISO;
  saldoApos: Centavos;
};

export interface Previsao<E extends EventoPrevisto = EventoPrevisto> {
  linhas: LinhaPrevisao<E>[];
  saldoFinal: Centavos;
  /** Primeiro dia que termina com saldo negativo (ou null). */
  primeiroNegativo: { data: DataISO; saldoCentavos: Centavos } | null;
}

/** Ajuste gravado na conferência com o extrato. */
export function ajusteDaConferencia(saldoCalculado: Centavos, saldoInformado: Centavos): Centavos {
  return saldoInformado - saldoCalculado;
}

/** Entrada lançada com data até hoje já entrou; com data futura é prevista. */
export function entradaNasceConfirmada(data: DataISO, hoje: DataISO): boolean {
  return data <= hoje;
}

/**
 * Saldo dia a dia entre hoje e `ate`. Dentro de um mesmo dia, as entradas vêm
 * antes das saídas; o alerta de negativo olha o saldo no FIM de cada dia.
 * Campos extras dos eventos (ex.: id do lançamento) seguem nas linhas.
 */
export function projetarSaldo<E extends EventoPrevisto>(saldoHoje: Centavos, eventos: readonly E[], hoje: DataISO, ate: DataISO): Previsao<E> {
  const considerados = eventos
    .filter((e) => (e.tipo === 'saida' ? true : e.data >= hoje))
    .map((e) => ({ ...e, dataEfetiva: e.data < hoje ? hoje : e.data }))
    .filter((e) => e.dataEfetiva <= ate)
    .sort(
      (a, b) =>
        a.dataEfetiva.localeCompare(b.dataEfetiva) ||
        (a.tipo === b.tipo ? 0 : a.tipo === 'entrada' ? -1 : 1) ||
        a.data.localeCompare(b.data),
    );

  let saldo = saldoHoje;
  const linhas: LinhaPrevisao<E>[] = considerados.map((e) => {
    saldo += e.tipo === 'entrada' ? e.valorCentavos : -e.valorCentavos;
    return { ...e, saldoApos: saldo };
  });

  let primeiroNegativo: Previsao<E>['primeiroNegativo'] = saldoHoje < 0 ? { data: hoje, saldoCentavos: saldoHoje } : null;
  if (!primeiroNegativo) {
    for (let i = 0; i < linhas.length; i++) {
      const fimDoDia = i === linhas.length - 1 || linhas[i + 1].dataEfetiva !== linhas[i].dataEfetiva;
      if (fimDoDia && linhas[i].saldoApos < 0) {
        primeiroNegativo = { data: linhas[i].dataEfetiva, saldoCentavos: linhas[i].saldoApos };
        break;
      }
    }
  }
  return { linhas, saldoFinal: saldo, primeiroNegativo };
}

/** O saldo cobre o que precisa sair? (falta = quanto falta, 0 se cobre) */
export function cobertura(saldoCentavos: Centavos, saidasCentavos: Centavos): { cobre: boolean; faltaCentavos: Centavos } {
  const falta = Math.max(0, saidasCentavos - saldoCentavos);
  return { cobre: falta === 0, faltaCentavos: falta };
}

/** Rótulo de um movimento no extrato. */
export function rotuloMovimento(m: Pick<MovimentoConta, 'tipo' | 'valorCentavos' | 'confirmado'>, primeiraConferencia = false): string {
  switch (m.tipo) {
    case 'conferencia':
      return primeiraConferencia ? 'Saldo inicial' : 'Conferência com o extrato';
    case 'transferencia':
      return m.valorCentavos < 0 ? 'Transferência enviada' : 'Transferência recebida';
    case 'entrada':
      return m.confirmado ? 'Entrada' : 'Entrada prevista';
  }
}

/** "Itaú PJ •••• 4321" (o final é opcional). */
export function rotuloConta(c: Pick<ContaBancaria, 'apelido' | 'final'>): string {
  return `${c.apelido}${c.final ? ` •••• ${c.final}` : ''}`;
}

/** Conta padrão (ativa) de uma empresa, ou '' se não houver. */
export function contaPadraoDaEmpresa(contas: readonly ContaBancaria[], empresaId: string): string {
  return contas.find((c) => c.empresa.id === empresaId && c.padrao && c.ativa)?.id ?? '';
}

export interface SaldoDaConta {
  conta: ContaBancaria;
  saldoCentavos: Centavos;
}

export interface SaldosPorEmpresa {
  totalCentavos: Centavos;
  empresas: { empresa: ContaBancaria['empresa']; totalCentavos: Centavos; contas: SaldoDaConta[] }[];
}

/** Agrupa os saldos: total geral, por empresa e por conta (contas ativas). */
export function agruparSaldos(contas: readonly ContaBancaria[], saldos: ReadonlyMap<string, Centavos>): SaldosPorEmpresa {
  const porEmpresa = new Map<string, SaldosPorEmpresa['empresas'][number]>();
  for (const conta of contas) {
    if (!conta.ativa) continue;
    const grupo = porEmpresa.get(conta.empresa.id) ?? { empresa: conta.empresa, totalCentavos: 0, contas: [] };
    const saldoCentavos = saldos.get(conta.id) ?? 0;
    grupo.contas.push({ conta, saldoCentavos });
    grupo.totalCentavos += saldoCentavos;
    porEmpresa.set(conta.empresa.id, grupo);
  }
  const empresas = [...porEmpresa.values()]
    .map((g) => ({ ...g, contas: g.contas.sort((a, b) => a.conta.apelido.localeCompare(b.conta.apelido, 'pt-BR')) }))
    .sort((a, b) => a.empresa.apelido.localeCompare(b.empresa.apelido, 'pt-BR'));
  return { totalCentavos: somarCentavos(empresas.map((e) => e.totalCentavos)), empresas };
}
