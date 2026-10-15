/**
 * Transações (lib/domain/transacoes.ts): filtros ↔ URL, plano de consulta por
 * fonte, montagem de cada tipo, mescla cronológica, totais e apresentação.
 * Categorias (lib/domain/categorias.ts): uso.
 */
import { describe, expect, it } from 'vitest';
import { USO_VAZIO, categoriaEmUso, descreverUso } from '@/lib/domain/categorias';
import { SEM_CONTA } from '@/lib/domain/filtros';
import type { CompraCartao, Lancamento, MovimentoConta } from '@/lib/domain/tipos';
import {
  FILTROS_TRANSACOES_PADRAO,
  agruparPorData,
  compararTransacoes,
  consultaDosFiltrosTransacoes,
  ehSaldoInicial,
  empresaDaConsulta,
  lerFiltrosTransacoes,
  lerPagina,
  mesclarFontes,
  parametrosDosFiltrosTransacoes,
  planoDasTransacoes,
  resumirTransacoes,
  textoDoValor,
  tomDoValor,
  transacaoDaCompra,
  transacaoDaTransferencia,
  transacaoDoLancamento,
  transacaoDoMovimento,
  valorPorExtenso,
  type ContaDoMovimento,
  type FiltrosTransacoes,
  type Transacao,
} from '@/lib/domain/transacoes';

const HOJE = '2026-09-15';
/** formatarMoeda usa espaço inquebrável depois de "R$". */
const nb = (texto: string) => texto.replaceAll('R$ ', `R$${String.fromCharCode(0xa0)}`);
const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';
const f = (parcial: Partial<FiltrosTransacoes> = {}): FiltrosTransacoes => ({ ...FILTROS_TRANSACOES_PADRAO, ...parcial });

function lancamento(p: Partial<Lancamento> = {}): Lancamento {
  return {
    id: 'l1',
    empresa: { id: 'e1', apelido: 'Loja Centro', cnpj: null },
    categoria: { id: 'c1', nome: 'Despesa fixa' },
    conta: { id: 'k1', apelido: 'Itaú PJ', final: '4321' },
    fornecedor: { id: 'f1', nome: 'Enel' },
    descricao: 'Energia',
    valorCentavos: 12345,
    vencimento: '2026-09-20',
    codigoBarras: null,
    observacao: null,
    status: 'pendente',
    pagoEm: null,
    recorrencia: null,
    fatura: null,
    createdAt: '2026-09-01T12:00:00Z',
    updatedAt: '2026-09-01T12:00:00Z',
    ...p,
  };
}

const CONTA: ContaDoMovimento = { id: 'k1', apelido: 'Itaú PJ', final: '4321', empresa: { id: 'e1', apelido: 'Loja Centro' }, criadaEm: '2026-09-01T12:00:00Z' };
const CONTA_2: ContaDoMovimento = { id: 'k2', apelido: 'Nubank', final: null, empresa: { id: 'e1', apelido: 'Loja Centro' }, criadaEm: '2026-09-01T12:00:00Z' };

function movimento(p: Partial<MovimentoConta> = {}): MovimentoConta {
  return {
    id: 'm1',
    contaId: 'k1',
    tipo: 'entrada',
    data: '2026-09-10',
    valorCentavos: 100000,
    saldoInformado: null,
    descricao: 'Vendas do dia',
    confirmado: true,
    transferenciaId: null,
    createdAt: '2026-09-10T15:00:00Z',
    ...p,
  };
}

function item(p: Partial<Transacao> & Pick<Transacao, 'chave' | 'data'>): Transacao {
  return {
    tipo: 'entrada',
    status: 'confirmado',
    ordem: '',
    titulo: p.chave,
    descricao: null,
    complemento: null,
    fornecedor: null,
    categoria: null,
    empresa: null,
    conta: null,
    contaDestino: null,
    valorCentavos: 100,
    sinal: 1,
    efetivo: true,
    href: '/',
    links: [],
    ...p,
  };
}

