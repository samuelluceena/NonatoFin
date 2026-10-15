'use client';

/**
 * Filtros de Transações: pesquisa, período, tipo e status numa barra compacta
 * e "Filtros" (empresa, categoria, conta, fornecedor) num painel — popover no
 * desktop, sheet no celular. Tudo fica na URL; esta tela só lê os filtros
 * atuais e navega para a URL nova. O significado de cada filtro está em
 * lib/domain/transacoes.ts (e o período em lib/domain/filtros.ts).
 */
import { ArrowLeftRight, CalendarDays, CircleDot } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useRef, useState, useTransition, type RefObject } from 'react';
import { Botao } from '@/components/ui/botao';
import { BotaoFiltros } from '@/components/ui/botao-filtros';
import {
  BarraFiltros,
  CampoFiltro,
  CampoPesquisa,
  DetalhePeriodo,
  FiltrosAtivos,
  SeletorFiltro,
  type EtiquetaFiltro,
} from '@/components/ui/filtros-lista';
import { PainelFiltros } from '@/components/ui/painel-filtros';
import type { DataISO } from '@/lib/domain/datas';
import { OPCOES_PERIODO, SEM_CONTA, SEM_EMPRESA, periodoDoTipo, periodoImplicito, rotuloDoPeriodo, type TipoPeriodo } from '@/lib/domain/filtros';
import {
  FILTROS_TRANSACOES_PADRAO,
  STATUS_FILTRO_TRANSACAO,
  TIPOS_FILTRO_TRANSACAO,
  consultaDosFiltrosTransacoes,
  quantidadeFiltrosExtrasTransacoes,
  rotuloStatusFiltro,
  rotuloTipoFiltro,
  type FiltrosTransacoes,
  type StatusFiltroTransacao,
  type TipoFiltroTransacao,
} from '@/lib/domain/transacoes';

export interface OpcaoFiltro {
  id: string;
  rotulo: string;
}

interface Props {
  filtros: FiltrosTransacoes;
  /** false = período implícito: a pesquisa então busca em todo o período. */
  periodoExplicito: boolean;
  hoje: DataISO;
  /** Vazio quando o seletor do topo já fixou uma empresa (ou só existe uma). */
  empresas: OpcaoFiltro[];
  categorias: OpcaoFiltro[];
  contas: OpcaoFiltro[];
  fornecedores: OpcaoFiltro[];
  /** Oferece "Sem empresa definida" no filtro de empresa (há lançamentos sem empresa). */
  semEmpresaDisponivel?: boolean;
}

type Extras = Pick<FiltrosTransacoes, 'empresaId' | 'categoriaId' | 'contaId' | 'fornecedorId'>;
const EXTRAS_VAZIOS: Extras = { empresaId: '', categoriaId: '', contaId: '', fornecedorId: '' };

