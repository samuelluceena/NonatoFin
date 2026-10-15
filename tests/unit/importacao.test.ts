import { describe, expect, it } from 'vitest';
import {
  aplicarDadosDoBanco,
  analisarArquivo,
  codigoNaDescricao,
  dataDoTexto,
  decodificarArquivo,
  ehValorEstimado,
  ErroImportacao,
  fornecedorDaDescricao,
  fornecedoresParecidos,
  lerTabelaCsv,
  observacaoDaLinha,
  pareceFaturaDeCartao,
  resumirImportacao,
  selecionarLinhas,
  valorDoTexto,
  type LinhaImportacao,
} from '@/lib/domain/importacao';

const CODIGO = '23793397049026090648381004730008797850000052757';
const PERIODO = { de: '2026-10-14', ate: '2027-12-31' };

/** CSV no formato exportado pelo app financeiro (aspas, ";", ponto decimal, rodapé de total). */
const CSV = [
  '"Date";"Description";"Value";"Account";"Status";"Category";"Subcategory";"Tags"',
  '"30/12/2027";"Aluguel | Josube Variedades ";"-1049.16";"Carteira";"Pending";"Despesas - Josube Variedades";"";""', // 2 importar
  '"20/10/2026";"Via do Terno(4/6)";"-886.20";"BB | Cristina";"Pending";"Capital de Giro e Consorcio";"";""', // 3 importar
  '"20/10/2026";"Via da Moda (4/6)";"-886.20";"BB | Cristina";"Pending";"Mercadoria ";"";""', // 4 importar (dívida diferente)
  '"16/11/2026";"Assinaturas";"-68.69";"Carteira";"Pending";"Custos Operacionais";"";""', // 5 importar
  '"16/11/2026";"Assinaturas";"-68.69";"Carteira";"Pending";"Custos Operacionais";"";""', // 6 repetida
  '"16/10/2026";"Brasspress | Código na Descrição";"-527.57";"BB | Cristina";"Pending";"Capital de Giro e Consorcio";"";""', // 7 provável duplicata
  `"16/10/2026";"Braspress ${CODIGO}";"-527.57";"BB | Cristina";"Pending";"Mercadoria ";"";""`, // 8 importar (tem código)
  '"16/11/2026";"Reajuste de fatura";"-2240.84";"Carteira";"Pending";"Reajuste de fatura";"";""', // 9 cartão
  '"16/10/2027";"Reajuste de fatura";"0";"Carteira";"Pending";"Reajuste de fatura";"";""', // 10 valor zero
  '"05/11/2026";"Cartao Mercado Pago | J F Lima Confeccoes(2/12)";"-500.00";"BB | J F Lima";"Pending";"Capital de Giro e Consorcio";"";""', // 11 cartão
  '"10/11/2026";"Energia | Casa | Atualizar ";"-185.29";"Carteira";"Pending";"Despesas Pessoais ";"";""', // 12 importar, estimado
  '"13/10/2026";"Salario | Dayane";"-843.00";"BB | Cristina";"Pending";"Capital de Giro e Consorcio";"";""', // 13 vencida
  '"01/10/2026";"Internet | Josube Iguatu";"-123.02";"BB | Cristina";"Paid";"Despesas - Josube Social(Iguatu)";"";""', // 14 paga
  '"02/01/2028";"Aluguel | Juazeiro";"-1000.00";"Carteira";"Pending";"Despesas - Josube Social(Juazeiro)";"";""', // 15 depois do período
  '"14/10/2026";"Venda balcão";"350.00";"Carteira";"Pending";"Receitas";"";""', // 16 entrada
  '"14/10/2026";"Santander | Jozube (36/88)";"-2000.00";"BB | Cristina";"Pending";"Capital de Giro e Consorcio";"";""', // 17 importar
  '"14/10/2026";"Empréstimo Casa | Santander(17/30)";"-2000.00";"BB | Cristina";"Pending";"Capital de Giro e Consorcio";"";""', // 18 importar (empréstimo diferente)
  '"";"";"";"";"";"";"";""', // 19 em branco
  '"Total (incomes - expenses)";"";"-10000.00";"";"";"";"";""', // 20 rodapé
].join('\r\n');