describe('filtros de Transações na URL', () => {
  it('padrão: este mês, todos os tipos e status; URL limpa', () => {
    expect(lerFiltrosTransacoes({}, HOJE)).toEqual(FILTROS_TRANSACOES_PADRAO);
    expect(consultaDosFiltrosTransacoes(FILTROS_TRANSACOES_PADRAO)).toBe('');
  });

  it('ida e volta de todos os filtros', () => {
    const filtros = f({
      periodo: { tipo: 'intervalo', de: '2026-09-01', ate: '2026-09-10' },
      tipo: 'pagamentos',
      status: 'pagos',
      empresaId: UUID_A,
      categoriaId: UUID_B,
      contaId: SEM_CONTA,
      fornecedorId: UUID_A,
      busca: 'enel',
    });
    const params = parametrosDosFiltrosTransacoes(filtros);
    expect(params).toMatchObject({ periodo: 'intervalo', de: '2026-09-01', ate: '2026-09-10', tipo: 'pagamentos', status: 'pagos', conta: 'sem', q: 'enel' });
    expect(lerFiltrosTransacoes(params, HOJE)).toEqual(filtros);
  });

  it('valores inválidos são ignorados (nunca viram erro)', () => {
    const lido = lerFiltrosTransacoes({ tipo: 'hack', status: 'x', empresa: '1; drop', conta: 'abc', periodo: 'nada', q: "a,b)*'" }, HOJE);
    expect(lido.tipo).toBe('todos');
    expect(lido.status).toBe('todos');
    expect(lido.empresaId).toBe('');
    expect(lido.contaId).toBe('');
    expect(lido.busca).toBe('a b'); // caracteres do PostgREST removidos
    expect(lido.periodo).toEqual({ tipo: 'todos' }); // com pesquisa e sem período: todo o período
  });

  it('mês e dia específicos', () => {
    expect(lerFiltrosTransacoes({ periodo: 'mes-escolhido', mes: '2026-07' }, HOJE).periodo).toEqual({ tipo: 'mes-escolhido', mes: '2026-07' });
    expect(lerFiltrosTransacoes({ periodo: 'dia', dia: '2026-09-03' }, HOJE).periodo).toEqual({ tipo: 'dia', data: '2026-09-03' });
  });

  it('página: 1 por padrão, limitada', () => {
    expect(lerPagina({})).toBe(1);
    expect(lerPagina({ pagina: '3' })).toBe(3);
    expect(lerPagina({ pagina: '-2' })).toBe(1);
    expect(lerPagina({ pagina: '999' })).toBe(10);
    expect(consultaDosFiltrosTransacoes(FILTROS_TRANSACOES_PADRAO, { pagina: '2' })).toBe('?pagina=2');
  });
});

