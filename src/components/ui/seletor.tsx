'use client';

/**
 * Seletor (select customizado) — padrão "select-only combobox" do WAI-ARIA.
 *
 * - O gatilho é um <button role="combobox"> com o `id` do campo (o <label for>
 *   do <Campo> continua ligado); o foco fica nele e a opção ativa é indicada
 *   por `aria-activedescendant`.
 * - Teclado: Enter/Espaço/setas abrem; setas, Home/End e PageUp/PageDown
 *   navegam; letras saltam para a opção; Enter/Espaço escolhem; Esc e Tab
 *   fecham. Clique fora, rolagem ou redimensionar também fecham.
 * - A lista usa a Popover API (top layer): fica acima de <dialog> modal e não
 *   é cortada por áreas com overflow. Posição `fixed`, sempre dentro da tela.
 * - Compatível com React Hook Form: `{...register()}` (a ref expõe `value` e
 *   `focus()`, e `onChange`/`onBlur` recebem `{ target: { name, value } }`) e
 *   com uso controlado (`value` + `onChange`). O valor é sempre string.
 */
import { Check, ChevronDown } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { cn } from '@/lib/utils/cn';
import { classeControle } from './campo';

export interface OpcaoSeletor {
  valor: string;
  rotulo: string;
  desabilitada?: boolean;
}

/** Evento entregue a `onChange`/`onBlur` (mesma forma que o RHF lê de um input). */
export interface EventoSeletor {
  target: { name: string; value: string };
  type: 'change' | 'blur';
}

/** O que a `ref` expõe (o RHF lê/escreve `value` e chama `focus()` no erro). */
export interface ControleSeletor {
  name: string;
  value: string;
  focus: () => void;
}

export interface PropsSeletor {
  id?: string;
  name?: string;
  opcoes: readonly OpcaoSeletor[];
  /** Opção de valor '' mostrada em tom neutro ("Selecione a categoria"). */
  placeholder?: string;
  /** Controlado. */
  value?: string;
  /** Não controlado (sem RHF). */
  defaultValue?: string;
  onChange?: (evento: EventoSeletor) => void;
  onBlur?: (evento: EventoSeletor) => void;
  disabled?: boolean;
  /** `campo` (formulários), `filtro` (chip compacto nas listas), `compacto` (seletor global de empresa). */
  variante?: 'campo' | 'filtro' | 'compacto';
  /** Ícone à esquerda do texto (filtro e compacto). */
  icone?: ReactNode;
  /** Filtro aplicado (valor diferente do padrão): destaque suave. */
  ativo?: boolean;
  className?: string;
  title?: string;
  ref?: Ref<ControleSeletor>;
  'aria-label'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
  'aria-describedby'?: string;
  'data-testid'?: string;
}

const MARGEM = 8;
const ALTURA_MAX = 320;

/** Aberto: mesmo anel do foco (variantes vêm depois das classes base no CSS). */
const ABERTO = 'aria-expanded:border-ring aria-expanded:ring-3 aria-expanded:ring-ring/20';

function classesGatilho(variante: 'campo' | 'filtro' | 'compacto', comIcone: boolean, ativo?: boolean) {
  if (variante === 'compacto') {
    return cn(
      'flex h-10 w-full min-w-0 items-center rounded-md border border-border bg-surface pr-8 text-left font-medium text-fg shadow-xs',
      'transition-[border-color,box-shadow] duration-150 hover:border-border-strong focus:border-ring focus:ring-3 focus:ring-ring/20 focus:outline-none',
      'disabled:cursor-not-allowed disabled:opacity-60 lg:h-9',
      comIcone ? 'pl-8' : 'pl-3',
      ABERTO,
    );
  }
  return classeControle(
    cn(
      'flex items-center text-left',
      variante === 'filtro' ? 'w-auto h-11 max-w-[16rem] pr-9 font-medium lg:h-10' : 'h-11 pr-9 lg:h-10',
      comIcone && 'pl-9',
      ABERTO,
    ),
    ativo,
  );
}

/** Popover API (top layer). Sem ela (ex.: jsdom), a lista fica `fixed` com z-index. */
const suportaPopover = () => typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype;