const porNumero = (linhas: LinhaImportacao[], n: number) => linhas.find((l) => l.numero === n)!;

describe('leitura do arquivo', () => {
  it('decodifica UTF-16 (com e sem BOM), UTF-8 e Windows-1252', () => {
    const texto = 'Descrição;Valor';
    const utf16 = new Uint8Array([0xff, 0xfe, ...Array.from(texto).flatMap((c) => [c.charCodeAt(0) & 0xff, c.charCodeAt(0) >> 8])]);
    expect(decodificarArquivo(utf16)).toBe(texto);
    expect(decodificarArquivo(utf16.subarray(2))).toBe(texto);
    expect(decodificarArquivo(new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(texto)]))).toBe(texto);
    expect(decodificarArquivo(new TextEncoder().encode(texto))).toBe(texto);
    expect(decodificarArquivo(new Uint8Array([0x44, 0x65, 0x73, 0x63, 0x72, 0x69, 0xe7, 0xe3, 0x6f]))).toBe('Descrição');
  });

  it('lê CSV com aspas, aspas duplicadas, quebra de linha entre aspas e separador ; ou ,', () => {
    expect(lerTabelaCsv('a;b\r\n"x;1";"di""z"\n"linha\nnova";3')).toEqual([
      ['a', 'b'],
      ['x;1', 'di"z'],
      ['linha\nnova', '3'],
    ]);
    expect(lerTabelaCsv('Data,Valor\n01/01/2027,"1,50"')).toEqual([
      ['Data', 'Valor'],
      ['01/01/2027', '1,50'],
    ]);
  });

  it('valores: ponto ou vírgula decimal, milhar, R$ e sinal', () => {
    expect(valorDoTexto('-1049.16')).toBe(-104916);
    expect(valorDoTexto('-1.049,16')).toBe(-104916);
    expect(valorDoTexto('R$ 1.234,56')).toBe(123456);
    expect(valorDoTexto('1,234.5')).toBe(123450);
    expect(valorDoTexto('1049')).toBe(104900);
    expect(valorDoTexto('0')).toBe(0);
    expect(valorDoTexto('-0.5')).toBe(-50);
    expect(valorDoTexto('abc')).toBeNull();
    expect(valorDoTexto('1.2.3')).toBeNull();
    // Ponto seguido de 3 dígitos = milhar (padrão brasileiro).
    expect(valorDoTexto('10.123')).toBe(1012300);
    expect(valorDoTexto('10.1234')).toBeNull();
    expect(valorDoTexto('')).toBeNull();
  });

  it('datas: DD/MM/AAAA ou AAAA-MM-DD, sem datas impossíveis', () => {
    expect(dataDoTexto('30/12/2027')).toBe('2027-12-30');
    expect(dataDoTexto('2027-12-30')).toBe('2027-12-30');
    expect(dataDoTexto('31/02/2027')).toBeNull();
    expect(dataDoTexto('Total')).toBeNull();
  });

  it('recusa arquivo sem as colunas esperadas', () => {
    expect(() => analisarArquivo('nome;quantia\nx;1', PERIODO)).toThrow(ErroImportacao);
    expect(() => analisarArquivo('', PERIODO)).toThrow(ErroImportacao);
  });
});