export function FiltrosTransacoes({ filtros, periodoExplicito, hoje, empresas, categorias, contas, fornecedores, semEmpresaDisponivel = false }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [pendente, iniciar] = useTransition();
  const [maisAberto, setMaisAberto] = useState(false);
  const botaoFiltros = useRef<HTMLButtonElement>(null);

  function irPara(novos: FiltrosTransacoes) {
    iniciar(() => router.replace(`${pathname}${consultaDosFiltrosTransacoes(novos)}`, { scroll: false }));
  }
  const mudar = (parcial: Partial<FiltrosTransacoes>) => irPara({ ...filtros, ...parcial });

  const extras = quantidadeFiltrosExtrasTransacoes(filtros);
  const nomeDe = (lista: OpcaoFiltro[], id: string) => lista.find((o) => o.id === id)?.rotulo ?? '…';
  const periodoEscolhido = periodoExplicito && filtros.periodo.tipo !== FILTROS_TRANSACOES_PADRAO.periodo.tipo;
  const etiquetas: EtiquetaFiltro[] = [];
  if (periodoEscolhido) {
    etiquetas.push({ chave: 'periodo', rotulo: rotuloDoPeriodo(filtros.periodo), remover: () => mudar({ periodo: periodoImplicito(filtros.busca) }) });
  }
  if (filtros.tipo !== 'todos') etiquetas.push({ chave: 'tipo', rotulo: rotuloTipoFiltro(filtros.tipo), remover: () => mudar({ tipo: 'todos' }) });
  if (filtros.status !== 'todos') etiquetas.push({ chave: 'status', rotulo: rotuloStatusFiltro(filtros.status), remover: () => mudar({ status: 'todos' }) });
  if (filtros.empresaId) {
    const rotulo = filtros.empresaId === SEM_EMPRESA ? 'Sem empresa definida' : nomeDe(empresas, filtros.empresaId);
    etiquetas.push({ chave: 'empresa', rotulo, remover: () => mudar({ empresaId: '' }) });
  }
  if (filtros.categoriaId) etiquetas.push({ chave: 'categoria', rotulo: nomeDe(categorias, filtros.categoriaId), remover: () => mudar({ categoriaId: '' }) });
  if (filtros.contaId) {
    const rotulo = filtros.contaId === SEM_CONTA ? 'Sem conta definida' : nomeDe(contas, filtros.contaId);
    etiquetas.push({ chave: 'conta', rotulo, remover: () => mudar({ contaId: '' }) });
  }
  if (filtros.fornecedorId) etiquetas.push({ chave: 'fornecedor', rotulo: nomeDe(fornecedores, filtros.fornecedorId), remover: () => mudar({ fornecedorId: '' }) });
  const algoFiltrado = etiquetas.length > 0 || filtros.busca !== '';

  return (
    <div className="mb-5 flex flex-col gap-3" data-testid="filtros-transacoes">
      <BarraFiltros
        pesquisa={
          <CampoPesquisa
            busca={filtros.busca}
            pendente={pendente}
            rotulo="Pesquisar transações por descrição ou fornecedor"
            placeholder="Pesquisar descrição ou fornecedor"
            aoPesquisar={(busca) => mudar({ busca, periodo: periodoExplicito ? filtros.periodo : periodoImplicito(busca) })}
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
        <SeletorFiltro
          id="filtro-tipo"
          rotulo="Tipo"
          icone={<ArrowLeftRight />}
          valor={filtros.tipo}
          ativo={filtros.tipo !== 'todos'}
          aoMudar={(v) => mudar({ tipo: v as TipoFiltroTransacao })}
          opcoes={TIPOS_FILTRO_TRANSACAO}
        />
        <SeletorFiltro
          id="filtro-status"
          rotulo="Status"
          icone={<CircleDot />}
          valor={filtros.status}
          ativo={filtros.status !== 'todos'}
          aoMudar={(v) => mudar({ status: v as StatusFiltroTransacao })}
          opcoes={STATUS_FILTRO_TRANSACAO}
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

      {algoFiltrado && <FiltrosAtivos etiquetas={etiquetas} aoLimpar={() => irPara(FILTROS_TRANSACOES_PADRAO)} />}

      {maisAberto && (
        <MaisFiltros
          ancora={botaoFiltros}
          filtros={filtros}
          empresas={empresas}
          categorias={categorias}
          contas={contas}
          fornecedores={fornecedores}
          semEmpresaDisponivel={semEmpresaDisponivel || filtros.empresaId === SEM_EMPRESA}
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
  filtros: FiltrosTransacoes;
  empresas: OpcaoFiltro[];
  categorias: OpcaoFiltro[];
  contas: OpcaoFiltro[];
  fornecedores: OpcaoFiltro[];
  semEmpresaDisponivel: boolean;
  aoFechar: () => void;
  aoAplicar: (parcial: Extras) => void;
}

/** Empresa, categoria, conta e fornecedor: escolhe tudo e aplica de uma vez. */
function MaisFiltros({ ancora, filtros, empresas, categorias, contas, fornecedores, semEmpresaDisponivel, aoFechar, aoAplicar }: PropsMais) {
  const [escolha, setEscolha] = useState<Extras>({
    empresaId: filtros.empresaId,
    categoriaId: filtros.categoriaId,
    contaId: filtros.contaId,
    fornecedorId: filtros.fornecedorId,
  });
  const definir = (chave: keyof Extras) => (valor: string) => setEscolha((atual) => ({ ...atual, [chave]: valor }));
  const algum = Object.values(escolha).some(Boolean);

  return (
    <PainelFiltros
      aberto
      ancora={ancora}
      onFechar={aoFechar}
      descricao="Fornecedor vale para contas a pagar e pagamentos; categoria, também para compras no cartão; conta, para o que passa pelas contas bancárias."
      rodape={
        <>
          {algum && (
            <Botao variante="fantasma" onClick={() => setEscolha(EXTRAS_VAZIOS)}>
              Limpar estes filtros
            </Botao>
          )}
          <Botao onClick={() => aoAplicar(escolha)}>Aplicar</Botao>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {(empresas.length > 1 || semEmpresaDisponivel) && (
          <CampoFiltro
            id="filtro-empresa"
            rotulo="Empresa"
            todos={empresas.length > 1 ? 'Todas as empresas' : 'Conforme o seletor do topo'}
            valor={escolha.empresaId}
            aoMudar={definir('empresaId')}
            opcoes={[...(semEmpresaDisponivel ? [{ id: SEM_EMPRESA, rotulo: 'Sem empresa definida' }] : []), ...empresas]}
          />
        )}
        <CampoFiltro id="filtro-categoria" rotulo="Categoria" todos="Todas as categorias" valor={escolha.categoriaId} aoMudar={definir('categoriaId')} opcoes={categorias} />
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
        <CampoFiltro id="filtro-fornecedor" rotulo="Fornecedor" todos="Todos os fornecedores" valor={escolha.fornecedorId} aoMudar={definir('fornecedorId')} opcoes={fornecedores} />
      </div>
    </PainelFiltros>
  );
}
