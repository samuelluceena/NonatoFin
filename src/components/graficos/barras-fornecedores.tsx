'use client';

import type { ResumoFornecedor } from '@/lib/domain/tipos';
import { BarrasComparativas } from './barras-comparativas';

/** Visão comparativa dos fornecedores ordenada pela métrica escolhida. */
export function BarrasFornecedores({ resumos, limite = 8 }: { resumos: ResumoFornecedor[]; limite?: number }) {
  return (
    <BarrasComparativas
      nome="metrica-fornecedor"
      limite={limite}
      itens={resumos.map((r) => ({
        id: r.fornecedor.id,
        nome: r.fornecedor.nome,
        href: `/fornecedores/${r.fornecedor.id}`,
        resumo: r,
      }))}
    />
  );
}