describe('plano de consulta (quais fontes entram)', () => {
  it('padrão: todas as fontes, pelo mês; em aberto por vencimento', () => {
    const p = planoDasTransacoes(f(), HOJE);
    expect(p.pendentes).toEqual({ vencimentoDe: '2026-09-01', vencimentoAte: '2026-09-30', status: 'pendente', ordem: 'asc' });
    expect(p.pagos).toEqual({ de: '2026-09-01', ate: '2026-09-30' });
    expect(p.movimentos).toEqual({ de: '2026-09-01', ate: '2026-09-30', tipos: ['entrada', 'transferencia', 'conferencia'], confirmado: undefined });
    expect(p.compras).toEqual({ de: '2026-09-01', ate: '2026-09-30' });
  });

  it('tipo restringe a fonte', () => {
    expect(planoDasTransacoes(f({ tipo: 'entradas' }), HOJE)).toMatchObject({ pendentes: null, pagos: null, compras: null, movimentos: { tipos: ['entrada'] } });
    expect(planoDasTransacoes(f({ tipo: 'transferencias' }), HOJE).movimentos?.tipos).toEqual(['transferencia']);
    expect(planoDasTransacoes(f({ tipo: 'ajustes' }), HOJE).movimentos?.tipos).toEqual(['conferencia']);
    expect(planoDasTransacoes(f({ tipo: 'contas-a-pagar' }), HOJE)).toMatchObject({ pagos: null, movimentos: null, compras: null });
    expect(planoDasTransacoes(f({ tipo: 'pagamentos' }), HOJE)).toMatchObject({ pendentes: null, movimentos: null, compras: null });
    expect(planoDasTransacoes(f({ tipo: 'compras-cartao' }), HOJE)).toMatchObject({ pendentes: null, pagos: null, movimentos: null });
  });

  it('status usa a mesma regra de "atrasado" dos Boletos (derivada de hoje)', () => {
    const atrasados = planoDasTransacoes(f({ status: 'atrasados' }), HOJE);
    expect(atrasados.pendentes).toMatchObject({ vencimentoDe: '2026-09-01', vencimentoAte: '2026-09-14', status: 'pendente' });
    expect(atrasados).toMatchObject({ pagos: null, movimentos: null, compras: null });
    expect(planoDasTransacoes(f({ status: 'a-vencer' }), HOJE).pendentes).toMatchObject({ vencimentoDe: '2026-09-15', vencimentoAte: '2026-09-30' });
    expect(planoDasTransacoes(f({ status: 'pagos' }), HOJE)).toMatchObject({ pendentes: null, movimentos: null, compras: null, pagos: { de: '2026-09-01' } });
  });

  it('previstos = só entradas não confirmadas; confirmados = movimentos confirmados', () => {
    expect(planoDasTransacoes(f({ status: 'previstos' }), HOJE)).toMatchObject({ pendentes: null, pagos: null, compras: null, movimentos: { tipos: ['entrada'], confirmado: false } });
    expect(planoDasTransacoes(f({ status: 'confirmados' }), HOJE).movimentos).toMatchObject({ tipos: ['entrada', 'transferencia', 'conferencia'], confirmado: true });
    expect(planoDasTransacoes(f({ status: 'previstos', tipo: 'ajustes' }), HOJE).movimentos).toBeNull();
  });

  it('filtros que não se aplicam a uma fonte a excluem', () => {
    const porFornecedor = planoDasTransacoes(f({ fornecedorId: UUID_A }), HOJE);
    expect(porFornecedor.movimentos).toBeNull();
    expect(porFornecedor.compras).toBeNull();
    expect(porFornecedor.pendentes).not.toBeNull();
    const porCategoria = planoDasTransacoes(f({ categoriaId: UUID_A }), HOJE);
    expect(porCategoria.movimentos).toBeNull();
    expect(porCategoria.compras).not.toBeNull();
    const porConta = planoDasTransacoes(f({ contaId: UUID_A }), HOJE);
    expect(porConta.compras).toBeNull();
    expect(porConta.movimentos).not.toBeNull();
    const semConta = planoDasTransacoes(f({ contaId: SEM_CONTA }), HOJE);
    expect(semConta.movimentos).toBeNull();
    expect(semConta.pendentes).not.toBeNull();
  });

  it('empresa: o seletor do topo manda; filtro de outra empresa = nada', () => {
    expect(empresaDaConsulta(undefined, '')).toBeUndefined();
    expect(empresaDaConsulta(undefined, UUID_A)).toBe(UUID_A);
    expect(empresaDaConsulta(UUID_A, '')).toBe(UUID_A);
    expect(empresaDaConsulta(UUID_A, UUID_A)).toBe(UUID_A);
    expect(empresaDaConsulta(UUID_A, UUID_B)).toBeNull();
  });

  it('"sem empresa definida" vale mesmo com uma empresa no topo e só busca lançamentos', () => {
    expect(lerFiltrosTransacoes({ empresa: 'sem' }, HOJE).empresaId).toBe('sem');
    expect(empresaDaConsulta(undefined, 'sem')).toBe('sem');
    expect(empresaDaConsulta(UUID_A, 'sem')).toBe('sem');
    const p = planoDasTransacoes(f({ empresaId: 'sem' }), HOJE);
    expect(p.pendentes).not.toBeNull();
    expect(p.pagos).not.toBeNull();
    expect(p).toMatchObject({ movimentos: null, compras: null });
  });
});

