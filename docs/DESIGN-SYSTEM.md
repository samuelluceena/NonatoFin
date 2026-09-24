# Design system do NonatoFin

Identidade: **preto/grafite + azul**. Profissional, financeira, limpa e minimalista. Os temas claro e escuro usam **os mesmos tokens** (só os valores mudam), então parecem o mesmo produto.

> **Regra de ouro:** componentes usam somente tokens (classes como `bg-surface`, `text-fg-2`, `border-border`, `bg-primary`). **Nunca** escreva cores hexadecimais em componentes. Tudo está em `src/app/globals.css`.

## Cores (tokens)

| Token (CSS) | Classe Tailwind | Claro | Escuro | Uso |
|---|---|---|---|---|
| `--bg` | `bg-bg` | `#F5F7FA` | `#0B0F14` | Fundo da página |
| `--surface` | `bg-surface` | `#FFFFFF` | `#111827` | Cards, modais, menus |
| `--surface-2` | `bg-surface-2` | `#F1F4F8` | `#172033` | Superfície elevada, hover, trilhas |
| `--surface-3` | `bg-surface-3` | `#E8EDF3` | `#1E293D` | Skeleton, item ativo no segmentado (escuro) |
| `--border` | `border-border` | `#E2E7EE` | `#1F2A3C` | Bordas discretas |
| `--border-strong` | `border-border-strong` | `#CBD3DE` | `#2D3A52` | Inputs, botões secundários |
| `--fg` | `text-fg` | `#0F172A` | `#E8ECF2` | Texto principal |
| `--fg-2` | `text-fg-2` | `#475569` | `#AAB3C1` | Texto secundário |
| `--fg-3` | `text-fg-3` | `#5F6B7D` | `#8A95A6` | Texto terciário (legendas) |
| `--primary` | `bg-primary` | `#2563EB` | `#2563EB` | Botão principal, chip ativo |
| `--primary-hover` | `bg-primary-hover` | `#1D4ED8` | `#3B82F6` | Hover do principal |
| `--primary-fg` | `text-primary-fg` | `#FFFFFF` | `#FFFFFF` | Texto sobre o azul |
| `--primary-text` | `text-primary-text` | `#1D4ED8` | `#60A5FA` | Links e textos azuis |
| `--primary-soft` | `bg-primary-soft` | `#EFF6FF` | azul 16% | Destaques suaves, item de menu ativo |
| `--ring` | `outline-ring` | `#2563EB` | `#3B82F6` | Foco visível |
| `--success` (+ `-soft`, `-border`) | `text-success` | `#15803D` | `#4ADE80` | Pago |
| `--warning` (+ `-soft`, `-border`) | `text-warning` | `#B45309` | `#FBBF24` | Aviso |
| `--danger` (+ `-strong`, `-soft`, `-border`) | `text-danger` | `#B91C1C` | `#F87171` | Atrasado, erro, excluir |
| `--chart-1` | `bg-chart-1` | `#2563EB` | `#3B82F6` | Gráficos: em aberto / série única |
| `--chart-2` | `bg-chart-2` | `#1BAF7A` | `#199E70` | Gráficos: pago |
| `--chart-3` | `bg-chart-3` | `#DC2626` | `#EF4444` | Gráficos: atrasado (sempre com ícone+rótulo) |
| `--chart-track` | `bg-chart-track` | `#EDF1F6` | `#1A2436` | Trilha das barras |

Escala da marca (Blue): `--blue-50/100/300/400/500/600/700`.

### Contraste (WCAG AA)
Verificado automaticamente no teste E2E `tema.spec.ts` nos dois temas: `fg`, `fg-2`, `fg-3`, `primary-text`, `danger`, `success` sobre `surface`/`bg` e texto branco sobre o azul — todos **≥ 4,5:1**. O tema escuro evita preto absoluto em grandes áreas e branco puro no texto.

### Cores de status
Usadas só quando têm significado. **Sempre com ícone + texto** (`SeloStatus`): ✓ Pago (verde) · ◷ Pendente (azul) · ⚠ Atrasado (vermelho).

## Temas
- **Claro, Escuro e Sistema** (`next-themes`, `attribute="class"`, classe `.dark` no `<html>`).
- Preferência salva no `localStorage` (`nonatofin-tema`) — persiste ao fechar/abrir.
- **Sem flash:** o next-themes injeta um script bloqueante que aplica a classe antes da primeira pintura (testado).
- "Sistema" segue `prefers-color-scheme` e muda em tempo real.
- A `<meta name="theme-color">` (barra do navegador/PWA) acompanha o tema efetivo.
- Onde trocar: Configurações → Aparência, ou o botão de tema no cabeçalho (alterna Claro → Escuro → Sistema).

## Tipografia
- **Geist Sans** (pacote `geist`, arquivos locais — sem Google Fonts). Fallbacks: `Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif`. Mono: **Geist Mono** (código de barras).
- Hierarquia:

