/**
 * "Fechar o dia": texto pronto para copiar e colar no WhatsApp.
 * Regras: docs/REGRAS-DE-NEGOCIO.md (seção "Fechar o dia").
 *
 * Conteúdo: saldo disponível por conta, pagas hoje, pendentes (vencidas até
 * hoje e não pagas), contas do próximo dia útil e o saldo depois de pagar
 * pendentes + próximo dia útil. Nunca inclui código de barras.
 * Formatação do WhatsApp: *negrito*.
 */
import { formatarDataCurta, formatarData, nomeDiaDaSemana, type DataISO } from './datas';
import { formatarMoeda, somarCentavos, type Centavos } from './dinheiro';

export interface ItemFechamento {
  fornecedor: string;
  descricao: string;
  valorCentavos: Centavos;
  vencimento: DataISO;
  /** Conta de débito (prevista ou a que pagou). */
  contaId: string | null;
}

export interface ContaFechamento {
  id: string;
  rotulo: string;
  saldoCentavos: Centavos;
}

export interface DadosFechamento {
  hoje: DataISO;
  proximoDiaUtil: DataISO;
  /** Empresa selecionada no topo (null = todas). */
  empresa: string | null;
  contas: ContaFechamento[];
  pagasHoje: ItemFechamento[];
  pendentes: ItemFechamento[];
  proximas: ItemFechamento[];
}

export interface SaldoAposPagar {
  conta: ContaFechamento;
  saidasCentavos: Centavos;
  aposCentavos: Centavos;
}

/**
 * Saldo de cada conta depois de pagar os itens. Itens sem conta (ou de uma
 * conta fora da lista, ex.: inativa) ficam em `semConta`.
 */
export function saldosAposPagar(
  contas: readonly ContaFechamento[],
  itens: readonly ItemFechamento[],
): { porConta: SaldoAposPagar[]; semConta: { quantidade: number; totalCentavos: Centavos } } {
  const ids = new Set(contas.map((c) => c.id));
  const porConta = contas.map((conta) => {
    const saidasCentavos = somarCentavos(itens.filter((i) => i.contaId === conta.id).map((i) => i.valorCentavos));
    return { conta, saidasCentavos, aposCentavos: conta.saldoCentavos - saidasCentavos };
  });
  const sem = itens.filter((i) => !i.contaId || !ids.has(i.contaId));
  return { porConta, semConta: { quantidade: sem.length, totalCentavos: somarCentavos(sem.map((i) => i.valorCentavos)) } };
}

// Espaço normal no lugar do inquebrável: o texto é colado em outro app.
const moeda = (c: Centavos) => formatarMoeda(c).replace(/ /g, ' ');
const nomeItem = (i: ItemFechamento) => [i.fornecedor, i.descricao].filter(Boolean).join(' — ');
const diaPorExtenso = (d: DataISO) => `${nomeDiaDaSemana(d)}, ${formatarDataCurta(d)}`;
const total = (itens: readonly ItemFechamento[]) => moeda(somarCentavos(itens.map((i) => i.valorCentavos)));
const qtd = (n: number) => `${n} ${n === 1 ? 'conta' : 'contas'}`;

function secaoItens(titulo: string, itens: readonly ItemFechamento[], vazio: string, linha: (i: ItemFechamento) => string): string[] {
  if (itens.length === 0) return [`*${titulo}*`, vazio];
  return [`*${titulo} — ${qtd(itens.length)} (${total(itens)})*`, ...itens.map((i) => `• ${linha(i)}`)];
}

export function montarTextoFechamento(d: DadosFechamento): string {
  const rotuloConta = new Map(d.contas.map((c) => [c.id, c.rotulo]));
  const blocos: string[][] = [];

  blocos.push([`*Fechamento do dia — ${nomeDiaDaSemana(d.hoje)}, ${formatarData(d.hoje)}*`, ...(d.empresa ? [d.empresa] : [])]);

  if (d.contas.length > 0) {
    blocos.push([
      '*Saldo disponível*',
      ...d.contas.map((c) => `• ${c.rotulo}: ${moeda(c.saldoCentavos)}`),
      ...(d.contas.length > 1 ? [`Total: *${moeda(somarCentavos(d.contas.map((c) => c.saldoCentavos)))}*`] : []),
    ]);
  }

  blocos.push(
    secaoItens('Pagas hoje', d.pagasHoje, 'Nenhuma conta paga hoje.', (i) => {
      const conta = i.contaId ? rotuloConta.get(i.contaId) : undefined;
      return `${nomeItem(i)}: ${moeda(i.valorCentavos)}${conta ? ` (${conta})` : ''}`;
    }),
  );

  blocos.push(
    secaoItens('Pendentes (vencem até hoje, não pagas)', d.pendentes, 'Nenhuma pendente.', (i) =>
      `${formatarDataCurta(i.vencimento)} · ${nomeItem(i)}: ${moeda(i.valorCentavos)}`,
    ),
  );

  // Vencimentos no fim de semana/feriado entram no próximo dia útil (mostra a data original).
  blocos.push(
    secaoItens(`Próximo dia útil — ${diaPorExtenso(d.proximoDiaUtil)}`, d.proximas, 'Nenhuma conta para pagar.', (i) =>
      `${i.vencimento === d.proximoDiaUtil ? '' : `(venc. ${formatarDataCurta(i.vencimento)}) `}${nomeItem(i)}: ${moeda(i.valorCentavos)}`,
    ),
  );

  const aPagar = [...d.pendentes, ...d.proximas];
  if (d.contas.length > 0 && aPagar.length > 0) {
    const { porConta, semConta } = saldosAposPagar(d.contas, aPagar);
    blocos.push([
      '*Saldo após pagar pendentes e o próximo dia útil*',
      ...porConta.map(({ conta, saidasCentavos, aposCentavos }) =>
        saidasCentavos === 0
          ? `• ${conta.rotulo}: ${moeda(conta.saldoCentavos)} (nada a pagar)`
          : `• ${conta.rotulo}: ${moeda(conta.saldoCentavos)} − ${moeda(saidasCentavos)} = *${moeda(aposCentavos)}*${aposCentavos < 0 ? ' (saldo insuficiente)' : ''}`,
      ),
      ...(semConta.quantidade > 0 ? [`• Sem conta definida: ${moeda(semConta.totalCentavos)} a pagar (${qtd(semConta.quantidade)})`] : []),
    ]);
  }

  return blocos.map((b) => b.join('\n')).join('\n\n');
}

/** Link que abre o WhatsApp com o texto pronto (o usuário escolhe o contato). */
export function linkWhatsApp(texto: string): string {
  return `https://wa.me/?text=${encodeURIComponent(texto)}`;
}
