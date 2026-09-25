'use client';

/**
 * Filtros do Histórico: pesquisa na barra e "Filtros" (fornecedor e período
 * do pagamento) num painel — popover no desktop, sheet no celular. Tudo fica
 * na URL (`q`, `fornecedor`, `de`, `ate`); a consulta usa a data do pagamento.
 */
import { usePathname, useRouter } from 'next/navigation';
import { useRef, useState, useTransition, type RefObject } from 'react';
import { Botao } from '@/components/ui/botao';
import { BotaoFiltros } from '@/components/ui/botao-filtros';
import { Entrada } from '@/components/ui/campo';
import { BarraFiltros, CampoFiltro, CampoPesquisa, FiltrosAtivos, type EtiquetaFiltro } from '@/components/ui/filtros-lista';
import { PainelFiltros } from '@/components/ui/painel-filtros';
import { ehDataISOValida, formatarData } from '@/lib/domain/datas';
import type { Fornecedor } from '@/lib/domain/tipos';

interface Props {
  busca: string;
  fornecedorId: string;
  fornecedores: Fornecedor[];
  de: string;
  ate: string;
}

interface Filtros {
  q: string;
  fornecedor: string;
  de: string;
  ate: string;
}

function rotuloPeriodo(de: string, ate: string): string {
  if (de && ate) return `Pago de ${formatarData(de)} a ${formatarData(ate)}`;
  if (de) return `Pago a partir de ${formatarData(de)}`;
  return `Pago até ${formatarData(ate)}`;
}

export function FiltrosHistorico({ busca, fornecedorId, fornecedores, de, ate }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [pendente, iniciar] = useTransition();
  const [maisAberto, setMaisAberto] = useState(false);
  const botaoFiltros = useRef<HTMLButtonElement>(null);
  const atuais: Filtros = { q: busca, fornecedor: fornecedorId, de, ate };

  function ir(parcial: Partial<Filtros>) {
    const novos = { ...atuais, ...parcial };
    const sp = new URLSearchParams(Object.entries(novos).filter(([, v]) => v) as [string, string][]);
    const qs = sp.toString();
    iniciar(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  const nomeFornecedor = fornecedores.find((f) => f.id === fornecedorId)?.nome ?? '…';
  const etiquetas: EtiquetaFiltro[] = [];
  if (fornecedorId) etiquetas.push({ chave: 'fornecedor', rotulo: nomeFornecedor, remover: () => ir({ fornecedor: '' }) });
  if (de || ate) etiquetas.push({ chave: 'periodo', rotulo: rotuloPeriodo(de, ate), remover: () => ir({ de: '', ate: '' }) });
  const extras = Number(Boolean(fornecedorId)) + Number(Boolean(de || ate));

  return (
    <div className="mb-5 flex flex-col gap-3">
      <BarraFiltros
        pesquisa={<CampoPesquisa id="busca-historico" rotulo="Pesquisar no histórico" busca={busca} pendente={pendente} aoPesquisar={(q) => ir({ q })} />}
      >
        <BotaoFiltros
          ref={botaoFiltros}
          quantidade={extras}
          className="shrink-0"
          onClick={() => setMaisAberto((a) => !a)}
          aria-expanded={maisAberto}
          aria-haspopup="dialog"
          data-testid="mais-filtros"
        />
      </BarraFiltros>

      {(etiquetas.length > 0 || busca) && <FiltrosAtivos etiquetas={etiquetas} aoLimpar={() => ir({ q: '', fornecedor: '', de: '', ate: '' })} />}

      {maisAberto && (
        <MaisFiltros
          ancora={botaoFiltros}
          atuais={atuais}
          fornecedores={fornecedores}
          aoFechar={() => setMaisAberto(false)}
          aoAplicar={(parcial) => {
            setMaisAberto(false);
            ir(parcial);
          }}
        />
      )}
    </div>
  );
}

function MaisFiltros({
  ancora,
  atuais,
  fornecedores,
  aoFechar,
  aoAplicar,
}: {
  ancora: RefObject<HTMLButtonElement | null>;
  atuais: Filtros;
  fornecedores: Fornecedor[];
  aoFechar: () => void;
  aoAplicar: (parcial: Omit<Filtros, 'q'>) => void;
}) {
  const [escolha, setEscolha] = useState({ fornecedor: atuais.fornecedor, de: atuais.de, ate: atuais.ate });
  const definirData = (campo: 'de' | 'ate', valor: string) => {
    if (valor === '' || ehDataISOValida(valor)) setEscolha((e) => ({ ...e, [campo]: valor }));
  };
  const algum = Boolean(escolha.fornecedor || escolha.de || escolha.ate);

  return (
    <PainelFiltros
      aberto
      ancora={ancora}
      onFechar={aoFechar}
      descricao="O período usa a data em que o boleto foi pago."
      rodape={
        <>
          {algum && (
            <Botao variante="fantasma" onClick={() => setEscolha({ fornecedor: '', de: '', ate: '' })}>
              Limpar estes filtros
            </Botao>
          )}
          <Botao onClick={() => aoAplicar(escolha)}>Aplicar</Botao>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <CampoFiltro
          id="historico-fornecedor"
          rotulo="Fornecedor"
          todos="Todos os fornecedores"
          valor={escolha.fornecedor}
          aoMudar={(fornecedor) => setEscolha((e) => ({ ...e, fornecedor }))}
          opcoes={fornecedores.map((f) => ({ id: f.id, rotulo: f.nome }))}
        />
        <div className="grid grid-cols-2 gap-3">
          <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium text-fg-2">
            Pago de
            <Entrada type="date" value={escolha.de} onChange={(e) => definirData('de', e.target.value)} />
          </label>
          <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium text-fg-2">
            Até
            <Entrada type="date" value={escolha.ate} onChange={(e) => definirData('ate', e.target.value)} />
          </label>
        </div>
      </div>
    </PainelFiltros>
  );
}
