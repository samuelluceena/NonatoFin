import type { Metadata } from 'next';
import { FileSpreadsheet, Upload } from 'lucide-react';
import { LinkBotao } from '@/components/ui/botao';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { IconeLista, LinhaLista, ListaPainel } from '@/components/ui/lista-painel';
import { LinkVoltar } from '@/components/ui/link-voltar';
import { Selo } from '@/components/ui/selo';
import { Valor } from '@/components/ui/valor';
import { AvisoLancamentosSemEmpresa } from '@/features/importacao/componentes/aviso-lancamentos-sem-empresa';
import { contarSemEmpresa, listarImportacoes } from '@/features/importacao/consultas';
import { exigirUsuario } from '@/lib/auth/sessao';
import { formatarDataHora } from '@/lib/domain/datas';

export const metadata: Metadata = { title: 'Importar planilha' };

export default async function PaginaImportacoes() {
  const { supabase } = await exigirUsuario();
  const [importacoes, semEmpresa] = await Promise.all([listarImportacoes(supabase), contarSemEmpresa(supabase)]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <CabecalhoPagina
        voltar={<LinkVoltar href="/configuracoes">Configurações</LinkVoltar>}
        titulo="Importar planilha"
        subtitulo="Contas a pagar de uma planilha (CSV), com prévia e conferência antes de gravar."
        className="mb-0"
        acoes={
          <LinkBotao href="/configuracoes/importacao/nova" icone={<Upload className="size-4.5" aria-hidden="true" />} data-testid="nova-importacao">
            Nova importação
          </LinkBotao>
        }
      />

      <AvisoLancamentosSemEmpresa contagem={semEmpresa} />

      <section aria-labelledby="titulo-historico">
        <h2 id="titulo-historico" className="mb-2 px-1 text-sm font-medium text-fg-2">
          Histórico de importações
        </h2>
        {importacoes.length === 0 ? (
          <EstadoVazio
            icone={<FileSpreadsheet />}
            titulo="Nenhuma importação ainda"
            descricao="Importe os lançamentos pendentes de uma planilha. Você confere tudo antes de gravar e pode desfazer depois."
            acao={<LinkBotao href="/configuracoes/importacao/nova">Importar planilha</LinkBotao>}
          />
        ) : (
          <ListaPainel data-testid="historico-importacoes">
            {importacoes.map((i) => (
              <LinhaLista
                key={i.id}
                href={`/configuracoes/importacao/${i.id}`}
                testId="item-importacao"
                inicio={
                  <IconeLista>
                    <FileSpreadsheet />
                  </IconeLista>
                }
                titulo={i.arquivoNome}
                descricao={
                  <>
                    {formatarDataHora(i.criadoEm)} · {i.importados} {i.importados === 1 ? 'lançamento' : 'lançamentos'}
                    {i.status === 'concluida' && i.ativos !== i.importados && ` · ${i.ativos} no sistema`}
                  </>
                }
                fim={
                  <span className="flex flex-col items-end gap-1">
                    <Valor centavos={i.totalCentavos} className="numeros text-sm font-semibold text-fg" />
                    {i.status === 'desfeita' ? <Selo>Desfeita</Selo> : <Selo tom="sucesso">Concluída</Selo>}
                  </span>
                }
              />
            ))}
          </ListaPainel>
        )}
      </section>
    </div>
  );
}