describe('regras das descrições', () => {
  it('fornecedor = descrição sem a parcela final (e sem código de barras)', () => {
    expect(fornecedorDaDescricao('Via da Moda (3/6)')).toBe('Via da Moda');
    expect(fornecedorDaDescricao('Via da Moda(3/6)')).toBe('Via da Moda');
    expect(fornecedorDaDescricao('Santander | Jozube (36/88)')).toBe('Santander | Jozube');
    expect(fornecedorDaDescricao('Empréstimo Casa | Santander(17/30)')).toBe('Empréstimo Casa | Santander');
    expect(fornecedorDaDescricao(`Braspress ${CODIGO}`)).toBe('Braspress');
    expect(fornecedorDaDescricao('Energia | Casa | Atualizar ')).toBe('Energia | Casa | Atualizar');
    // Parcela que não está no fim fica.
    expect(fornecedorDaDescricao('Loja (1/2) Centro')).toBe('Loja (1/2) Centro');
  });

  it('código de barras escrito na descrição', () => {
    expect(codigoNaDescricao(`Braspress ${CODIGO}`)).toBe(CODIGO);
    expect(codigoNaDescricao('Brasspress | Código na Descrição')).toBeNull();
    expect(codigoNaDescricao('Pedido 12345678901234567890')).toBeNull();
  });

  it('valor estimado ("Atualizar")', () => {
    expect(ehValorEstimado('Energia | Casa | Atualizar ')).toBe(true);
    expect(ehValorEstimado('Agua Casa | ATUALIZAR')).toBe(true);
    expect(ehValorEstimado('Atualização Sistema | J F Lima')).toBe(false);
  });

  it('fornecedores parecidos: erro de digitação sim; dívidas diferentes não', () => {
    expect(fornecedoresParecidos('Brasspress | Código na Descrição', 'Braspress')).toBe(true);
    expect(fornecedoresParecidos('Via do Terno', 'Via da Moda')).toBe(false);
    expect(fornecedoresParecidos('Santander | Jozube', 'Empréstimo Casa | Santander')).toBe(false);
    expect(fornecedoresParecidos('Via da Moda', 'Via da moda')).toBe(true);
  });

  it('possível fatura de cartão', () => {
    expect(pareceFaturaDeCartao('Reajuste de fatura', 'Reajuste de fatura')).toBe(true);
    expect(pareceFaturaDeCartao('Cartao Mercado Pago | J F Lima Confeccoes(2/12)', 'Capital de Giro')).toBe(true);
    expect(pareceFaturaDeCartao('Correios | Fatura Mensal', 'Custos Operacionais')).toBe(false);
    expect(pareceFaturaDeCartao('Nubank PJ março', 'Despesas', ['Nubank PJ'])).toBe(true);
  });
});

describe('análise do arquivo', () => {
  const analise = analisarArquivo(CSV, PERIODO);
  const l = (n: number) => porNumero(analise.linhas, n);

  it('classifica cada linha pela primeira regra que vale', () => {
    expect(analise.totalLinhasArquivo).toBe(19);
    expect([2, 3, 4, 5, 8, 12, 17, 18].map((n) => l(n).situacao)).toEqual(Array(8).fill('importar'));
    expect(l(6)).toMatchObject({ situacao: 'conferir', motivo: 'duplicada-no-arquivo', sugestao: 'nao-importar', detalhe: 'Igual à linha 5' });
    expect(l(7)).toMatchObject({ situacao: 'conferir', motivo: 'provavel-duplicada', sugestao: 'nao-importar' });
    expect(l(9)).toMatchObject({ situacao: 'conferir', motivo: 'possivel-fatura-cartao', sugestao: 'nao-importar' });
    expect(l(11)).toMatchObject({ situacao: 'conferir', motivo: 'possivel-fatura-cartao' });
    expect(l(10)).toMatchObject({ situacao: 'excluida', motivo: 'valor-zero' });
    expect(l(13)).toMatchObject({ situacao: 'excluida', motivo: 'vencida' });
    expect(l(14)).toMatchObject({ situacao: 'excluida', motivo: 'paga' });
    expect(l(15)).toMatchObject({ situacao: 'excluida', motivo: 'fora-do-periodo' });
    expect(l(16)).toMatchObject({ situacao: 'excluida', motivo: 'entrada' });
    expect(l(19)).toMatchObject({ situacao: 'excluida', motivo: 'sem-dados' });
    expect(l(20)).toMatchObject({ situacao: 'excluida', motivo: 'sem-dados' });
  });

  it('preserva a descrição, valor positivo em centavos, conta e categoria de origem', () => {
    expect(l(2)).toMatchObject({
      vencimento: '2027-12-30',
      descricao: 'Aluguel | Josube Variedades',
      valorCentavos: 104916,
      contaOrigem: 'Carteira',
      categoria: 'Despesas - Josube Variedades',
      fornecedor: 'Aluguel | Josube Variedades',
    });
    expect(l(4).categoria).toBe('Mercadoria');
    expect(l(8)).toMatchObject({ descricao: `Braspress ${CODIGO}`, fornecedor: 'Braspress', codigoBarras: CODIGO });
    expect(l(12).valorEstimado).toBe(true);
  });

  it('o dia de início entra (14/10) e o anterior não (13/10)', () => {
    expect(l(17).vencimento).toBe('2026-10-14');
    expect(l(17).situacao).toBe('importar');
    expect(l(13).situacao).toBe('excluida');
  });

  it('linhas idênticas têm chaves diferentes pela ocorrência', () => {
    expect(l(5).chave).not.toBe(l(6).chave);
    expect(l(5).chave.endsWith('|1')).toBe(true);
    expect(l(6).chave.endsWith('|2')).toBe(true);
    // A chave não depende de maiúsculas, acentos ou espaços.
    const outra = analisarArquivo(CSV.replace('"Aluguel | Josube Variedades "', '"ALUGUEL  |  Josube Variedades"'), PERIODO);
    expect(porNumero(outra.linhas, 2).chave).toBe(l(2).chave);
  });

  it('com as sugestões: só uma Assinatura, só a Braspress com código, sem faturas de cartão', () => {
    const { importar, semDecisao } = selecionarLinhas(analise.linhas, { incluir: [], excluir: [] });
    expect(semDecisao).toEqual([]);
    expect(importar.map((x) => x.numero)).toEqual([2, 3, 4, 5, 8, 12, 17, 18]);
    const resumo = resumirImportacao(analise, importar);
    expect(resumo.importar).toMatchObject({ quantidade: 8, totalCentavos: 104916 + 88620 * 2 + 6869 + 52757 + 18529 + 200000 * 2 });
    expect(resumo.valoresEstimados).toBe(1);
    expect(resumo.comCodigoDeBarras).toBe(1);
    expect(resumo.porConta.map((c) => c.rotulo)).toEqual(['BB | Cristina', 'Carteira']);
    expect(resumo.porMotivo.find((m) => m.motivo === 'possivel-fatura-cartao')?.quantidade).toBe(2);
  });

  it('decisões: incluir uma fatura separada e tirar uma linha da importação', () => {
    const { importar } = selecionarLinhas(analise.linhas, { incluir: [l(9).chave], excluir: [l(2).chave] });
    expect(importar.map((x) => x.numero)).toEqual([3, 4, 5, 8, 9, 12, 17, 18]);
  });
});

