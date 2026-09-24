import { describe, expect, it } from 'vitest';
import {
  FILTROS_PADRAO,
  OPCOES_PERIODO,
  STATUS_FILTRO,
  atendeCriterio,
  consultaDosFiltros,
  criterioDosFiltros,
  faixaDoPeriodo,
  lerFiltros,
  linkDaLista,
  parametrosDosFiltros,
  periodoDoTipo,
  periodoEstaNaUrl,
  quantidadeFiltrosExtras,
  rotuloDoPeriodo,
  sanitizarBusca,
  type FiltrosLista,
  type Periodo,
} from '@/lib/domain/filtros';

const HOJE = '2026-09-23'; // quarta-feira
const ID = '3f2b8a1e-6c1d-4e0a-9b5f-1a2b3c4d5e6f';
const ID2 = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

describe('período', () => {
  it('faixas dos períodos rápidos', () => {
    expect(faixaDoPeriodo({ tipo: 'hoje' }, HOJE)).toEqual({ de: HOJE, ate: HOJE });
    expect(faixaDoPeriodo({ tipo: 'amanha' }, HOJE)).toEqual({ de: '2026-09-24', ate: '2026-09-24' });
    expect(faixaDoPeriodo({ tipo: 'semana' }, HOJE)).toEqual({ de: '2026-09-21', ate: '2026-09-27' });
    expect(faixaDoPeriodo({ tipo: 'mes' }, HOJE)).toEqual({ de: '2026-09-01', ate: '2026-09-30' });
    expect(faixaDoPeriodo({ tipo: 'proximo-mes' }, HOJE)).toEqual({ de: '2026-10-01', ate: '2026-10-31' });
    expect(faixaDoPeriodo({ tipo: 'todos' }, HOJE)).toEqual({});
  });

  it('próximo mês em dezembro vira janeiro do ano seguinte', () => {
    expect(faixaDoPeriodo({ tipo: 'proximo-mes' }, '2026-12-31')).toEqual({ de: '2027-01-01', ate: '2027-01-31' });
  });

  it('períodos personalizados: mês, dia e intervalo', () => {
    expect(faixaDoPeriodo({ tipo: 'mes-escolhido', mes: '2028-02' }, HOJE)).toEqual({ de: '2028-02-01', ate: '2028-02-29' });
    expect(faixaDoPeriodo({ tipo: 'dia', data: '2026-10-05' }, HOJE)).toEqual({ de: '2026-10-05', ate: '2026-10-05' });
    expect(faixaDoPeriodo({ tipo: 'intervalo', de: '2026-09-10', ate: '2026-09-20' }, HOJE)).toEqual({ de: '2026-09-10', ate: '2026-09-20' });
    expect(faixaDoPeriodo({ tipo: 'intervalo', de: '2026-09-10', ate: '' }, HOJE)).toEqual({ de: '2026-09-10', ate: undefined });
  });

  it('intervalo com datas trocadas é desinvertido', () => {
    expect(faixaDoPeriodo({ tipo: 'intervalo', de: '2026-09-20', ate: '2026-09-10' }, HOJE)).toEqual({ de: '2026-09-10', ate: '2026-09-20' });
  });

  it('rótulos', () => {
    expect(rotuloDoPeriodo({ tipo: 'mes' })).toBe('Este mês');
    expect(rotuloDoPeriodo({ tipo: 'mes-escolhido', mes: '2026-12' })).toMatch(/dezembro/i);
    expect(rotuloDoPeriodo({ tipo: 'dia', data: '2026-10-05' })).toBe('05/10/2026');
    expect(rotuloDoPeriodo({ tipo: 'intervalo', de: '2026-09-01', ate: '2026-09-15' })).toBe('01/09/2026 a 15/09/2026');
    expect(rotuloDoPeriodo({ tipo: 'intervalo', de: '2026-09-01', ate: '' })).toBe('A partir de 01/09/2026');
    expect(rotuloDoPeriodo({ tipo: 'intervalo', de: '', ate: '' })).toBe('Todo o período');
  });

  it('cada opção do seletor gera um período válido', () => {
    for (const o of OPCOES_PERIODO) expect(periodoDoTipo(o.valor, HOJE).tipo).toBe(o.valor);
    expect(periodoDoTipo('mes-escolhido', HOJE)).toEqual({ tipo: 'mes-escolhido', mes: '2026-09' });
    expect(periodoDoTipo('intervalo', HOJE)).toEqual({ tipo: 'intervalo', de: '2026-09-01', ate: HOJE });
  });
});

