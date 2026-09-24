/**
 * Exportação CSV no padrão brasileiro (abre corretamente no Excel pt-BR):
 * separador ";", decimal ",", datas DD/MM/AAAA e UTF-8 com BOM.
 */
import { formatarData } from '@/lib/domain/datas';
import { formatarNumeroMoeda } from '@/lib/domain/dinheiro';
import { CABECALHO_EXPORTACAO, type LinhaExportacao } from './linhas';

const SEPARADOR = ';';
const BOM = '﻿';

/** Escapa um campo e neutraliza "CSV injection" (=, +, -, @ no início). */
export function escaparCampoCsv(valor: string): string {
  let v = valor;
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  if (/[";\n\r]/.test(v)) v = `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function gerarCsv(linhas: readonly LinhaExportacao[]): string {
  const corpo = linhas.map((l) =>
    [
      l.empresa,
      l.cnpj,
      l.categoria,
      l.conta,
      l.fornecedor,
      l.descricao,
      formatarNumeroMoeda(l.valorCentavos),
      formatarData(l.vencimento),
      l.codigo,
      l.status,
      l.parcela === null ? '' : String(l.parcela),
      l.totalParcelas === null ? '' : String(l.totalParcelas),
      l.observacao,
      l.pagamentoTexto,
    ]
      .map(escaparCampoCsv)
      .join(SEPARADOR),
  );
  return BOM + [CABECALHO_EXPORTACAO.join(SEPARADOR), ...corpo].join('\r\n') + '\r\n';
}
