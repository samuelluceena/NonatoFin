import type { Metadata } from 'next';
import Link from 'next/link';
import { Building, ChevronRight, DatabaseBackup, Landmark, LogOut, Tags } from 'lucide-react';
import { SeletorTema } from '@/components/layout/seletor-tema';
import { SimboloLogo } from '@/components/layout/logo';
import { Botao } from '@/components/ui/botao';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { Cartao, TituloSecao } from '@/components/ui/cartao';
import { sair } from '@/features/auth/acoes';
import { BotoesExportar } from '@/features/exportacao/botoes-exportar';
import { listarTodasAsContas } from '@/features/contas/consultas';
import { listarCategorias, obterContextoEmpresas } from '@/features/empresas/consultas';
import { exigirUsuario } from '@/lib/auth/sessao';
import { APP } from '@/lib/config';

export const metadata: Metadata = { title: 'Configurações' };

export default async function PaginaConfiguracoes() {
  const { usuario } = await exigirUsuario();
  const [{ empresas, selecionada }, categorias, contas] = await Promise.all([obterContextoEmpresas(), listarCategorias(), listarTodasAsContas()]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <CabecalhoPagina titulo="Configurações" className="mb-0" />

      <section aria-labelledby="titulo-cadastros">
        <TituloSecao id="titulo-cadastros" className="mb-2 px-1">
          Cadastros
        </TituloSecao>
        <Cartao className="divide-y divide-border">
          <Link href="/configuracoes/empresas" className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-surface-2">
            <Building className="size-5 text-primary-text" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-fg">Empresas</span>
              <span className="block truncate text-meta text-fg-2">
                {empresas.length === 0 ? 'Nenhuma cadastrada' : empresas.map((e) => e.apelido).join(' · ')}
              </span>
            </span>
            <ChevronRight className="size-4 text-fg-3" aria-hidden="true" />
          </Link>
          <Link href="/contas" className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-surface-2">
            <Landmark className="size-5 text-primary-text" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-fg">Contas bancárias</span>
              <span className="block truncate text-meta text-fg-2">
                {contas.length === 0 ? 'Nenhuma cadastrada' : contas.filter((c) => c.ativa).map((c) => c.apelido).join(' · ')}
              </span>
            </span>
            <ChevronRight className="size-4 text-fg-3" aria-hidden="true" />
          </Link>
          <Link href="/configuracoes/categorias" className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-surface-2">
            <Tags className="size-5 text-primary-text" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-fg">Categorias</span>
              <span className="block truncate text-meta text-fg-2">{categorias.length} categorias</span>
            </span>
            <ChevronRight className="size-4 text-fg-3" aria-hidden="true" />
          </Link>
        </Cartao>
      </section>

      <section aria-labelledby="titulo-aparencia">
        <TituloSecao id="titulo-aparencia" className="mb-2 px-1">
          Aparência
        </TituloSecao>
        <Cartao className="p-4 sm:p-5">
          <SeletorTema />
          <p className="mt-2 text-meta text-fg-3">
            A escolha fica salva neste navegador. O botão de sol/lua no topo também alterna o tema.
          </p>
        </Cartao>
      </section>

      <section aria-labelledby="titulo-dados">
        <TituloSecao id="titulo-dados" className="mb-2 px-1">
          Dados
        </TituloSecao>
        <Cartao className="divide-y divide-border">
          <div className="p-4 sm:p-5">
            <p className="mb-3 text-sm text-fg-2">
              Baixe os lançamentos {selecionada ? <>da empresa <strong>{selecionada.apelido}</strong></> : 'de todas as empresas'} (empresa, CNPJ,
              categoria, conta, fornecedor, nome, valor, vencimento, código, status, parcela, observação e pagamento).
            </p>
            <BotoesExportar />
          </div>
          <Link href="/configuracoes/dados" className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-surface-2" data-testid="link-gerenciar-dados">
            <DatabaseBackup className="size-5 text-primary-text" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-fg">Backup, limpeza e restauração</span>
              <span className="block truncate text-meta text-fg-2">Backup completo, backups automáticos e zona de perigo</span>
            </span>
            <ChevronRight className="size-4 text-fg-3" aria-hidden="true" />
          </Link>
        </Cartao>
      </section>

      <section aria-labelledby="titulo-conta">
        <TituloSecao id="titulo-conta" className="mb-2 px-1">
          Conta
        </TituloSecao>
        <Cartao className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="min-w-0">
            <p className="text-sm text-fg-3">Conectado como</p>
            <p className="truncate font-medium text-fg">{usuario.email}</p>
          </div>
          <form action={sair}>
            <Botao type="submit" variante="secundario" icone={<LogOut className="size-4.5" aria-hidden="true" />} className="w-full sm:w-auto">
              Sair
            </Botao>
          </form>
        </Cartao>
      </section>

      <section aria-labelledby="titulo-sobre">
        <TituloSecao id="titulo-sobre" className="mb-2 px-1">
          Sobre
        </TituloSecao>
        <Cartao className="flex items-center gap-4 p-4 sm:p-5">
          <SimboloLogo className="size-12" />
          <div>
            <p className="font-semibold text-fg">{APP.nome}</p>
            <p className="text-sm text-fg-2">{APP.descricao}</p>
            <p className="mt-1 text-meta text-fg-3" data-testid="versao">
              Versão {APP.versao}
            </p>
          </div>
        </Cartao>
      </section>
    </div>
  );
}