describe('cada tipo de transação', () => {
  it('lançamento pendente = conta a pagar (obrigação) no vencimento', () => {
    const t = transacaoDoLancamento(lancamento(), HOJE);
    expect(t).toMatchObject({ tipo: 'conta-a-pagar', status: 'pendente', data: '2026-09-20', sinal: -1, efetivo: false, titulo: 'Enel', descricao: 'Energia', href: '/boletos/l1' });
    expect(tomDoValor(t)).toBe('neutro');
    expect(textoDoValor(t)).toBe(nb('− R$ 123,45'));
    expect(valorPorExtenso(t)).toBe(nb('R$ 123,45 a pagar'));
    expect(t.links.map((l) => l.href)).toEqual(['/contas/k1', '/fornecedores/f1']);
  });

  it('vencido e não pago = atrasado (vence hoje ainda não está atrasado)', () => {
    expect(transacaoDoLancamento(lancamento({ vencimento: '2026-09-14' }), HOJE).status).toBe('atrasado');
    expect(transacaoDoLancamento(lancamento({ vencimento: HOJE }), HOJE).status).toBe('pendente');
  });

  it('lançamento pago = pagamento na DATA DO PAGAMENTO (fuso de São Paulo)', () => {
    const t = transacaoDoLancamento(lancamento({ status: 'pago', pagoEm: '2026-09-11T02:30:00Z', vencimento: '2026-09-05' }), HOJE);
    expect(t).toMatchObject({ tipo: 'pagamento', status: 'pago', data: '2026-09-10', efetivo: true, complemento: 'Vencimento 05/09/2026' });
    expect(tomDoValor(t)).toBe('saida');
    expect(valorPorExtenso(t)).toBe(nb('R$ 123,45 de saída'));
  });

  it('fatura de cartão e parcela de série', () => {
    const fatura = transacaoDoLancamento(lancamento({ fatura: { cartaoId: 'cc1', mes: '2026-10', ajusteCentavos: 0 } }), HOJE);
    expect(fatura.links.at(-1)).toEqual({ rotulo: 'Ver cartão', href: '/cartoes/cc1' });
    const serie = transacaoDoLancamento(lancamento({ recorrencia: { serieId: 's', parcela: 2, totalParcelas: 5 } }), HOJE);
    expect(serie.complemento).toBe('Parcela 2/5');
  });

  it('entrada confirmada (verde, +) e prevista (neutra)', () => {
    const confirmada = transacaoDoMovimento(movimento(), CONTA);
    expect(confirmada).toMatchObject({ tipo: 'entrada', status: 'confirmado', titulo: 'Vendas do dia', sinal: 1, efetivo: true, href: '/contas/k1', empresa: { apelido: 'Loja Centro' } });
    expect(tomDoValor(confirmada)).toBe('entrada');
    expect(textoDoValor(confirmada)).toBe(nb('+ R$ 1.000,00'));
    const prevista = transacaoDoMovimento(movimento({ confirmado: false }), CONTA);
    expect(prevista).toMatchObject({ status: 'previsto', efetivo: false });
    expect(tomDoValor(prevista)).toBe('neutro');
    expect(valorPorExtenso(prevista)).toBe(nb('R$ 1.000,00 a receber'));
  });

  it('conferência = ajuste (com sinal, mas neutro) e saldo inicial', () => {
    const ajuste = transacaoDoMovimento(movimento({ tipo: 'conferencia', valorCentavos: -1000, saldoInformado: 84000, descricao: null, createdAt: '2026-09-12T10:00:00Z' }), CONTA);
    expect(ajuste).toMatchObject({ tipo: 'ajuste', titulo: 'Conferência com o extrato', sinal: -1, valorCentavos: 1000, complemento: nb('Saldo no banco: R$ 840,00') });
    expect(tomDoValor(ajuste)).toBe('neutro');
    expect(textoDoValor(ajuste)).toBe(nb('− R$ 10,00'));
    const inicial = transacaoDoMovimento(movimento({ tipo: 'conferencia', valorCentavos: 100000, saldoInformado: 100000, createdAt: '2026-09-01T12:00:02Z' }), CONTA);
    expect(inicial.titulo).toBe('Saldo inicial');
    expect(ehSaldoInicial({ tipo: 'conferencia', createdAt: '2026-09-01T12:05:00Z' }, CONTA.criadaEm)).toBe(false);
    expect(ehSaldoInicial({ tipo: 'entrada', createdAt: CONTA.criadaEm }, CONTA.criadaEm)).toBe(false);
  });

  it('transferência: os dois lados viram UM item neutro (origem → destino)', () => {
    const t = transacaoDaTransferencia([
      { movimento: movimento({ id: 'a', tipo: 'transferencia', valorCentavos: 4000, transferenciaId: 'tr', contaId: 'k2', descricao: null }), conta: CONTA_2 },
      { movimento: movimento({ id: 'b', tipo: 'transferencia', valorCentavos: -4000, transferenciaId: 'tr', descricao: null }), conta: CONTA },
    ]);
    expect(t).toMatchObject({ chave: 't-tr', tipo: 'transferencia', sinal: 0, valorCentavos: 4000, complemento: 'Itaú PJ •••• 4321 → Nubank', conta: { id: 'k1' }, contaDestino: { id: 'k2' } });
    expect(tomDoValor(t)).toBe('neutro');
    expect(textoDoValor(t)).toBe(nb('R$ 40,00'));
    // Só um lado disponível: ainda assim um item
    const metade = transacaoDaTransferencia([{ movimento: movimento({ tipo: 'transferencia', valorCentavos: -4000, transferenciaId: 'tr' }), conta: CONTA }]);
    expect(metade.complemento).toBe('Itaú PJ •••• 4321 → conta de destino');
  });

  it('transferência não pode ser montada como movimento comum', () => {
    expect(() => transacaoDoMovimento(movimento({ tipo: 'transferencia' }), CONTA)).toThrow();
  });

  it('compra no cartão: informativa, sem sinal, "Na fatura"', () => {
    const compra: CompraCartao & { createdAt: string } = {
      id: 'cp1',
      cartaoId: 'cc1',
      categoria: { id: 'c2', nome: 'Despesa variada' },
      descricao: 'Tecidos',
      dataCompra: '2026-09-08',
      valorTotalCentavos: 10000,
      parcelas: 3,
      primeiraFaturaMes: '2026-10',
      observacao: null,
      createdAt: '2026-09-08T12:00:00Z',
    };
    const t = transacaoDaCompra(compra, { id: 'cc1', nome: 'Nubank PJ', final: '1234', empresa: { id: 'e1', apelido: 'Loja Centro' } });
    expect(t).toMatchObject({ tipo: 'compra-cartao', status: 'na-fatura', sinal: 0, efetivo: false, descricao: 'Cartão Nubank PJ •••• 1234', complemento: '3x · 1ª fatura em Outubro/2026', href: '/cartoes/compras/cp1/editar' });
    expect(transacaoDaCompra({ ...compra, parcelas: 1 }, { id: 'cc1', nome: 'X', final: null, empresa: null }).complemento).toBe('Fatura de Outubro/2026');
  });
});

