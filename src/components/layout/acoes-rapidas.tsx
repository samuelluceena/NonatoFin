'use client';

/**
 * Ações rápidas ("+"): Despesa (conta a pagar ou compra no cartão) e Entrada
 * (em uma conta bancária). No celular é o botão central da barra inferior
 * (speed dial); no desktop, o botão do menu lateral (menu suspenso).
 *
 * Só leva aos fluxos que já existem: /boletos/novo, /cartoes/compras/nova e
 * o diálogo de entrada das contas (DialogoEntrada).
 */
import Link from 'next/link';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Plus,
  ReceiptText,
} from 'lucide-react';
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { toast } from 'sonner';
import { classesBotao } from '@/components/ui/botao';
import { Dica } from '@/components/ui/dica';
import { contasParaEntrada } from '@/features/contas/acoes';
import { DialogoEntrada } from '@/features/contas/componentes/acoes-conta';
import { hojeISO, type DataISO } from '@/lib/domain/datas';
import type { ContaBancaria } from '@/lib/domain/tipos';
import { cn } from '@/lib/utils/cn';

type Etapa = 'inicio' | 'despesa';
type Tom = 'despesa' | 'entrada';

const TONS: Record<Tom, string> = {
  despesa: 'border-danger-border bg-danger-soft text-danger',
  entrada: 'border-success-border bg-success-soft text-success',
};

const ROTULO = 'Novo lançamento';

interface EstadoEntrada {
  aberta: boolean;
  hoje: DataISO;
  /** null enquanto carrega. */
  contas: ContaBancaria[] | null;
}

interface Props {
  variante: 'fab' | 'lateral';
  /** Sidebar recolhida: só o ícone (com dica) e o menu abre ao lado. */
  compacta?: boolean;
  className?: string;
}

export function AcoesRapidas({ variante, compacta = false, className }: Props) {
  const fab = variante === 'fab';
  const gatilho = useRef<HTMLButtonElement>(null);
  const dialogo = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();
  const [aberto, setAberto] = useState(false);
  const [etapa, setEtapa] = useState<Etapa>('inicio');
  const [posicao, setPosicao] = useState<CSSProperties>();
  const [entrada, setEntrada] = useState<EstadoEntrada>({ aberta: false, hoje: '', contas: null });

  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal();
    if (!aberto && d.open) d.close();
  }, [aberto]);

  function abrir() {
    if (!fab && gatilho.current) {
      const r = gatilho.current.getBoundingClientRect();
      setPosicao(compacta ? { top: r.top, left: r.right + 8, width: 288 } : { top: r.bottom + 6, left: r.left, width: Math.max(r.width, 288) });
    }
    setEtapa('inicio');
    setAberto(true);
  }

  const fechar = () => setAberto(false);

  async function abrirEntrada() {
    fechar();
    setEntrada({ aberta: true, hoje: hojeISO(), contas: null });
    let erro = 'Erro de conexão. Tente novamente.';
    try {
      const r = await contasParaEntrada();
      if (r.ok) {
        setEntrada((e) => ({ ...e, contas: r.dados }));
        return;
      }
      erro = r.erro;
    } catch {
      // mensagem padrão acima
    }
    toast.error(erro);
    setEntrada((e) => ({ ...e, aberta: false }));
  }

  const botao = (
      <button
        ref={gatilho}
        type="button"
        onClick={abrir}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-label={fab || compacta ? ROTULO : undefined}
        data-testid="acoes-rapidas"
        className={cn(
          fab
            ? 'grid size-12 place-items-center rounded-full bg-primary text-primary-fg shadow-md ring-4 ring-surface transition-[transform,background-color] duration-150 hover:bg-primary-hover active:scale-95'
            : compacta
              ? classesBotao('primario', 'md', 'size-10 px-0 lg:h-10')
              : classesBotao('primario', 'md', 'w-full'),
          className,
        )}
      >
        <Plus className={fab ? 'size-6' : 'size-4.5'} aria-hidden="true" />
        {!fab && !compacta && ROTULO}
      </button>
  );

  return (
    <>
      {compacta ? (
        <Dica texto={ROTULO}>{botao}</Dica>
      ) : (
        botao
      )}

      <dialog
        ref={dialogo}
        aria-labelledby={idTitulo}
        onClose={fechar}
        onClick={(e) => {
          // Clique fora das opções fecha.
          if (e.target === e.currentTarget) fechar();
        }}
        className={cn(
          'fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-hidden bg-transparent p-0 text-fg',
          'backdrop:animate-esmaecer',
          !fab && 'backdrop:bg-transparent',
        )}
      >
        {aberto && (
          <>
            <h2 id={idTitulo} className="sr-only">
              {etapa === 'despesa' ? 'Nova despesa' : ROTULO}
            </h2>
            <div
              key={etapa}
              style={fab ? undefined : posicao}
              className={cn(
                'pointer-events-none absolute flex flex-col',
                fab
                  ? 'inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] mx-auto w-[min(20rem,calc(100%-2rem))] gap-2'
                  : 'pointer-events-auto animate-surgir gap-0.5 rounded-lg border border-border bg-surface-elevated p-1.5 shadow-lg',
              )}
            >
              {etapa === 'inicio' ? (
                <>
                  <ItemAcao
                    fab={fab}
                    indice={0}
                    tom="despesa"
                    icone={<ArrowUpRight />}
                    titulo="Despesa"
                    descricao="Conta a pagar ou compra no cartão"
                    onClick={() => setEtapa('despesa')}
                    submenu
                    testId="acao-despesa"
                  />
                  <ItemAcao
                    fab={fab}
                    indice={1}
                    tom="entrada"
                    icone={<ArrowDownLeft />}
                    titulo="Entrada"
                    descricao="Dinheiro recebido em uma conta"
                    onClick={() => void abrirEntrada()}
                    testId="acao-entrada"
                  />
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setEtapa('inicio')}
                    className={cn(
                      'pointer-events-auto flex h-10 animate-surgir items-center gap-1 self-start rounded-md pr-3 pl-2 text-sm font-medium text-fg-2 transition-colors hover:text-fg',
                      fab ? 'mb-0.5 border border-border bg-surface-elevated shadow-md' : 'hover:bg-surface-2',
                    )}
                  >
                    <ChevronLeft className="size-4" aria-hidden="true" />
                    Voltar
                  </button>
                  <ItemAcao
                    fab={fab}
                    indice={1}
                    tom="despesa"
                    icone={<ReceiptText />}
                    titulo="Conta a pagar"
                    descricao="Boleto, empréstimo, despesa fixa ou variada"
                    href="/boletos/novo"
                    onClick={fechar}
                    testId="acao-conta-a-pagar"
                  />
                  <ItemAcao
                    fab={fab}
                    indice={2}
                    tom="despesa"
                    icone={<CreditCard />}
                    titulo="Compra no cartão"
                    descricao="À vista ou parcelada; entra na fatura certa"
                    href="/cartoes/compras/nova"
                    onClick={fechar}
                    testId="acao-compra-cartao"
                  />
                </>
              )}
            </div>
            {fab && (
              <button
                type="button"
                onClick={fechar}
                aria-label="Fechar"
                className="absolute bottom-[calc(env(safe-area-inset-bottom)+4px)] left-1/2 grid size-12 -translate-x-1/2 place-items-center rounded-full border border-border bg-surface-elevated text-fg shadow-lg"
              >
                <Plus className="size-6 animate-girar-fechar" aria-hidden="true" />
              </button>
            )}
          </>
        )}
      </dialog>

      <DialogoEntrada
        aberto={entrada.aberta}
        onFechar={() => setEntrada((e) => ({ ...e, aberta: false }))}
        hoje={entrada.hoje}
        contas={entrada.contas}
      />
    </>
  );
}