/** Compara sem acento e sem caixa (busca ao digitar). */
const normalizar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export function Seletor({
  id,
  name = '',
  opcoes: opcoesBase,
  placeholder,
  value,
  defaultValue,
  onChange,
  onBlur,
  disabled,
  variante = 'campo',
  icone,
  ativo,
  className,
  title,
  ref,
  'aria-label': ariaLabel,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedby,
  'data-testid': testId,
}: PropsSeletor) {
  const idGerado = useId();
  const idLista = `${id ?? idGerado}-lista`;
  const gatilho = useRef<HTMLButtonElement>(null);
  const lista = useRef<HTMLUListElement>(null);

  const opcoes = placeholder !== undefined ? [{ valor: '', rotulo: placeholder }, ...opcoesBase] : opcoesBase;

  // Valor: controlado (`value`) ou interno (defaultValue / escrito pelo RHF via ref).
  const [interno, setInterno] = useState(defaultValue ?? '');
  const valor = value ?? interno;
  // Espelhos para a ref (lidos fora do render pelo RHF e pelos eventos).
  const valorAtual = useRef(valor);
  const nome = useRef(name);
  useLayoutEffect(() => {
    valorAtual.current = valor;
    nome.current = name;
  });

  useImperativeHandle(
    ref,
    () => ({
      get name() {
        return nome.current;
      },
      get value() {
        return valorAtual.current;
      },
      set value(v: string) {
        valorAtual.current = v ?? '';
        setInterno(v ?? '');
      },
      focus: () => gatilho.current?.focus(),
    }),
    [],
  );

  const indiceSelecionado = opcoes.findIndex((o) => o.valor === valor);
  const selecionada = indiceSelecionado >= 0 ? opcoes[indiceSelecionado] : undefined;
  const neutro = !selecionada || (placeholder !== undefined && valor === '');

  const [aberto, setAberto] = useState(false);
  const [ativa, setAtiva] = useState(-1);
  const [estilo, setEstilo] = useState<CSSProperties>({});

  const habilitadas = opcoes.map((o, i) => (o.desabilitada ? -1 : i)).filter((i) => i >= 0);

  // Nome acessível da lista: aria-label, o <label for> do campo ou o title.
  const [rotuloLista, setRotuloLista] = useState<string | undefined>();

  function abrir(inicio?: number) {
    if (disabled || opcoes.length === 0) return;
    const label = id ? document.querySelector(`label[for="${id}"]`)?.textContent?.trim() : undefined;
    setRotuloLista(ariaLabel ?? (label || title));
    setAtiva(inicio ?? (indiceSelecionado >= 0 && !opcoes[indiceSelecionado].desabilitada ? indiceSelecionado : (habilitadas[0] ?? -1)));
    setAberto(true);
  }

  const fechar = useCallback((devolverFoco = true) => {
    setAberto(false);
    if (devolverFoco) gatilho.current?.focus();
  }, []);

  function escolher(indice: number) {
    const opcao = opcoes[indice];
    if (!opcao || opcao.desabilitada) return;
    fechar();
    if (opcao.valor === valor) return; // como o select nativo: sem "change" se nada mudou
    valorAtual.current = opcao.valor;
    if (value === undefined) setInterno(opcao.valor);
    onChange?.({ target: { name, value: opcao.valor }, type: 'change' });
  }

  // Abre a lista na top layer e posiciona junto ao gatilho, sem sair da tela.
  useLayoutEffect(() => {
    const el = lista.current;
    const r = gatilho.current?.getBoundingClientRect();
    if (!aberto || !el || !r) return;
    if (typeof el.showPopover === 'function' && !el.matches(':popover-open')) el.showPopover();
    const larguraTela = document.documentElement.clientWidth;
    const alturaTela = window.innerHeight;
    const abaixo = alturaTela - r.bottom - MARGEM - 4;
    const acima = r.top - MARGEM - 4;
    const alturaConteudo = Math.min(el.scrollHeight, ALTURA_MAX);
    const paraCima = abaixo < alturaConteudo && acima > abaixo;
    const largura = Math.min(Math.max(el.offsetWidth, r.width), larguraTela - MARGEM * 2);
    setEstilo({
      minWidth: Math.min(r.width, larguraTela - MARGEM * 2),
      maxWidth: larguraTela - MARGEM * 2,
      maxHeight: Math.max(120, Math.min(ALTURA_MAX, paraCima ? acima : abaixo)),
      left: Math.max(MARGEM, Math.min(r.left, larguraTela - largura - MARGEM)),
      ...(paraCima ? { bottom: alturaTela - r.top + 4, top: 'auto' } : { top: r.bottom + 4, bottom: 'auto' }),
    });
  }, [aberto]);

  // Mantém a opção ativa visível (sem rolar a página).
  useEffect(() => {
    const el = lista.current;
    if (!aberto || !el || ativa < 0) return;
    const item = el.querySelector<HTMLElement>(`[data-indice="${ativa}"]`);
    if (!item) return;
    if (item.offsetTop < el.scrollTop) el.scrollTop = item.offsetTop - 4;
    else if (item.offsetTop + item.offsetHeight > el.scrollTop + el.clientHeight) el.scrollTop = item.offsetTop + item.offsetHeight - el.clientHeight + 4;
  }, [aberto, ativa, estilo]);

  // Clique fora, rolagem fora da lista e redimensionar fecham.
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      const alvo = e.target as Node;
      if (!lista.current?.contains(alvo) && !gatilho.current?.contains(alvo)) fechar(false);
    };
    const rolagem = (e: Event) => {
      if (!lista.current?.contains(e.target as Node)) fechar(false);
    };
    const redimensionar = () => fechar(false);
    // Esc dentro de um <dialog> modal fecha só a lista, não o diálogo.
    const dialogo = gatilho.current?.closest('dialog');
    const cancelar = (e: Event) => e.preventDefault();
    document.addEventListener('pointerdown', fora);
    window.addEventListener('scroll', rolagem, true);
    window.addEventListener('resize', redimensionar);
    dialogo?.addEventListener('cancel', cancelar);
    return () => {
      document.removeEventListener('pointerdown', fora);
      window.removeEventListener('scroll', rolagem, true);
      window.removeEventListener('resize', redimensionar);
      dialogo?.removeEventListener('cancel', cancelar);
    };
  }, [aberto, fechar]);

  // Busca ao digitar (como no select nativo).
  const busca = useRef({ texto: '', ate: 0 });
  function buscar(tecla: string): number {
    const agora = Date.now();
    const b = busca.current;
    b.texto = agora > b.ate ? tecla : b.texto + tecla;
    b.ate = agora + 700;
    const termo = normalizar(b.texto);
    const base = aberto ? ativa : indiceSelecionado;
    // Uma letra (ou a mesma repetida) avança para a próxima opção com ela;
    // várias letras refinam a busca a partir da opção atual.
    const repetida = [...termo].every((c) => c === termo[0]);
    const alvo = repetida ? termo[0] : termo;
    const ordem = repetida
      ? [...habilitadas.filter((i) => i > base), ...habilitadas.filter((i) => i <= base)]
      : [...habilitadas.filter((i) => i >= base), ...habilitadas.filter((i) => i < base)];
    return ordem.find((i) => normalizar(opcoes[i].rotulo).startsWith(alvo)) ?? -1;
  }

  function mover(passo: number) {
    if (habilitadas.length === 0) return;
    const pos = habilitadas.indexOf(ativa);
    const proxima = pos < 0 ? (passo > 0 ? 0 : habilitadas.length - 1) : Math.max(0, Math.min(habilitadas.length - 1, pos + passo));
    setAtiva(habilitadas[proxima]);
  }

  function aoTeclar(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    const tecla = e.key;
    const letra = tecla.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;

    if (!aberto) {
      if (tecla === 'Enter' || tecla === ' ' || tecla === 'ArrowDown' || tecla === 'ArrowUp') {
        e.preventDefault();
        if (tecla === 'ArrowUp' && indiceSelecionado < 0) abrir(habilitadas.at(-1));
        else abrir();
      } else if (tecla === 'Home' || tecla === 'End') {
        e.preventDefault();
        abrir(tecla === 'Home' ? habilitadas[0] : habilitadas.at(-1));
      } else if (letra) {
        const i = buscar(tecla);
        abrir(i >= 0 ? i : undefined);
      }
      return;
    }

    if (tecla === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
      fechar();
    } else if (tecla === 'Tab') {
      fechar(false);
    } else if (tecla === 'Enter' || (tecla === ' ' && Date.now() > busca.current.ate)) {
      e.preventDefault();
      if (ativa >= 0) escolher(ativa);
    } else if (tecla === 'ArrowDown' || tecla === 'ArrowUp') {
      e.preventDefault();
      if (e.altKey && tecla === 'ArrowUp') {
        if (ativa >= 0) escolher(ativa);
      } else mover(tecla === 'ArrowDown' ? 1 : -1);
    } else if (tecla === 'PageDown' || tecla === 'PageUp') {
      e.preventDefault();
      mover(tecla === 'PageDown' ? 10 : -10);
    } else if (tecla === 'Home' || tecla === 'End') {
      e.preventDefault();
      setAtiva((tecla === 'Home' ? habilitadas[0] : habilitadas.at(-1)) ?? -1);
    } else if (letra) {
      e.preventDefault();
      const i = buscar(tecla);
      if (i >= 0) setAtiva(i);
    }
  }

  const idOpcao = (i: number) => `${idLista}-${i}`;

  return (
    <div className={cn('relative min-w-0', variante === 'filtro' ? 'shrink-0' : 'w-full', className)}>
      {icone && (
        <span
          className={cn(
            'pointer-events-none absolute top-1/2 -translate-y-1/2 [&_svg]:size-4',
            variante === 'compacto' ? 'left-2.5' : 'left-3',
            ativo ? 'text-primary-text' : 'text-fg-3',
          )}
          aria-hidden="true"
        >
          {icone}
        </span>
      )}
      <button
        ref={gatilho}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-controls={aberto ? idLista : undefined}
        aria-activedescendant={aberto && ativa >= 0 ? idOpcao(ativa) : undefined}
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedby}
        data-testid={testId}
        data-valor={valor}
        title={title}
        disabled={disabled}
        onClick={() => (aberto ? fechar() : abrir())}
        onKeyDown={aoTeclar}
        onKeyUp={(e) => e.key === ' ' && e.preventDefault()}
        onBlur={() => {
          if (aberto) fechar(false);
          onBlur?.({ target: { name, value: valorAtual.current }, type: 'blur' });
        }}
        className={classesGatilho(variante, Boolean(icone), ativo)}
      >
        <span className={cn('min-w-0 flex-1 truncate', neutro && !ativo && 'text-fg-3')}>{selecionada?.rotulo ?? placeholder ?? ''}</span>
        <ChevronDown
          className={cn(
            'pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 transition-transform duration-150',
            variante === 'compacto' ? 'right-2.5' : 'right-3',
            ativo ? 'text-primary-text' : 'text-fg-3',
            aberto && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>
      {name && <input type="hidden" name={name} value={valor} />}
      {aberto && (
        <ul
          ref={lista}
          id={idLista}
          role="listbox"
          popover={suportaPopover() ? 'manual' : undefined}
          aria-label={rotuloLista}
          tabIndex={-1}
          style={estilo}
          // O foco continua no gatilho (aria-activedescendant).
          onMouseDown={(e) => e.preventDefault()}
          className="fixed inset-auto z-50 m-0 w-max animate-surgir overflow-y-auto overscroll-contain rounded-lg border border-border bg-surface-elevated p-1 text-fg shadow-lg"
        >
          {opcoes.map((o, i) => {
            const marcada = i === indiceSelecionado;
            return (
              <li
                key={`${o.valor}-${i}`}
                id={idOpcao(i)}
                role="option"
                aria-selected={marcada}
                aria-disabled={o.desabilitada || undefined}
                data-indice={i}
                data-ativa={i === ativa || undefined}
                onPointerMove={() => !o.desabilitada && ativa !== i && setAtiva(i)}
                onClick={() => escolher(i)}
                className={cn(
                  'flex min-h-11 cursor-pointer items-center gap-2 rounded-md py-2 pr-3 pl-2 select-none lg:min-h-9',
                  'data-[ativa]:bg-surface-2',
                  marcada ? 'font-medium text-fg' : 'text-fg-2',
                  o.desabilitada && 'cursor-not-allowed opacity-50',
                  placeholder !== undefined && o.valor === '' && !marcada && 'text-fg-3',
                )}
              >
                <Check className={cn('size-4 shrink-0 text-primary-text', !marcada && 'invisible')} aria-hidden="true" />
                <span className="min-w-0 break-words">{o.rotulo}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
