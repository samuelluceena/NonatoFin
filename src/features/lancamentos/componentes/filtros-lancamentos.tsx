'use client';

/**
 * Filtros da lista de Boletos: pesquisa e período numa barra compacta,
 * status em chips (atalhos de uso diário) e "Filtros" (categoria, fornecedor,
 * conta, sem empresa) num painel — popover no desktop, sheet no celular. Tudo fica na URL
 * — esta tela só lê os filtros atuais (vindos do servidor) e navega para a URL
 * nova. Regras (o que cada filtro significa): lib/domain/filtros.ts.
 */
import { CalendarDays } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useRef, useState, useTransition, type RefObject } from 'react';
import { Botao } from '@/components/ui/botao';
import { BotaoFiltros } from '@/components/ui/botao-filtros';
import { ChipsFiltro } from '@/components/ui/chips-filtro';
import { BarraFiltros, CampoFiltro, CampoPesquisa, DetalhePeriodo, FiltrosAtivos, SeletorFiltro, type EtiquetaFiltro } from '@/components/ui/filtros-lista';
import { PainelFiltros } from '@/components/ui/painel-filtros';
import type { DataISO } from '@/lib/domain/datas';
import {
  FILTROS_PADRAO,
  OPCOES_PERIODO,
  PERIODO_PADRAO,
  SEM_CONTA,
  SEM_EMPRESA,
  STATUS_FILTRO,
  consultaDosFiltros,
  periodoDoTipo,
  periodoImplicito,
  quantidadeFiltrosExtras,
  rotuloDoPeriodo,
  rotuloDoStatus,
  type FiltrosLista,
  type TipoPeriodo,
} from '@/lib/domain/filtros';

export interface OpcaoFiltro {
  id: string;
  rotulo: string;
}

interface Props {
  filtros: FiltrosLista;
  /** false = o período não foi escolhido (é o implícito): a pesquisa então busca em todo o período. */
  periodoExplicito: boolean;
  hoje: DataISO;
  fornecedores: OpcaoFiltro[];
  categorias: OpcaoFiltro[];
  contas: OpcaoFiltro[];
  /** Oferece o filtro "Sem empresa definida" (há lançamentos sem empresa). */
  semEmpresaDisponivel?: boolean;
}

type Extras = Pick<FiltrosLista, 'categoriaId' | 'fornecedorId' | 'contaId' | 'semEmpresa'>;

export function FiltrosLancamentos({ filtros, periodoExplicito, hoje, fornecedores, categorias, contas, semEmpresaDisponivel = false }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [pendente, iniciar] = useTransition();
  const [maisAberto, setMaisAberto] = useState(false);
  const botaoFiltros = useRef<HTMLButtonElement>(null);

  function irPara(novos: FiltrosLista) {
    iniciar(() => router.replace(`${pathname}${consultaDosFiltros(novos)}`, { scroll: false }));
  }
  const mudar = (parcial: Partial<FiltrosLista>) => irPara({ ...filtros, ...parcial });

  const extras = quantidadeFiltrosExtras(filtros);
  const nomeDe = (lista: OpcaoFiltro[], id: string) => lista.find((o) => o.id === id)?.rotulo ?? '…';
  const periodoEscolhido = periodoExplicito && filtros.periodo.tipo !== PERIODO_PADRAO.tipo;
  const etiquetas: EtiquetaFiltro[] = [];
  if (periodoEscolhido) etiquetas.push({ chave: 'periodo', rotulo: rotuloDoPeriodo(filtros.periodo), remover: () => mudar({ periodo: periodoImplicito(filtros.busca) }) });
  if (filtros.status !== 'todos') etiquetas.push({ chave: 'status', rotulo: rotuloDoStatus(filtros.status), remover: () => mudar({ status: 'todos' }) });
  if (filtros.categoriaId) etiquetas.push({ chave: 'categoria', rotulo: nomeDe(categorias, filtros.categoriaId), remover: () => mudar({ categoriaId: '' }) });
  if (filtros.fornecedorId) etiquetas.push({ chave: 'fornecedor', rotulo: nomeDe(fornecedores, filtros.fornecedorId), remover: () => mudar({ fornecedorId: '' }) });
  if (filtros.contaId) {
    const rotulo = filtros.contaId === SEM_CONTA ? 'Sem conta definida' : nomeDe(contas, filtros.contaId);
    etiquetas.push({ chave: 'conta', rotulo, remover: () => mudar({ contaId: '' }) });
  }
  if (filtros.semEmpresa) etiquetas.push({ chave: 'empresa', rotulo: 'Sem empresa definida', remover: () => mudar({ semEmpresa: false }) });
  const algoFiltrado = etiquetas.length > 0 || filtros.busca !== '';

  return (
    <div className="mb-5 flex flex-col gap-3">
      <BarraFiltros
        pesquisa={
          <CampoPesquisa
            busca={filtros.busca}
            pendente={pendente}
            aoPesquisar={(busca) =>
              // Sem período escolhido, a pesquisa procura em todo o período (e volta ao mês ao limpar).
              mudar({ busca, periodo: periodoExplicito ? filtros.periodo : periodoImplicito(busca) })
            }
          />
        }
      >
        <SeletorFiltro
          id="filtro-periodo"
          rotulo="Período"
          icone={<CalendarDays />}
          valor={filtros.periodo.tipo}
          ativo={periodoEscolhido}
          aoMudar={(v) => mudar({ periodo: periodoDoTipo(v as TipoPeriodo, hoje) })}
          opcoes={OPCOES_PERIODO}
        />
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

      <DetalhePeriodo periodo={filtros.periodo} aoMudar={(periodo) => mudar({ periodo })} />

      <ChipsFiltro
        rotulo="Filtrar boletos"
        chips={STATUS_FILTRO.map((s) => ({
          href: `${pathname}${consultaDosFiltros({ ...filtros, status: s.valor })}`,
          rotulo: s.rotulo,
          ativo: s.valor === filtros.status,
        }))}
      />

      {algoFiltrado && <FiltrosAtivos etiquetas={etiquetas} aoLimpar={() => irPara(FILTROS_PADRAO)} />}

      {maisAberto && (
        <MaisFiltros
          ancora={botaoFiltros}
          filtros={filtros}
          fornecedores={fornecedores}
          categorias={categorias}
          contas={contas}
          semEmpresaDisponivel={semEmpresaDisponivel || filtros.semEmpresa}
          aoFechar={() => setMaisAberto(false)}
          aoAplicar={(parcial) => {
            setMaisAberto(false);
            mudar(parcial);
          }}
        />
      )}
    </div>
  );
}

