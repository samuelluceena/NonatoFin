import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { Cartao, TituloSecao } from '@/components/ui/cartao';
import { BotaoBaixarBackup } from '@/features/dados/componentes/botao-baixar-backup';
import { ListaBackups } from '@/features/dados/componentes/lista-backups';
import { ZonaDePerigo } from '@/features/dados/componentes/zona-de-perigo';
import { listarBackups, resumoDados } from '@/features/dados/consultas';
import { BotoesExportar } from '@/features/exportacao/botoes-exportar';
import { exigirUsuario } from '@/lib/auth/sessao';

export const metadata: Metadata = { title: 'Dados' };

export default async function PaginaDados() {
  const { supabase } = await exigirUsuario();
  const [contagens, backups] = await Promise.all([resumoDados(supabase), listarBackups(supabase)]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <Link href="/configuracoes" className="mb-4 inline-flex h-10 items-center gap-1.5 text-sm font-medium text-fg-2 hover:text-fg">
          <ArrowLeft className="size-4" aria-hidden="true" /> Configurações
        </Link>
        <CabecalhoPagina titulo="Dados" subtitulo="Exportação, backups e reinício do NonatoFin." className="mb-0" />
      </div>

      <section aria-labelledby="titulo-exportar">
        <TituloSecao id="titulo-exportar" className="mb-2 px-1">
          Exportar e fazer backup
        </TituloSecao>
        <Cartao className="divide-y divide-border-subtle">
          <div className="p-4 sm:p-5">
            <p className="mb-3 text-sm text-fg-2">Planilha com os lançamentos, para conferência ou para o contador.</p>
            <BotoesExportar />
          </div>
          <div className="p-4 sm:p-5">
            <p className="mb-3 text-sm text-fg-2">
              Backup completo com <strong className="font-medium text-fg">todos</strong> os dados: empresas, contas, cartões, fornecedores,
              categorias, lançamentos, compras, parcelas e movimentações. Guarde o arquivo em um lugar seguro.
            </p>
            <BotaoBaixarBackup className="w-full sm:w-auto" testId="baixar-backup-completo" />
          </div>
        </Cartao>
      </section>

      <section aria-labelledby="titulo-backups">
        <TituloSecao id="titulo-backups" className="mb-1 px-1">
          Backups automáticos
        </TituloSecao>
        <p className="mb-2 px-1 text-meta text-fg-3">Criados antes de cada limpeza ou restauração. Ficam guardados por até 30 dias (no máximo 10).</p>
        <ListaBackups backups={backups} contagensAtuais={contagens} />
      </section>

      <section aria-labelledby="titulo-zona-perigo">
        <TituloSecao id="titulo-zona-perigo" className="mb-2 px-1 !text-danger">
          Zona de perigo
        </TituloSecao>
        <ZonaDePerigo contagens={contagens} />
      </section>
    </div>
  );
}
