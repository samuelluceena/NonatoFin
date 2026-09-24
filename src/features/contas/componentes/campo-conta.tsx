'use client';

import type { ComponentProps } from 'react';
import { Campo, Seletor, ariaCampo } from '@/components/ui/campo';
import { rotuloConta } from '@/lib/domain/saldos';
import type { ContaBancaria } from '@/lib/domain/tipos';

type PropsSeletor = Omit<ComponentProps<'select'>, 'id' | 'children'>;

interface Props extends PropsSeletor {
  id?: string;
  rotulo?: string;
  /** Todas as contas; o campo mostra só as da empresa escolhida. */
  contas: ContaBancaria[];
  empresaId: string;
  /** Conta já gravada (aparece mesmo se estiver inativa). */
  contaAtualId?: string | null;
  erro?: string;
  dica?: string;
}

/** Seleção da conta de débito, limitada às contas da empresa escolhida. */
export function CampoConta({
  id = 'contaId',
  rotulo = 'Debitar da conta',
  contas,
  empresaId,
  contaAtualId,
  erro,
  dica,
  ...props
}: Props) {
  const opcoes = contas.filter((c) => c.empresa.id === empresaId && (c.ativa || c.id === contaAtualId));
  const dicaFinal =
    dica ??
    (!empresaId
      ? 'Escolha a empresa primeiro.'
      : opcoes.length === 0
        ? 'Esta empresa ainda não tem conta bancária cadastrada (menu Contas).'
        : 'De onde o dinheiro vai sair. Opcional.');
  return (
    <Campo id={id} rotulo={rotulo} opcional erro={erro} dica={dicaFinal}>
      <Seletor {...ariaCampo(id, erro, true)} {...props} disabled={props.disabled || opcoes.length === 0}>
        <option value="">Sem conta definida</option>
        {opcoes.map((c) => (
          <option key={c.id} value={c.id}>
            {rotuloConta(c)}
            {c.padrao ? ' (padrão)' : ''}
          </option>
        ))}
      </Seletor>
    </Campo>
  );
}
