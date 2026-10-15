import type { Metadata } from 'next';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { LinkVoltar } from '@/components/ui/link-voltar';
import { ImportadorPlanilha } from '@/features/importacao/componentes/importador-planilha';
import { exigirUsuario } from '@/lib/auth/sessao';
import { hojeISO } from '@/lib/domain/datas';

export const metadata: Metadata = { title: 'Nova importação' };

export default async function PaginaNovaImportacao() {
  await exigirUsuario();
  const hoje = hojeISO();
  // Período sugerido: de hoje até o fim do ano seguinte.
  const ateSugerido = `${Number(hoje.slice(0, 4)) + 1}-12-31`;

  return (
    <div className="mx-auto flex max-w-4xl flex-col">
      <CabecalhoPagina
        voltar={<LinkVoltar href="/configuracoes/importacao">Importações</LinkVoltar>}
        titulo="Nova importação"
        subtitulo="Escolha o arquivo e o período. Nada é gravado até você confirmar a prévia."
      />
      <ImportadorPlanilha hoje={hoje} ateSugerido={ateSugerido} />
    </div>
  );
}
