'use client';

/**
 * Importar planilha (CSV) em duas etapas:
 *  1. arquivo + período → o servidor analisa e devolve a PRÉVIA (nada é gravado);
 *  2. o usuário confere, decide as linhas em conferência e confirma.
 * A confirmação reenvia o mesmo arquivo e as decisões; o servidor refaz a
 * análise, confere o hash e grava tudo numa única transação.
 */
import { FileSpreadsheet, FileUp, RefreshCw, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Botao } from '@/components/ui/botao';
import { Cartao } from '@/components/ui/cartao';
import { Campo, Entrada, ariaCampo } from '@/components/ui/campo';
import { Dialogo } from '@/components/ui/dialogo';
import { Valor } from '@/components/ui/valor';
import { formatarData, formatarDataHora, type DataISO } from '@/lib/domain/datas';
import { LIMITES_IMPORTACAO, resumirImportacao, selecionarLinhas, type LinhaImportacao } from '@/lib/domain/importacao';
import { confirmarImportacao, previsualizarImportacao, type PreviaImportacao } from '../acoes';
import { PreviaDaImportacao, type Decisoes } from './previa-importacao';

interface Props {
  hoje: DataISO;
  /** Último dia sugerido para o período (fim do ano seguinte). */
  ateSugerido: DataISO;
}

/** Decisões iniciais: a sugestão de cada linha em conferência (null = o usuário decide). */
function decisoesIniciais(linhas: readonly LinhaImportacao[]): Decisoes {
  const d: Decisoes = new Map();
  for (const l of linhas) if (l.situacao === 'conferir' && l.sugestao) d.set(l.chave, l.sugestao === 'importar');
  return d;
}

