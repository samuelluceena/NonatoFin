/**
 * Conversão entre linhas do banco (snake_case) e tipos de domínio.
 */
import { dataNoFuso } from '@/lib/domain/datas';
import { statusDoBanco } from '@/lib/domain/status';
import { primeiroEmbutido as primeiro, type Embutido } from '@/lib/supabase/embutidos';
import type { Categoria, ContaResumida, Empresa, Fornecedor, Lancamento, LancamentoResumo } from '@/lib/domain/tipos';
import type { LinhaLancamento } from '@/lib/supabase/tipos-banco';

/** Colunas buscadas para exibir um lançamento completo (com fornecedor, empresa, categoria e conta). */
export const COLUNAS_LANCAMENTO =
  'id, descricao, valor_centavos, vencimento, codigo_barras, observacao, status, pago_em, serie_id, parcela, total_parcelas, cartao_id, fatura_mes, ajuste_centavos, created_at, updated_at, ' +
  'fornecedor:fornecedores!lancamentos_fornecedor_fk(id, nome), empresa:empresas!lancamentos_empresa_fk(id, apelido, cnpj), categoria:categorias!lancamentos_categoria_fk(id, nome), ' +
  'conta:contas_bancarias!lancamentos_conta_fk(id, apelido, final)';

/** Colunas mínimas para cálculos (dashboard, fornecedores, meses). */
export const COLUNAS_RESUMO = 'id, fornecedor_id, empresa_id, categoria_id, conta_id, valor_centavos, vencimento, status, pago_em';

type EmpresaEmbutida = Pick<Empresa, 'id' | 'apelido' | 'cnpj'>;
type CategoriaEmbutida = Pick<Categoria, 'id' | 'nome'>;

export type LinhaLancamentoComFornecedor = Omit<LinhaLancamento, 'user_id' | 'fornecedor_id' | 'empresa_id' | 'categoria_id' | 'conta_id'> & {
  fornecedor: Embutido<Fornecedor>;
  empresa: Embutido<EmpresaEmbutida>;
  categoria: Embutido<CategoriaEmbutida>;
  conta: Embutido<ContaResumida>;
};

function extrairFornecedor(f: Embutido<Fornecedor>): Fornecedor {
  const unico = primeiro(f);
  return unico ? { id: unico.id, nome: unico.nome } : { id: '', nome: '(sem fornecedor)' };
}

export function paraLancamento(linha: LinhaLancamentoComFornecedor): Lancamento {
  return {
    id: linha.id,
    empresa: (() => {
      const e = primeiro(linha.empresa);
      return e ? { id: e.id, apelido: e.apelido, cnpj: e.cnpj } : { id: '', apelido: '(sem empresa)', cnpj: null };
    })(),
    categoria: (() => {
      const c = primeiro(linha.categoria);
      return c ? { id: c.id, nome: c.nome } : { id: '', nome: '(sem categoria)' };
    })(),
    conta: primeiro(linha.conta),
    fornecedor: extrairFornecedor(linha.fornecedor),
    descricao: linha.descricao,
    valorCentavos: Number(linha.valor_centavos),
    vencimento: linha.vencimento,
    codigoBarras: linha.codigo_barras,
    observacao: linha.observacao,
    status: statusDoBanco(linha.status),
    pagoEm: linha.pago_em,
    recorrencia:
      linha.serie_id && linha.parcela && linha.total_parcelas
        ? { serieId: linha.serie_id, parcela: linha.parcela, totalParcelas: linha.total_parcelas }
        : null,
    fatura:
      linha.cartao_id && linha.fatura_mes
        ? { cartaoId: linha.cartao_id, mes: linha.fatura_mes, ajusteCentavos: Number(linha.ajuste_centavos) }
        : null,
    createdAt: linha.created_at,
    updatedAt: linha.updated_at,
  };
}

/** Linha trazida com COLUNAS_RESUMO. */
export type LinhaResumo = Pick<
  LinhaLancamento,
  'id' | 'fornecedor_id' | 'empresa_id' | 'categoria_id' | 'conta_id' | 'valor_centavos' | 'vencimento' | 'status' | 'pago_em'
>;

export function paraResumo(linha: LinhaResumo): LancamentoResumo {
  return {
    id: linha.id,
    fornecedorId: linha.fornecedor_id,
    empresaId: linha.empresa_id,
    categoriaId: linha.categoria_id,
    contaId: linha.conta_id,
    valorCentavos: Number(linha.valor_centavos),
    vencimento: linha.vencimento,
    status: statusDoBanco(linha.status),
    dataPagamento: linha.pago_em ? dataNoFuso(linha.pago_em) : null,
  };
}

/** Boleto completo -> formato enxuto dos cálculos. */
export function resumoDoLancamento(b: Lancamento): LancamentoResumo {
  return {
    id: b.id,
    fornecedorId: b.fornecedor.id,
    empresaId: b.empresa.id,
    categoriaId: b.categoria.id,
    contaId: b.conta?.id ?? null,
    valorCentavos: b.valorCentavos,
    vencimento: b.vencimento,
    status: b.status,
    dataPagamento: b.pagoEm ? dataNoFuso(b.pagoEm) : null,
  };
}
