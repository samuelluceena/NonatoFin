'use client';

import { History } from 'lucide-react';
import { useState } from 'react';
import { Botao } from '@/components/ui/botao';
import { Cartao } from '@/components/ui/cartao';
import { Selo } from '@/components/ui/selo';
import { dataNoFuso, formatarData, formatarDataHora } from '@/lib/domain/datas';
import { restaurarBackup } from '../acoes';
import { FRASES } from '../esquemas';
import { ROTULOS, resumirContagens, rotuloBackup, tabelasDoNivel, type Contagens, type ResumoBackup, type TabelaDados } from '../formato-backup';
import { BotaoBaixarBackup } from './botao-baixar-backup';
import { DialogoConfirmacaoForte, type ItemConfirmacao } from './dialogo-confirmacao-forte';

const nome = (t: TabelaDados) => ROTULOS[t].varios.charAt(0).toUpperCase() + ROTULOS[t].varios.slice(1);

/** Backups automáticos (até 30 dias, no máximo 10): baixar e restaurar. */
export function ListaBackups({ backups, contagensAtuais }: { backups: ResumoBackup[]; contagensAtuais: Contagens }) {
  const [restaurando, setRestaurando] = useState<ResumoBackup | null>(null);

  if (backups.length === 0) {
    return (
      <Cartao className="flex items-start gap-3 p-4 text-sm text-fg-2 sm:p-5" data-testid="sem-backups">
        <History className="mt-0.5 size-4.5 shrink-0 text-fg-3" aria-hidden="true" />
        Nenhum backup ainda. Um backup é criado automaticamente antes de cada limpeza ou restauração.
      </Cartao>
    );
  }

  const escopo = restaurando ? tabelasDoNivel(restaurando.nivel) : [];
  const itens = (contagens: Contagens): ItemConfirmacao[] => escopo.map((t) => ({ rotulo: nome(t), quantidade: contagens[t] }));

  return (
    <>
      <Cartao>
        <ul className="divide-y divide-border">
          {backups.map((b) => (
            <li key={b.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-5" data-testid="backup">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium text-fg">
                  {formatarDataHora(b.criadoEm)}
                  {b.restauradoEm && <Selo tom="info">Restaurado</Selo>}
                </p>
                <p className="mt-0.5 text-sm text-fg-2">{rotuloBackup(b.nivel, b.motivo)}</p>
                <p className="mt-1 text-meta text-fg-3 tabular-nums">
                  {resumirContagens(b.contagens, tabelasDoNivel('completo'))} · disponível até {formatarData(dataNoFuso(b.expiraEm))}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <BotaoBaixarBackup backupId={b.id} rotulo="Baixar" tamanho="sm" variante="fantasma" />
                <Botao tamanho="sm" variante="secundario" onClick={() => setRestaurando(b)} data-testid="abrir-restauracao">
                  Restaurar…
                </Botao>
              </div>
            </li>
          ))}
        </ul>
      </Cartao>

      {restaurando && (
        <DialogoConfirmacaoForte
          aberto
          onFechar={() => setRestaurando(null)}
          titulo="Restaurar este backup?"
          descricao={
            <>
              Os dados atuais serão substituídos pelos do backup de {formatarDataHora(restaurando.criadoEm)}.
              {restaurando.nivel === 'financeiro' && ' Empresas, contas, cartões, fornecedores e categorias atuais não mudam.'}
            </>
          }
          tituloApagado="Sai (dados atuais)"
          apagado={itens(contagensAtuais)}
          tituloMantido="Volta (do backup)"
          mantido={itens(restaurando.contagens)}
          aviso={
            <>
              Antes de restaurar, o estado atual é guardado em um <strong className="font-medium text-fg">novo backup</strong> (por até 30 dias),
              então esta restauração também pode ser desfeita.
            </>
          }
          frase={FRASES.restaurar}
          rotuloConfirmar="Restaurar backup"
          textoProcessando="Restaurando e conferindo..."
          executar={({ senha, frase }) => restaurarBackup({ backupId: restaurando.id, senha, frase })}
          testId="restauracao"
        />
      )}
    </>
  );
}
