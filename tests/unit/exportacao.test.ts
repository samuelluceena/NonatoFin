import { describe, expect, it } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { escaparCampoCsv, gerarCsv } from '@/features/exportacao/csv';
import { montarLinhasExportacao, nomeArquivoExportacao } from '@/features/exportacao/linhas';
import { gerarXlsx, serialExcel } from '@/features/exportacao/xlsx';
import type { Lancamento } from '@/lib/domain/tipos';

const HOJE = '2026-09-23';

const lancamento = (parcial: Partial<Lancamento>): Lancamento => ({
  id: 'x',
  empresa: { id: 'e', apelido: 'J F Lima', cnpj: '11222333000181' },
  categoria: { id: 'c', nome: 'Boleto de fornecedor' },
  conta: { id: 'k', apelido: 'Itaú PJ', final: '4321' },
  fornecedor: { id: 'f', nome: 'Via da Moda' },
  descricao: 'Compra coleção outubro',
  valorCentavos: 299500,
  vencimento: '2026-10-09',
  codigoBarras: '00190000090123456789012345678901234567890123456',
  observacao: null,
  status: 'pendente',
  pagoEm: null,
  recorrencia: { serieId: 's', parcela: 1, totalParcelas: 5 },
  fatura: null,
  createdAt: '2026-09-01T12:00:00Z',
  updatedAt: '2026-09-01T12:00:00Z',
  ...parcial,
});

const LANCAMENTOS = [
  lancamento({}),
  lancamento({
    id: 'y',
    fornecedor: { id: 'g', nome: 'Enel' },
    descricao: 'Energia; Loja "Iguatu"',
    valorCentavos: 123456,
    vencimento: '2026-09-15',
    codigoBarras: null,
    observacao: '=HYPERLINK("x")',
    status: 'pago',
    pagoEm: '2026-09-15T17:32:00Z',
    recorrencia: null,
  }),
  lancamento({ id: 'z', vencimento: '2026-09-01', recorrencia: null }),
];

describe('linhas de exportação', () => {
  const linhas = montarLinhasExportacao(LANCAMENTOS, HOJE);

  it('possui todos os campos exigidos', () => {
    expect(linhas[0]).toMatchObject({
      empresa: 'J F Lima',
      cnpj: '11.222.333/0001-81',
      categoria: 'Boleto de fornecedor',
      conta: 'Itaú PJ',
      fornecedor: 'Via da Moda',
      descricao: 'Compra coleção outubro',
      valorCentavos: 299500,
      vencimento: '2026-10-09',
      status: 'Pendente',
      parcela: 1,
      totalParcelas: 5,
    });
    expect(linhas[1].status).toBe('Pago');
    expect(linhas[1].pagamentoTexto).toBe('15/09/2026 às 14:32');
    expect(linhas[2].status).toBe('Atrasado');
  });

  it('nome do arquivo com data', () => {
    expect(nomeArquivoExportacao(HOJE, 'csv')).toBe('nonatofin-boletos-2026-09-23.csv');
  });
});

describe('CSV', () => {
  const csv = gerarCsv(montarLinhasExportacao(LANCAMENTOS, HOJE));
  const linhas = csv.replace('﻿', '').trim().split('\r\n');

  it('tem BOM UTF-8, separador ; e cabeçalho', () => {
    expect(csv.startsWith('﻿')).toBe(true);
    expect(linhas[0]).toBe(
      'Empresa;CNPJ;Categoria;Conta;Fornecedor;Nome/Descrição;Valor;Vencimento;Código;Status;Parcela;Total de parcelas;Observação;Pagamento',
    );
    expect(linhas).toHaveLength(4);
  });

  it('usa formato brasileiro de valor e data', () => {
    expect(linhas[1]).toBe(
      'J F Lima;11.222.333/0001-81;Boleto de fornecedor;Itaú PJ;Via da Moda;Compra coleção outubro;2.995,00;09/10/2026;00190000090123456789012345678901234567890123456;Pendente;1;5;;',
    );
  });

  it('escapa aspas/separador e neutraliza fórmulas', () => {
    expect(linhas[2]).toContain('"Energia; Loja ""Iguatu"""');
    expect(linhas[2]).toContain(`"'=HYPERLINK(""x"")"`);
    expect(escaparCampoCsv('+123')).toBe("'+123");
    expect(escaparCampoCsv('normal')).toBe('normal');
  });
});

describe('XLSX', () => {
  it('gera um pacote xlsx válido com as planilhas esperadas', () => {
    const arquivos = unzipSync(gerarXlsx(montarLinhasExportacao(LANCAMENTOS, HOJE)));
    expect(Object.keys(arquivos).sort()).toEqual(
      [
        '[Content_Types].xml',
        '_rels/.rels',
        'xl/_rels/workbook.xml.rels',
        'xl/styles.xml',
        'xl/workbook.xml',
        'xl/worksheets/sheet1.xml',
      ].sort(),
    );
    const planilha = strFromU8(arquivos['xl/worksheets/sheet1.xml']);
    expect(planilha).toContain('Via da Moda');
    expect(planilha).toContain('<v>2995</v>');
    expect(planilha).toContain('&quot;Iguatu&quot;');
    // código como texto (evita notação científica)
    expect(planilha).toContain('t="inlineStr"><is><t xml:space="preserve">00190000090123456789012345678901234567890123456</t>');
  });

  it('converte datas para o serial do Excel', () => {
    expect(serialExcel('1900-03-01')).toBe(61);
    expect(serialExcel('2026-09-23')).toBe(46288);
  });
});