describe('período × status', () => {
  const mes: Periodo = { tipo: 'mes' };

  it('status sozinho (todo o período)', () => {
    const todos: Periodo = { tipo: 'todos' };
    expect(criterioDosFiltros({ periodo: todos, status: 'todos' }, HOJE)).toEqual({ ordem: 'asc' });
    expect(criterioDosFiltros({ periodo: todos, status: 'pendentes' }, HOJE)).toMatchObject({ status: 'pendente', vencimentoDe: HOJE, vencimentoAte: undefined });
    expect(criterioDosFiltros({ periodo: todos, status: 'atrasados' }, HOJE)).toMatchObject({ status: 'pendente', vencimentoDe: undefined, vencimentoAte: '2026-09-22' });
    expect(criterioDosFiltros({ periodo: todos, status: 'em-aberto' }, HOJE)).toEqual({ status: 'pendente', ordem: 'asc' });
    expect(criterioDosFiltros({ periodo: todos, status: 'pagos' }, HOJE)).toMatchObject({ status: 'pago', ordem: 'desc' });
  });

  it('interseção do período com o status', () => {
    expect(criterioDosFiltros({ periodo: mes, status: 'atrasados' }, HOJE)).toMatchObject({ vencimentoDe: '2026-09-01', vencimentoAte: '2026-09-22' });
    expect(criterioDosFiltros({ periodo: mes, status: 'pendentes' }, HOJE)).toMatchObject({ vencimentoDe: HOJE, vencimentoAte: '2026-09-30' });
    expect(criterioDosFiltros({ periodo: mes, status: 'pagos' }, HOJE)).toMatchObject({ vencimentoDe: '2026-09-01', vencimentoAte: '2026-09-30', status: 'pago' });
  });

  it('interseção vazia não traz nada (atrasados do próximo mês)', () => {
    const c = criterioDosFiltros({ periodo: { tipo: 'proximo-mes' }, status: 'atrasados' }, HOJE);
    for (const vencimento of ['2026-09-10', '2026-10-15', '2026-10-31']) {
      expect(atendeCriterio({ status: 'pendente', vencimento }, c)).toBe(false);
    }
  });

  it('aplica critérios em memória', () => {
    const atrasados = criterioDosFiltros({ periodo: { tipo: 'todos' }, status: 'atrasados' }, HOJE);
    expect(atendeCriterio({ status: 'pendente', vencimento: '2026-09-22' }, atrasados)).toBe(true);
    expect(atendeCriterio({ status: 'pendente', vencimento: HOJE }, atrasados)).toBe(false);
    expect(atendeCriterio({ status: 'pago', vencimento: '2026-09-01' }, atrasados)).toBe(false);
  });

  it('possui os status da tela', () => {
    expect(STATUS_FILTRO.map((s) => s.rotulo)).toEqual(['Todos', 'Em aberto', 'A vencer', 'Atrasados', 'Pagos']);
  });
});