describe('dados do NonatoFin', () => {
  const analise = analisarArquivo(CSV, PERIODO);

  it('linhas já importadas saem; coincidências exigem decisão (sem sugestão)', () => {
    const chave2 = porNumero(analise.linhas, 2).chave;
    const r = aplicarDadosDoBanco(analise, {
      chavesImportadas: new Set([chave2]),
      existentes: [{ id: 'x', vencimento: '2026-10-20', valorCentavos: 88620, descricao: 'Via do Terno 4/6', fornecedor: 'Via do Terno', status: 'pendente' }],
    });
    expect(porNumero(r.linhas, 2)).toMatchObject({ situacao: 'excluida', motivo: 'ja-importada' });
    for (const n of [3, 4]) {
      expect(porNumero(r.linhas, n)).toMatchObject({ situacao: 'conferir', motivo: 'coincide-com-existente', sugestao: null });
      expect(porNumero(r.linhas, n).detalhe).toContain('Via do Terno');
    }
    const sem = selecionarLinhas(r.linhas, { incluir: [], excluir: [] });
    expect(sem.semDecisao.map((x) => x.numero)).toEqual([3, 4]);
    const decidido = selecionarLinhas(r.linhas, { incluir: [porNumero(r.linhas, 4).chave], excluir: [porNumero(r.linhas, 3).chave] });
    expect(decidido.semDecisao).toEqual([]);
    expect(decidido.importar.map((x) => x.numero)).toContain(4);
    expect(decidido.importar.map((x) => x.numero)).not.toContain(3);
    // A análise original não é alterada.
    expect(porNumero(analise.linhas, 2).situacao).toBe('importar');
  });

  it('observação: origem, conta original e aviso de valor estimado', () => {
    const obs = observacaoDaLinha(porNumero(analise.linhas, 12), 'Dados Gerais Financeiro.csv', '2026-10-14');
    expect(obs).toContain('Importado de "Dados Gerais Financeiro.csv" em 14/10/2026 (linha 12).');
    expect(obs).toContain('Conta original: Carteira.');
    expect(obs).toContain('Valor estimado');
  });
});