interface PropsMais {
  ancora: RefObject<HTMLButtonElement | null>;
  filtros: FiltrosLista;
  fornecedores: OpcaoFiltro[];
  categorias: OpcaoFiltro[];
  contas: OpcaoFiltro[];
  semEmpresaDisponivel: boolean;
  aoFechar: () => void;
  aoAplicar: (parcial: Extras) => void;
}

/** Categoria, fornecedor, conta e empresa: escolhe tudo e aplica de uma vez. */
function MaisFiltros({ ancora, filtros, fornecedores, categorias, contas, semEmpresaDisponivel, aoFechar, aoAplicar }: PropsMais) {
  const [escolha, setEscolha] = useState<Extras>({
    categoriaId: filtros.categoriaId,
    fornecedorId: filtros.fornecedorId,
    contaId: filtros.contaId,
    semEmpresa: filtros.semEmpresa,
  });
  const definir = (chave: keyof Extras) => (valor: string) => setEscolha((atual) => ({ ...atual, [chave]: valor }));
  const algum = Boolean(escolha.categoriaId || escolha.fornecedorId || escolha.contaId || escolha.semEmpresa);

  return (
    <PainelFiltros
      aberto
      ancora={ancora}
      onFechar={aoFechar}
      rodape={
        <>
          {algum && (
            <Botao variante="fantasma" onClick={() => setEscolha({ categoriaId: '', fornecedorId: '', contaId: '', semEmpresa: false })}>
              Limpar estes filtros
            </Botao>
          )}
          <Botao onClick={() => aoAplicar(escolha)}>Aplicar</Botao>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <CampoFiltro id="filtro-categoria" rotulo="Categoria" todos="Todas as categorias" valor={escolha.categoriaId} aoMudar={definir('categoriaId')} opcoes={categorias} />
        <CampoFiltro id="filtro-fornecedor" rotulo="Fornecedor" todos="Todos os fornecedores" valor={escolha.fornecedorId} aoMudar={definir('fornecedorId')} opcoes={fornecedores} />
        {contas.length > 0 && (
          <CampoFiltro
            id="filtro-conta"
            rotulo="Conta"
            todos="Todas as contas"
            valor={escolha.contaId}
            aoMudar={definir('contaId')}
            opcoes={[{ id: SEM_CONTA, rotulo: 'Sem conta definida' }, ...contas]}
          />
        )}
        {semEmpresaDisponivel && (
          <CampoFiltro
            id="filtro-empresa"
            rotulo="Empresa"
            todos="Conforme o seletor do topo"
            valor={escolha.semEmpresa ? SEM_EMPRESA : ''}
            aoMudar={(v) => setEscolha((atual) => ({ ...atual, semEmpresa: v === SEM_EMPRESA }))}
            opcoes={[{ id: SEM_EMPRESA, rotulo: 'Sem empresa definida' }]}
          />
        )}
      </div>
    </PainelFiltros>
  );
}