interface PropsItem {
  /** true = cartão flutuante (speed dial); false = linha do menu suspenso. */
  fab: boolean;
  indice: number;
  tom: Tom;
  icone: ReactNode;
  titulo: string;
  descricao: string;
  onClick: () => void;
  href?: string;
  submenu?: boolean;
  testId: string;
}

/** Opção do menu: ícone + título + descrição (a cor nunca é o único sinal). */
function ItemAcao({ fab, indice, tom, icone, titulo, descricao, onClick, href, submenu, testId }: PropsItem) {
  const classes = cn(
    'pointer-events-auto flex w-full items-center gap-3 text-left transition-[background-color,transform] duration-150 hover:bg-surface-2 active:scale-[0.99]',
    fab
      ? 'min-h-16 animate-surgir rounded-lg border border-border bg-surface-elevated p-2.5 pr-3 shadow-lg'
      : 'min-h-14 rounded-md p-2 pr-2.5 focus-visible:-outline-offset-2',
  );
  const conteudo = (
    <>
      <span className={cn('grid size-10 shrink-0 place-items-center rounded-md border [&_svg]:size-5', TONS[tom])} aria-hidden="true">
        {icone}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-body font-medium text-fg">{titulo}</span>
        <span className="block text-meta text-fg-3">{descricao}</span>
      </span>
      {submenu && <ChevronRight className="size-4 shrink-0 text-fg-3" aria-hidden="true" />}
    </>
  );
  const estilo = { animationDelay: `${indice * 40}ms` };

  // O primeiro item de cada etapa recebe o foco (teclado e leitores de tela).
  return href ? (
    <Link href={href} onClick={onClick} className={classes} style={estilo} data-testid={testId} autoFocus={indice === 1}>
      {conteudo}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={classes} style={estilo} data-testid={testId} autoFocus={indice === 0}>
      {conteudo}
    </button>
  );
}
