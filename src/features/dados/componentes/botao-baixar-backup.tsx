'use client';

import { Download } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Botao, type TamanhoBotao, type VarianteBotao } from '@/components/ui/botao';

function nomeDoCabecalho(cabecalho: string | null, padrao: string): string {
  const m = /filename="([^"]+)"/.exec(cabecalho ?? '');
  return m?.[1] ?? padrao;
}

interface Props {
  /** Backup automático a baixar; sem id, baixa os dados atuais completos. */
  backupId?: string;
  rotulo?: string;
  variante?: VarianteBotao;
  tamanho?: TamanhoBotao;
  className?: string;
  testId?: string;
}

/** Baixa um backup completo (.json) com todos os dados. */
export function BotaoBaixarBackup({ backupId, rotulo = 'Baixar backup completo (.json)', variante = 'secundario', tamanho, className, testId }: Props) {
  const [baixando, setBaixando] = useState(false);

  async function baixar() {
    if (baixando) return;
    setBaixando(true);
    try {
      const resposta = await fetch(backupId ? `/api/backup?id=${encodeURIComponent(backupId)}` : '/api/backup', { cache: 'no-store' });
      if (!resposta.ok) {
        toast.error(resposta.status === 401 ? 'Sessão expirada. Entre novamente.' : 'Não foi possível baixar o backup.');
        return;
      }
      const blob = await resposta.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = nomeDoCabecalho(resposta.headers.get('Content-Disposition'), 'nonatofin-backup.json');
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast.success('Backup baixado.', { description: link.download });
    } catch {
      toast.error('Erro de conexão ao baixar o backup. Tente novamente.');
    } finally {
      setBaixando(false);
    }
  }

  return (
    <Botao
      variante={variante}
      tamanho={tamanho}
      onClick={baixar}
      carregando={baixando}
      textoCarregando="Gerando..."
      icone={<Download aria-hidden="true" />}
      className={className}
      data-testid={testId}
    >
      {rotulo}
    </Botao>
  );
}
