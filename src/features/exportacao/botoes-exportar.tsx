'use client';

import { FileSpreadsheet, FileText } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Botao } from '@/components/ui/botao';

type Formato = 'csv' | 'xlsx';

function nomeDoCabecalho(cabecalho: string | null, padrao: string): string {
  const m = /filename="([^"]+)"/.exec(cabecalho ?? '');
  return m?.[1] ?? padrao;
}

interface Props {
  /**
   * Parâmetros da lista de Boletos (sem o "?"). Com eles, exporta só o que a
   * lista mostra; sem eles, exporta tudo.
   */
  filtros?: string;
  /** Botões menores, lado a lado (usado no fim da lista). */
  compacto?: boolean;
}

/** Baixa a exportação e mostra "Exportação concluída". */
export function BotoesExportar({ filtros, compacto = false }: Props) {
  const [baixando, setBaixando] = useState<Formato | null>(null);

  async function exportar(formato: Formato) {
    if (baixando) return;
    setBaixando(formato);
    try {
      const extra = filtros !== undefined ? `&lista=1${filtros ? `&${filtros}` : ''}` : '';
      const resposta = await fetch(`/api/exportar?formato=${formato}${extra}`, { cache: 'no-store' });
      if (!resposta.ok) {
        toast.error(resposta.status === 401 ? 'Sessão expirada. Entre novamente.' : 'Não foi possível exportar os dados.');
        return;
      }
      const blob = await resposta.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = nomeDoCabecalho(resposta.headers.get('Content-Disposition'), `nonatofin.${formato}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast.success('Exportação concluída!', { description: link.download });
    } catch {
      toast.error('Erro de conexão ao exportar. Tente novamente.');
    } finally {
      setBaixando(null);
    }
  }

  return (
    <div className={compacto ? 'grid grid-cols-2 gap-2' : 'grid gap-2 sm:grid-cols-2'}>
      <Botao
        variante="secundario"
        onClick={() => exportar('csv')}
        carregando={baixando === 'csv'}
        textoCarregando="Exportando..."
        disabled={baixando !== null}
        icone={<FileText className="size-5" aria-hidden="true" />}
        data-testid="exportar-csv"
      >
        {compacto ? 'CSV' : 'Exportar CSV'}
      </Botao>
      <Botao
        variante="secundario"
        onClick={() => exportar('xlsx')}
        carregando={baixando === 'xlsx'}
        textoCarregando="Exportando..."
        disabled={baixando !== null}
        icone={<FileSpreadsheet className="size-5" aria-hidden="true" />}
        data-testid="exportar-xlsx"
      >
        {compacto ? 'Excel' : 'Exportar Excel (.xlsx)'}
      </Botao>
    </div>
  );
}