| Uso | Tamanho / peso |
|---|---|
| Título da página (h1) | 24px (28px ≥ 640px), 600 |
| Valor destaque (tela Hoje) | 32px, 600 |
| Valor no card | 20–26px, 600, `numeros` (tabular) |
| Nome do fornecedor | 16–17px, 600 |
| Texto | 15–16px, 400 |
| Secundário/legendas | 13–14px |
| Rótulos de seção | 12–13px, 600, caixa alta |
| Botões | 15px (md) / 16px (lg), 500 |

- Valores monetários usam a classe utilitária `numeros` (algarismos tabulares).
- Inputs têm **16px** no celular (evita zoom automático do Safari iOS).

## Espaçamento, raios e sombras
- Escala de espaçamento do Tailwind (4px). Padrões: página `px-4` (celular) / `px-6`–`px-10`; cards `p-4`/`p-5`; gap entre cards `gap-3`; entre seções `gap-6`/`gap-8`.
- Raios: `rounded-sm` 8px (chips/badges), `rounded-md` 12px (botões/inputs), `rounded-lg` 16px (cards), `rounded-xl` 20px (modais).
- Sombras: `shadow-sm` (cards), `shadow-md` (botão principal, toasts), `shadow-lg` (modais). No escuro as sombras são mais discretas.

## Componentes (`src/components/ui`)
| Componente | Notas |
|---|---|
| `Botao` / `LinkBotao` | Variantes `primario`, `secundario`, `fantasma`, `perigo`, `suave`; tamanhos `sm` (36px), `md` (44px), `lg` (52px); `carregando` + `textoCarregando` ("Salvando...") e desabilitado durante a ação |
| `Campo`, `Entrada`, `AreaTexto`, `Seletor` | Label ligada, dica, erro com `role="alert"` e `aria-invalid`; altura 48px |
| `CampoMoeda` | Máscara de banco, teclado numérico |
| `Cartao`, `TituloSecao` | Card padrão |
| `SeloStatus` | Ícone + texto |
| `Dialogo` | `<dialog>` nativo: foco preso, Esc fecha; *bottom sheet* no celular, centralizado ≥ 640px |
| `Segmentado` | Grupo de rádios (tema, tipo, métrica) |
| `ChipsFiltro`, `FiltroPeriodo` | Filtros roláveis e período por formulário GET |
| `Indicador` | Card de KPI (clicável) |
| `EstadoVazio`, `CabecalhoPagina`, `Valor`, `Spinner` | Utilitários de layout |

Estados: hover (`hover:`), foco visível (contorno azul 2px), toque (`active:scale-[0.98]`), carregando (spinner + texto), desabilitado (opacidade 55%, sem clique).

## Tabelas e listas
No celular, **cards em vez de tabelas**. Listas longas usam linhas com `divide-y`. A única tabela (dados do gráfico mensal) fica dentro de "Ver tabela" com rolagem própria.

## Gráficos
- Leves, feitos com HTML/CSS (sem biblioteca). Respeitam os temas via tokens `chart-*`.
- Paleta categórica **validada para daltonismo** (azul + verde-água; ΔE > 20). Marcas finas, cantos de 4px na ponta, 2px de espaço entre segmentos empilhados.
- Legenda sempre visível para 2+ séries; valores sempre disponíveis em texto (tooltip no hover/foco, rótulos diretos, "Ver tabela").
- Gráficos: valores por mês (em aberto x pago), comparativo de fornecedores (métrica selecionável), pago x pendente x atrasado.

## Breakpoints e comportamento mobile
| Largura | Layout |
|---|---|
| < 640px (`sm`) | 1 coluna, barra inferior, botões largura total, modais *bottom sheet* |
| 640–1023px | 1–2 colunas, barra inferior, modais centralizados |
| ≥ 768px (`md`) | Cards em 2 colunas |
| ≥ 1024px (`lg`) | Menu lateral fixo, sem barra inferior |

- Barra inferior: Hoje · Boletos · **+** (novo) · Dashboard · Mais (Meses, Fornecedores, Histórico, Configurações, Sair).
- Respeita *safe areas* do iPhone (`env(safe-area-inset-*)`), `viewport-fit=cover`.
- Nada depende de hover. Alvos de toque ≥ 44px. Sem rolagem horizontal (testado em 375, 390, 430, 768 e 1440px).

## Acessibilidade
Labels em todos os campos, `aria-describedby` para dicas/erros, foco visível, navegação por teclado, `aria-current` na navegação, landmarks (`nav`, `main`, `aside`), status com texto, contraste AA, `prefers-reduced-motion` respeitado, `lang="pt-BR"`.

## Como alterar a identidade
- **Cor principal:** troque `--primary`, `--primary-hover`, `--primary-text`, `--primary-soft(-fg)`, `--ring` e `--chart-1` nos dois temas em `globals.css`. Rode `npm run test:e2e -- tema` (contraste).
- **Fundo escuro:** `--bg`, `--surface`, `--surface-2/3`, `--border(-strong)` em `.dark`.
- **Fonte:** veja [MANUTENCAO.md](MANUTENCAO.md#alterar-a-tipografia).
- **Logo/ícones:** `components/layout/logo.tsx` e `scripts/gerar-icones.mjs` (`npm run icones`).
