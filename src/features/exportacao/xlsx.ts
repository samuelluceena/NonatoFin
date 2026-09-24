/**
 * Gerador mínimo de planilha Excel (.xlsx) sem dependências pesadas.
 * Usa apenas `fflate` (zip, ~8 KB). Valores são numéricos com formato de
 * moeda e datas são datas reais do Excel (formato dd/mm/aaaa).
 */
import { zipSync, strToU8 } from 'fflate';
import { partesDaData, type DataISO } from '@/lib/domain/datas';
import { CABECALHO_EXPORTACAO, type LinhaExportacao } from './linhas';

type Celula =
  | { tipo: 'texto'; valor: string; estilo?: number }
  | { tipo: 'numero'; valor: number; estilo?: number };

const ESTILO_MOEDA = 1;
const ESTILO_DATA = 2;
const ESTILO_CABECALHO = 3;

function escaparXml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // Remove caracteres de controle inválidos em XML 1.0.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

/** Número de série de data do Excel (dias desde 30/12/1899). */
export function serialExcel(data: DataISO): number {
  const { ano, mes, dia } = partesDaData(data);
  return Math.round((Date.UTC(ano, mes - 1, dia) - Date.UTC(1899, 11, 30)) / 86_400_000);
}

function nomeColuna(indice: number): string {
  let n = indice + 1;
  let nome = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    nome = String.fromCharCode(65 + r) + nome;
    n = Math.floor((n - 1) / 26);
  }
  return nome;
}

function celulaXml(celula: Celula, ref: string): string {
  const s = celula.estilo ? ` s="${celula.estilo}"` : '';
  if (celula.tipo === 'numero') return `<c r="${ref}"${s}><v>${celula.valor}</v></c>`;
  if (celula.valor === '') return '';
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escaparXml(celula.valor)}</t></is></c>`;
}

function linhaParaCelulas(l: LinhaExportacao): Celula[] {
  const texto = (valor: string): Celula => ({ tipo: 'texto', valor });
  return [
    texto(l.empresa),
    texto(l.cnpj),
    texto(l.categoria),
    texto(l.conta),
    texto(l.fornecedor),
    texto(l.descricao),
    { tipo: 'numero', valor: l.valorCentavos / 100, estilo: ESTILO_MOEDA },
    { tipo: 'numero', valor: serialExcel(l.vencimento), estilo: ESTILO_DATA },
    texto(l.codigo), // texto: evita notação científica em códigos de 47/48 dígitos
    texto(l.status),
    l.parcela === null ? texto('') : { tipo: 'numero', valor: l.parcela },
    l.totalParcelas === null ? texto('') : { tipo: 'numero', valor: l.totalParcelas },
    texto(l.observacao),
    l.dataPagamento
      ? { tipo: 'numero', valor: serialExcel(l.dataPagamento), estilo: ESTILO_DATA }
      : texto(''),
  ];
}

const LARGURAS = [22, 20, 20, 18, 28, 36, 16, 13, 52, 12, 9, 9, 40, 13];

function planilhaXml(linhas: readonly LinhaExportacao[]): string {
  const cabecalho: Celula[] = CABECALHO_EXPORTACAO.map((valor) => ({
    tipo: 'texto',
    valor,
    estilo: ESTILO_CABECALHO,
  }));
  const todas = [cabecalho, ...linhas.map(linhaParaCelulas)];
  const rows = todas
    .map(
      (celulas, i) =>
        `<row r="${i + 1}">${celulas.map((c, j) => celulaXml(c, `${nomeColuna(j)}${i + 1}`)).join('')}</row>`,
    )
    .join('');
  const ultimaColuna = nomeColuna(CABECALHO_EXPORTACAO.length - 1);
  const cols = LARGURAS.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    `<cols>${cols}</cols>` +
    `<sheetData>${rows}</sheetData>` +
    `<autoFilter ref="A1:${ultimaColuna}${todas.length}"/>` +
    '</worksheet>'
  );
}

const ESTILOS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;R$&quot; #,##0.00"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/></numFmts>' +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="4">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '</cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

export function gerarXlsx(linhas: readonly LinhaExportacao[]): Uint8Array {
  const arquivos: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '</Types>',
    ),
    '_rels/.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>',
    ),
    'xl/workbook.xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<sheets><sheet name="Boletos" sheetId="1" r:id="rId1"/></sheets>' +
        '<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">Boletos!$A$1:$N$' +
        String(linhas.length + 1) +
        '</definedName></definedNames>' +
        '</workbook>',
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        '</Relationships>',
    ),
    'xl/styles.xml': strToU8(ESTILOS),
    'xl/worksheets/sheet1.xml': strToU8(planilhaXml(linhas)),
  };
  return zipSync(arquivos, { level: 6 });
}