describe('ordem, mescla e totais', () => {
  it('mais recente primeiro; no mesmo dia, o registro mais novo', () => {
    const itens = [item({ chave: 'a', data: '2026-09-01' }), item({ chave: 'b', data: '2026-09-03', ordem: '1' }), item({ chave: 'c', data: '2026-09-03', ordem: '2' })];
    expect([...itens].sort(compararTransacoes).map((t) => t.chave)).toEqual(['c', 'b', 'a']);
  });

  it('mescla fontes; fonte cortada corta a lista na data segura', () => {
    const cortada = { itens: [item({ chave: 'x1', data: '2026-09-20' }), item({ chave: 'x2', data: '2026-09-10' })], truncado: true };
    const completa = { itens: [item({ chave: 'y1', data: '2026-09-15' }), item({ chave: 'y2', data: '2026-09-10' }), item({ chave: 'y3', data: '2026-09-01' })], truncado: false };
    const r = mesclarFontes([cortada, completa]);
    // 10/09 e antes podem estar incompletos na fonte cortada: ficam de fora.
    expect(r.itens.map((t) => t.chave)).toEqual(['x1', 'y1']);
    expect(r.truncado).toBe(true);
    expect(mesclarFontes([completa]).itens.map((t) => t.chave)).toEqual(['y1', 'y2', 'y3']);
  });

  it('totais: transferências, ajustes e compras não entram; obrigação separada do caixa', () => {
    const r = resumirTransacoes([
      item({ chave: 'e', data: HOJE, tipo: 'entrada', valorCentavos: 100000 }),
      item({ chave: 'ep', data: HOJE, tipo: 'entrada', efetivo: false, status: 'previsto', valorCentavos: 5000 }),
      item({ chave: 'p', data: HOJE, tipo: 'pagamento', status: 'pago', sinal: -1, valorCentavos: 30000 }),
      item({ chave: 'c', data: HOJE, tipo: 'conta-a-pagar', status: 'atrasado', sinal: -1, efetivo: false, valorCentavos: 2000 }),
      item({ chave: 'c2', data: HOJE, tipo: 'conta-a-pagar', status: 'pendente', sinal: -1, efetivo: false, valorCentavos: 3000 }),
      item({ chave: 't', data: HOJE, tipo: 'transferencia', sinal: 0, valorCentavos: 999999 }),
      item({ chave: 'a', data: HOJE, tipo: 'ajuste', sinal: -1, valorCentavos: 888888 }),
      item({ chave: 'cc', data: HOJE, tipo: 'compra-cartao', status: 'na-fatura', sinal: 0, efetivo: false, valorCentavos: 777777 }),
    ]);
    expect(r).toEqual({ entradasCentavos: 100000, pagamentosCentavos: 30000, aPagarCentavos: 5000, atrasadas: 1, aReceberCentavos: 5000, quantidade: 8 });
  });

  it('agrupa por dia mantendo a ordem', () => {
    const grupos = agruparPorData([item({ chave: 'a', data: '2026-09-03' }), item({ chave: 'b', data: '2026-09-03' }), item({ chave: 'c', data: '2026-09-01' })]);
    expect(grupos.map((g) => [g.data, g.itens.length])).toEqual([
      ['2026-09-03', 2],
      ['2026-09-01', 1],
    ]);
  });
});

describe('uso das categorias', () => {
  it('em uso quando qualquer registro usa a categoria', () => {
    expect(categoriaEmUso(USO_VAZIO)).toBe(false);
    expect(categoriaEmUso({ lancamentos: 0, compras: 0, cartoes: 1 })).toBe(true);
  });

  it('descrição com plural correto', () => {
    expect(descreverUso(USO_VAZIO)).toBe('Sem uso');
    expect(descreverUso({ lancamentos: 1, compras: 2, cartoes: 1 })).toBe('1 lançamento · 2 compras no cartão · 1 cartão');
    expect(descreverUso({ lancamentos: 12, compras: 0, cartoes: 3 })).toBe('12 lançamentos · 3 cartões');
  });
});
