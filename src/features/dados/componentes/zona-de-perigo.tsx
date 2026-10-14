'use client';

import { useState } from 'react';
import { Botao } from '@/components/ui/botao';
import { Cartao } from '@/components/ui/cartao';
import { limparDados } from '../acoes';
import { FRASES, type NivelLimpeza } from '../esquemas';
import { ROTULOS, TABELAS_CADASTRO, resumirContagens, tabelasDoNivel, totalDe, type Contagens, type TabelaDados } from '../formato-backup';
import { DialogoConfirmacaoForte, type ItemConfirmacao } from './dialogo-confirmacao-forte';

const NOMES: Record<TabelaDados, string> = {
  lancamentos: 'Lançamentos',
  compras_cartao: 'Compras no cartão',
  parcelas_cartao: 'Parcelas e faturas',
  movimentos_conta: 'Movimentações',
  empresas: 'Empresas',
  contas_bancarias: 'Contas bancárias',
  cartoes: 'Cartões',
  fornecedores: 'Fornecedores',
  categorias: 'Categorias',
};

const item = (contagens: Contagens) => (t: TabelaDados): ItemConfirmacao => ({ rotulo: NOMES[t], detalhe: ROTULOS[t].inclui, quantidade: contagens[t] });

const ACESSO: ItemConfirmacao[] = [
  { rotulo: 'Login e senha' },
  { rotulo: 'Autorização de acesso' },
];

const OPCOES: Record<NivelLimpeza, { titulo: string; descricao: string; botao: string; confirmar: string }> = {
  financeiro: {
    titulo: 'Limpar dados financeiros',
    descricao: 'Apaga lançamentos, pagamentos, compras no cartão, faturas e movimentações. Os cadastros continuam.',
    botao: 'Limpar dados…',
    confirmar: 'Apagar dados financeiros',
  },
  completo: {
    titulo: 'Restaurar NonatoFin do zero',
    descricao: 'Apaga todos os dados, inclusive empresas, contas, cartões, fornecedores e categorias. Só o seu acesso continua.',
    botao: 'Reiniciar…',
    confirmar: 'Apagar tudo e reiniciar',
  },
};

/** As duas opções destrutivas de Configurações → Dados. */
export function ZonaDePerigo({ contagens }: { contagens: Contagens }) {
  const [aberto, setAberto] = useState<NivelLimpeza | null>(null);

  const conteudo: Record<NivelLimpeza, { apagado: ItemConfirmacao[]; mantido: ItemConfirmacao[]; depois: string }> = {
    financeiro: {
      apagado: tabelasDoNivel('financeiro').map(item(contagens)),
      mantido: [...TABELAS_CADASTRO.map(item(contagens)), ...ACESSO],
      depois: 'Em seguida, o NonatoFin pede o saldo atual de cada conta para você recomeçar.',
    },
    completo: {
      apagado: tabelasDoNivel('completo').map(item(contagens)),
      mantido: [...ACESSO, { rotulo: 'Estrutura e funcionamento do app' }],
      depois: 'O NonatoFin volta ao primeiro acesso: cadastre empresas, contas e cartões de novo. As categorias padrão são recriadas.',
    },
  };

  return (
    <Cartao className="divide-y divide-border border-danger-border">
      {(['financeiro', 'completo'] as const).map((nivel) => {
        const total = totalDe(contagens, tabelasDoNivel(nivel));
        return (
          <div key={nivel} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:p-5">
            <div className="min-w-0">
              <p className="font-medium text-fg">{OPCOES[nivel].titulo}</p>
              <p className="mt-0.5 text-sm text-fg-2">{OPCOES[nivel].descricao}</p>
              <p className="mt-1.5 text-meta text-fg-3 tabular-nums" data-testid={`resumo-${nivel}`}>
                {total > 0 ? resumirContagens(contagens, tabelasDoNivel(nivel)) : 'Nada para apagar'}
              </p>
            </div>
            <Botao
              variante="secundario"
              className="shrink-0 !text-danger"
              disabled={total === 0}
              onClick={() => setAberto(nivel)}
              data-testid={`abrir-limpeza-${nivel}`}
            >
              {OPCOES[nivel].botao}
            </Botao>
          </div>
        );
      })}

      {(['financeiro', 'completo'] as const).map((nivel) => (
        <DialogoConfirmacaoForte
          key={`dialogo-${nivel}`}
          aberto={aberto === nivel}
          onFechar={() => setAberto(null)}
          titulo={`${OPCOES[nivel].titulo}?`}
          descricao={<>Esta ação apaga os dados de forma definitiva. {conteudo[nivel].depois}</>}
          tituloApagado="Será apagado"
          apagado={conteudo[nivel].apagado}
          tituloMantido="Será mantido"
          mantido={conteudo[nivel].mantido}
          aviso={
            <>
              Antes de apagar, um <strong className="font-medium text-fg">backup automático</strong> com todos os seus dados é criado e fica
              guardado por <strong className="font-medium text-fg">até 30 dias</strong>. Você pode restaurá-lo nesta página. Para uma cópia
              permanente, baixe também o arquivo.
            </>
          }
          frase={FRASES[nivel]}
          rotuloConfirmar={OPCOES[nivel].confirmar}
          textoProcessando="Criando backup e apagando..."
          executar={({ senha, frase }) => limparDados({ nivel, senha, frase })}
          testId={`limpeza-${nivel}`}
        />
      ))}
    </Cartao>
  );
}