export function ImportadorPlanilha({ hoje, ateSugerido }: Props) {
  const router = useRouter();
  const id = useId();
  const entradaArquivo = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [de, setDe] = useState<string>(hoje);
  const [ate, setAte] = useState<string>(ateSugerido);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [analisando, setAnalisando] = useState(false);
  const [previa, setPrevia] = useState<PreviaImportacao | null>(null);
  const [decisoes, setDecisoes] = useState<Decisoes>(new Map());
  const [confirmando, setConfirmando] = useState(false);
  const [importando, setImportando] = useState(false);
  const emAndamento = useRef(false);

  const selecao = useMemo(() => {
    if (!previa) return null;
    const incluir: string[] = [];
    const excluir: string[] = [];
    for (const [chave, importar] of decisoes) (importar ? incluir : excluir).push(chave);
    const { importar, semDecisao } = selecionarLinhas(previa.linhas, { incluir, excluir });
    const resumo = resumirImportacao({ linhas: previa.linhas, totalLinhasArquivo: previa.totalLinhasArquivo }, importar);
    return { incluir, excluir, importar, semDecisao, resumo };
  }, [previa, decisoes]);

  function formulario(): FormData {
    const form = new FormData();
    if (arquivo) form.append('arquivo', arquivo);
    form.append('de', de);
    form.append('ate', ate);
    return form;
  }

  async function analisar(e?: FormEvent) {
    e?.preventDefault();
    if (emAndamento.current) return;
    if (!arquivo) {
      setErros({ arquivo: 'Escolha o arquivo CSV.' });
      return;
    }
    emAndamento.current = true;
    setAnalisando(true);
    setErros({});
    try {
      const r = await previsualizarImportacao(formulario());
      if (!r.ok) {
        setErros(r.campos ?? { geral: r.erro });
        toast.error(r.erro);
        return;
      }
      setPrevia(r.dados);
      setDecisoes(decisoesIniciais(r.dados.linhas));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      toast.error('Erro de conexão. Tente novamente.');
    } finally {
      emAndamento.current = false;
      setAnalisando(false);
    }
  }

  async function importar() {
    if (!previa || !selecao || emAndamento.current) return;
    emAndamento.current = true;
    setImportando(true);
    try {
      const form = formulario();
      form.append('sha256', previa.sha256);
      form.append('decisoes', JSON.stringify({ incluir: selecao.incluir, excluir: selecao.excluir }));
      const r = await confirmarImportacao(form);
      if (!r.ok) {
        toast.error(r.erro);
        return;
      }
      toast.success(r.mensagem ?? 'Importação concluída.');
      setConfirmando(false);
      router.push(`/configuracoes/importacao/${r.dados.importacaoId}`);
      router.refresh();
    } catch {
      toast.error('Não foi possível confirmar o resultado (erro de conexão). Confira o histórico de importações antes de tentar de novo.');
    } finally {
      emAndamento.current = false;
      setImportando(false);
    }
  }

  function trocarArquivo() {
    setPrevia(null);
    setDecisoes(new Map());
    setArquivo(null);
    if (entradaArquivo.current) entradaArquivo.current.value = '';
  }

  if (!previa || !selecao) {
    const idArquivo = `${id}-arquivo`;
    return (
      <Cartao className="p-4 sm:p-6">
        <form onSubmit={analisar} className="flex flex-col gap-5" data-testid="form-importacao">
          <div>
            <label
              htmlFor={idArquivo}
              className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border-strong bg-bg-subtle px-4 py-8 text-center transition-colors hover:border-primary hover:bg-surface-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring"
            >
              {arquivo ? (
                <FileSpreadsheet className="size-8 text-primary-text" aria-hidden="true" />
              ) : (
                <FileUp className="size-8 text-fg-3" aria-hidden="true" />
              )}
              <span className="font-medium text-fg">{arquivo ? arquivo.name : 'Escolher arquivo CSV'}</span>
              <span className="text-meta text-fg-3">
                {arquivo
                  ? `${(arquivo.size / 1024).toFixed(0)} KB · toque para trocar`
                  : `Exportado da planilha (Excel, Google Planilhas ou app financeiro) · até ${Math.floor(LIMITES_IMPORTACAO.bytesArquivo / 1024)} KB`}
              </span>
              <input
                ref={entradaArquivo}
                type="file"
                accept=".csv,text/csv,text/plain"
                className="sr-only"
                {...ariaCampo(idArquivo, erros.arquivo)}
                onChange={(e) => {
                  setArquivo(e.target.files?.[0] ?? null);
                  setErros({});
                }}
                data-testid="arquivo-importacao"
              />
            </label>
            {erros.arquivo && (
              <p id={`${idArquivo}-erro`} role="alert" className="mt-1.5 text-sm text-danger">
                {erros.arquivo}
              </p>
            )}
          </div>

          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-medium text-fg-2">Vencimentos a importar</legend>
            <Campo id={`${id}-de`} rotulo="De" erro={erros.de} dica="Pendentes vencidos antes desta data ficam de fora.">
              <Entrada {...ariaCampo(`${id}-de`, erros.de, true)} type="date" value={de} onChange={(e) => setDe(e.target.value)} required data-testid="importacao-de" />
            </Campo>
            <Campo id={`${id}-ate`} rotulo="Até" erro={erros.ate}>
              <Entrada {...ariaCampo(`${id}-ate`, erros.ate)} type="date" value={ate} onChange={(e) => setAte(e.target.value)} required data-testid="importacao-ate" />
            </Campo>
          </fieldset>

          <ul className="flex flex-col gap-1.5 rounded-md bg-surface-2 px-4 py-3 text-meta text-fg-2">
            <li>Entram só lançamentos <strong className="font-medium text-fg">pendentes</strong> do período, como contas a pagar.</li>
            <li>Todos entram <strong className="font-medium text-fg">sem empresa e sem conta</strong>: você atribui depois, inclusive em lote.</li>
            <li>Pagos, vencidos, valores zero e entradas ficam de fora. Repetidos e possíveis faturas de cartão vão para conferência.</li>
            <li>Nada é gravado até você conferir a prévia e confirmar.</li>
          </ul>

          {erros.geral && (
            <p role="alert" className="rounded-md border border-danger-border bg-danger-soft px-3 py-2 text-sm text-danger">
              {erros.geral}
            </p>
          )}

          <div className="flex justify-end">
            <Botao
              type="submit"
              tamanho="lg"
              carregando={analisando}
              textoCarregando="Analisando..."
              icone={<Upload className="size-5" aria-hidden="true" />}
              className="w-full sm:w-auto"
              data-testid="gerar-previa"
            >
              Gerar prévia
            </Botao>
          </div>
        </form>
      </Cartao>
    );
  }

  const { importar: linhasImportar, semDecisao, resumo } = selecao;
  const pronto = semDecisao.length === 0 && linhasImportar.length > 0 && linhasImportar.length <= LIMITES_IMPORTACAO.lancamentosPorLote;

  return (
    <div className="flex flex-col gap-6 pb-4" data-testid="previa-importacao">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-md border border-border bg-surface-2 text-primary-text" aria-hidden="true">
            <FileSpreadsheet className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-fg">{previa.arquivoNome}</p>
            <p className="text-meta text-fg-3">
              {previa.totalLinhasArquivo} linhas · vencimentos de {formatarData(previa.de)} a {formatarData(previa.ate)}
            </p>
          </div>
        </div>
        <Botao variante="secundario" tamanho="sm" onClick={trocarArquivo} icone={<RefreshCw aria-hidden="true" />} disabled={importando}>
          Trocar arquivo ou período
        </Botao>
      </div>

      {previa.importadoEm && (
        <p role="note" className="rounded-md border border-info-border bg-info-soft px-4 py-3 text-sm text-fg">
          Este mesmo arquivo já foi importado em {formatarDataHora(previa.importadoEm)}. As linhas que já entraram aparecem como &quot;Já importada antes&quot; e não
          serão duplicadas.
        </p>
      )}

      <PreviaDaImportacao linhas={previa.linhas} resumo={resumo} decisoes={decisoes} aoDecidir={setDecisoes} semDecisao={semDecisao.length} />

      <div className="sticky bottom-[calc(var(--altura-barra-inferior)+env(safe-area-inset-bottom))] z-10 -mx-4 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border sm:bg-surface sm:px-5 lg:bottom-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0" aria-live="polite">
            <p className="text-sm text-fg-2">
              <span className="numeros font-semibold text-fg" data-testid="total-importar-quantidade">
                {linhasImportar.length}
              </span>{' '}
              {linhasImportar.length === 1 ? 'lançamento' : 'lançamentos'} ·{' '}
              <Valor centavos={resumo.importar.totalCentavos} className="numeros font-semibold text-fg" />
            </p>
            {semDecisao.length > 0 ? (
              <p className="text-meta text-warning">Decida {semDecisao.length} {semDecisao.length === 1 ? 'linha' : 'linhas'} em conferência para continuar.</p>
            ) : (
              <p className="text-meta text-fg-3">Pendentes, sem empresa e sem conta.</p>
            )}
          </div>
          <Botao tamanho="lg" disabled={!pronto} onClick={() => setConfirmando(true)} data-testid="importar" className="w-full sm:w-auto">
            Importar lançamentos
          </Botao>
        </div>
      </div>

      <Dialogo
        aberto={confirmando}
        onFechar={() => !importando && setConfirmando(false)}
        titulo="Confirmar importação"
        descricao="Os lançamentos serão criados de uma vez (tudo ou nada). Você pode desfazer depois pelo histórico de importações."
        bloqueado={importando}
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setConfirmando(false)} disabled={importando}>
              Voltar
            </Botao>
            <Botao onClick={importar} carregando={importando} textoCarregando="Importando..." data-testid="confirmar-importacao">
              Importar {linhasImportar.length}
            </Botao>
          </>
        }
      >
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm" data-testid="resumo-confirmacao">
          <dt className="text-fg-2">Lançamentos pendentes</dt>
          <dd className="numeros text-right font-medium text-fg">{linhasImportar.length}</dd>
          <dt className="text-fg-2">Valor total</dt>
          <dd className="text-right font-medium text-fg">
            <Valor centavos={resumo.importar.totalCentavos} className="numeros" />
          </dd>
          <dt className="text-fg-2">Fornecedores (criados ou reaproveitados)</dt>
          <dd className="numeros text-right text-fg">{resumo.fornecedores}</dd>
          <dt className="text-fg-2">Categorias</dt>
          <dd className="numeros text-right text-fg">{resumo.categorias.length}</dd>
          <dt className="text-fg-2">Valores estimados (revisar)</dt>
          <dd className="numeros text-right text-fg">{resumo.valoresEstimados}</dd>
          <dt className="text-fg-2">Empresa e conta</dt>
          <dd className="text-right text-fg">A definir</dd>
        </dl>
        {importando && (
          <p role="status" className="mt-4 text-sm text-fg-2">
            Importando… Não feche esta janela.
          </p>
        )}
      </Dialogo>
    </div>
  );
}