describe('URL', () => {
  it('sem parâmetros = este mês, todos', () => {
    expect(lerFiltros({}, HOJE)).toEqual(FILTROS_PADRAO);
    expect(periodoEstaNaUrl({}, HOJE)).toBe(false);
  });

  it('pesquisa sem período procura em todo o período', () => {
    expect(lerFiltros({ q: 'enel' }, HOJE)).toMatchObject({ periodo: { tipo: 'todos' }, busca: 'enel' });
    expect(lerFiltros({ q: 'enel', periodo: 'mes' }, HOJE)).toMatchObject({ periodo: { tipo: 'mes' } });
  });

  it('lê todos os filtros', () => {
    const f = lerFiltros(
      { periodo: 'intervalo', de: '2026-09-01', ate: '2026-09-15', status: 'pagos', fornecedor: ID, categoria: ID2, conta: 'sem', q: 'loja' },
      HOJE,
    );
    expect(f).toEqual({
      periodo: { tipo: 'intervalo', de: '2026-09-01', ate: '2026-09-15' },
      status: 'pagos',
      fornecedorId: ID,
      categoriaId: ID2,
      contaId: 'sem',
      busca: 'loja',
    });
  });

  it('ignora valores inválidos (sem erro)', () => {
    const f = lerFiltros(
      { periodo: 'xyz', status: 'nada', fornecedor: '1 or 1=1', categoria: ['a', 'b'], conta: 'qualquer', q: 'a,b.c' },
      HOJE,
    );
    expect(f).toEqual({ ...FILTROS_PADRAO, periodo: { tipo: 'todos' }, busca: 'a b c' });
    expect(lerFiltros({ periodo: 'mes-escolhido', mes: '2026-13' }, HOJE).periodo).toEqual({ tipo: 'mes-escolhido', mes: '2026-09' });
    expect(lerFiltros({ periodo: 'dia', dia: '2026-02-30' }, HOJE).periodo).toEqual({ tipo: 'dia', data: HOJE });
    expect(lerFiltros({ periodo: 'intervalo', de: 'ontem' }, HOJE).periodo).toEqual({ tipo: 'intervalo', de: '', ate: '' });
  });

  it('links antigos (?filtro=) continuam funcionando', () => {
    expect(lerFiltros({ filtro: 'semana' }, HOJE)).toMatchObject({ periodo: { tipo: 'semana' }, status: 'todos' });
    expect(lerFiltros({ filtro: 'atrasados' }, HOJE)).toMatchObject({ periodo: { tipo: 'todos' }, status: 'atrasados' });
    expect(lerFiltros({ filtro: 'pendentes' }, HOJE)).toMatchObject({ periodo: { tipo: 'todos' }, status: 'pendentes' });
    expect(lerFiltros({ filtro: 'pagos' }, HOJE)).toMatchObject({ periodo: { tipo: 'todos' }, status: 'pagos' });
    expect(lerFiltros({ filtro: 'todos', q: 'x' }, HOJE)).toMatchObject({ periodo: { tipo: 'todos' }, busca: 'x' });
    expect(periodoEstaNaUrl({ filtro: 'hoje' }, HOJE)).toBe(true);
  });

  it('ida e volta: parâmetros → filtros → parâmetros', () => {
    const casos: FiltrosLista[] = [
      FILTROS_PADRAO,
      { ...FILTROS_PADRAO, periodo: { tipo: 'todos' }, status: 'atrasados' },
      { ...FILTROS_PADRAO, periodo: { tipo: 'mes' }, busca: 'enel' },
      { ...FILTROS_PADRAO, periodo: { tipo: 'todos' }, busca: 'enel' },
      { ...FILTROS_PADRAO, periodo: { tipo: 'mes-escolhido', mes: '2026-11' }, fornecedorId: ID },
      { ...FILTROS_PADRAO, periodo: { tipo: 'dia', data: '2026-10-01' }, contaId: 'sem' },
      { ...FILTROS_PADRAO, periodo: { tipo: 'intervalo', de: '2026-09-01', ate: '' }, categoriaId: ID2, status: 'pagos' },
    ];
    for (const f of casos) expect(lerFiltros(parametrosDosFiltros(f), HOJE)).toEqual(f);
  });

  it('só vai para a URL o que difere do padrão', () => {
    expect(consultaDosFiltros(FILTROS_PADRAO)).toBe('');
    expect(consultaDosFiltros({ ...FILTROS_PADRAO, periodo: { tipo: 'todos' }, busca: 'x' })).toBe('?q=x');
    expect(linkDaLista({ periodo: { tipo: 'todos' }, status: 'atrasados' })).toBe('/boletos?periodo=todos&status=atrasados');
  });

  it('conta os filtros extras', () => {
    expect(quantidadeFiltrosExtras(FILTROS_PADRAO)).toBe(0);
    expect(quantidadeFiltrosExtras({ ...FILTROS_PADRAO, fornecedorId: ID, contaId: 'sem' })).toBe(2);
  });
});

describe('pesquisa', () => {
  it('sanitiza a busca contra injeção na sintaxe do PostgREST', () => {
    expect(sanitizarBusca('via,descricao.eq.x)')).toBe('via descricao eq x');
    expect(sanitizarBusca('  Via   da  Moda ')).toBe('Via da Moda');
    expect(sanitizarBusca('%*')).toBe('');
    expect(sanitizarBusca(null)).toBe('');
    expect(sanitizarBusca('a'.repeat(200))).toHaveLength(80);
  });
});
