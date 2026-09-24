import type { Lancamento } from '@/lib/domain/tipos';
import type { InfoSerie } from './componentes/opcoes-escopo';

/** Informações para os diálogos de edição/exclusão em série. */
export function infoSerie(lancamento: Lancamento, serie: Lancamento[]): InfoSerie | null {
  if (!lancamento.recorrencia) return null;
  const { parcela, totalParcelas } = lancamento.recorrencia;
  return {
    parcela,
    totalParcelas,
    existentes: serie.length,
    daquiEmDiante: serie.filter((b) => (b.recorrencia?.parcela ?? 0) >= parcela).length,
  };
}
