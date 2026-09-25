import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { Spinner } from './spinner';

/**
 * Hierarquia: `primario` = a ação principal da tela (uma só);
 * `secundario` = demais ações; `fantasma` = ações discretas;
 * `perigo` = excluir/ações destrutivas; `suave` = destaque leve (vazio, atalhos).
 */
export type VarianteBotao = 'primario' | 'secundario' | 'fantasma' | 'perigo' | 'suave';
export type TamanhoBotao = 'sm' | 'md' | 'lg';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap select-none ' +
  'transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.98] ' +
  'disabled:pointer-events-none disabled:opacity-50 aria-busy:cursor-progress ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
  '[&_svg]:shrink-0';

const VARIANTES: Record<VarianteBotao, string> = {
  primario: 'bg-primary text-primary-fg shadow-xs hover:bg-primary-hover',
  secundario: 'border border-border-strong bg-surface text-fg shadow-xs hover:border-fg-3/40 hover:bg-surface-2',
  fantasma: 'bg-transparent text-fg-2 hover:bg-surface-2 hover:text-fg',
  perigo: 'bg-danger-strong text-white shadow-xs hover:brightness-110',
  suave: 'bg-primary-soft text-primary-soft-fg hover:brightness-95 dark:hover:brightness-125',
};

/**
 * Alturas: sm 36px; md 44px no celular (toque) e 40px a partir de 1024px;
 * lg 48px. Ícones: 16px (sm) e 18px (md/lg).
 */
const TAMANHOS: Record<TamanhoBotao, string> = {
  sm: 'h-9 px-3 text-sm [&_svg]:size-4',
  md: 'h-11 px-4 text-body lg:h-10 lg:text-sm [&_svg]:size-4.5',
  lg: 'h-12 px-5 text-base [&_svg]:size-5',
};

export function classesBotao(variante: VarianteBotao = 'primario', tamanho: TamanhoBotao = 'md', extra?: string) {
  return cn(BASE, VARIANTES[variante], TAMANHOS[tamanho], extra);
}

interface PropsBotao extends ComponentProps<'button'> {
  variante?: VarianteBotao;
  tamanho?: TamanhoBotao;
  carregando?: boolean;
  textoCarregando?: string;
  icone?: ReactNode;
  larguraTotal?: boolean;
}

export function Botao({
  variante = 'primario',
  tamanho = 'md',
  carregando = false,
  textoCarregando,
  icone,
  larguraTotal,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: PropsBotao) {
  return (
    <button
      type={type}
      className={classesBotao(variante, tamanho, cn(larguraTotal && 'w-full', className))}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      {...props}
    >
      {carregando ? <Spinner /> : icone}
      {carregando && textoCarregando ? textoCarregando : children}
    </button>
  );
}

interface PropsLinkBotao extends ComponentProps<typeof Link> {
  variante?: VarianteBotao;
  tamanho?: TamanhoBotao;
  icone?: ReactNode;
  larguraTotal?: boolean;
}

export function LinkBotao({
  variante = 'primario',
  tamanho = 'md',
  icone,
  larguraTotal,
  className,
  children,
  ...props
}: PropsLinkBotao) {
  return (
    <Link className={classesBotao(variante, tamanho, cn(larguraTotal && 'w-full', className))} {...props}>
      {icone}
      {children}
    </Link>
  );
}

// -------------------------------------------------------------- IconButton --

const TAMANHOS_ICONE = {
  /** 36px */
  sm: 'size-9 [&_svg]:size-4',
  /** 44px no celular, 40px a partir de 1024px */
  md: 'size-11 lg:size-10 [&_svg]:size-4.5',
} as const;

export function classesBotaoIcone(tamanho: keyof typeof TAMANHOS_ICONE = 'md', extra?: string) {
  return cn(
    'grid shrink-0 place-items-center rounded-md text-fg-2 transition-colors duration-150 hover:bg-surface-2 hover:text-fg',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50',
    TAMANHOS_ICONE[tamanho],
    extra,
  );
}

interface PropsBotaoIcone extends Omit<ComponentProps<'button'>, 'aria-label'> {
  /** Obrigatório: botão só com ícone precisa de nome acessível. */
  rotulo: string;
  tamanho?: keyof typeof TAMANHOS_ICONE;
}

/** Botão só com ícone (fechar, tema, ações). O ícone vai como filho, com aria-hidden. */
export function BotaoIcone({ rotulo, tamanho = 'md', className, type = 'button', ...props }: PropsBotaoIcone) {
  return <button type={type} aria-label={rotulo} className={classesBotaoIcone(tamanho, className)} {...props} />;
}
