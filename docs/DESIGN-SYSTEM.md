# Design system do NonatoFin

Identidade: **grafite + azul**. Sóbrio, preciso e denso, como um produto financeiro SaaS. A hierarquia vem de **fundo, borda, espaço e tipografia**, não de sombras, gradientes ou cartões grandes. Os temas claro e escuro usam **os mesmos tokens** (só os valores mudam).

> **Regra de ouro:** componentes usam somente tokens (`bg-surface`, `text-fg-2`, `border-border`, `bg-primary`, `text-meta`, `rounded-md`...). **Nunca** escreva cores hexadecimais nem tamanhos arbitrários (`text-[13px]`) em componentes. Tudo está em `src/app/globals.css`. Exceções conscientes: o símbolo do logo (SVG da marca), `themeColor`/`manifest` e as marcas dos gráficos.

## Profundidade (do fundo para a frente)

```
bg  →  sidebar  →  surface (cards, listas, tabelas)  →  surface-elevated (menus, popovers, modais, toasts)
                                    input (campos)       overlay (fundo dos modais)
```
No escuro, cada camada é um pouco mais clara que a de trás (nada de preto puro em tudo); no claro, a página é cinza-claro e as superfícies são brancas.

## Cores (tokens)

| Papel | Token / classe | Claro | Escuro |
|---|---|---|---|
| Fundo principal | `--bg` · `bg-bg` | `#F6F7F9` | `#0A0C10` |
| Fundo secundário (faixas, cabeçalho de tabela) | `--bg-subtle` · `bg-bg-subtle` | `#EEF0F3` | `#0E1116` |
| Sidebar | `--sidebar` · `bg-sidebar` | `#F1F2F5` | `#0D1016` |
| Surface (cards, listas) | `--surface` · `bg-surface` | `#FFFFFF` | `#11151C` |
| Surface 2 (hover, preenchimento) | `--surface-2` | `#F2F4F7` | `#171C25` |
| Surface 3 (esqueleto, ativo em segmentado) | `--surface-3` | `#E9ECF1` | `#1E2430` |
| Surface elevada (menus, modais, toasts) | `--surface-elevated` | `#FFFFFF` | `#161B23` |
| Campo | `--input` · `bg-input` | `#FFFFFF` | `#0F131A` |
| Borda discreta | `--border-subtle` | `#ECEEF2` | `#181D26` |
| Borda | `--border` | `#E3E6EB` | `#20262F` |
| Borda forte (campos, botão secundário) | `--border-strong` | `#CFD4DC` | `#2D3542` |
| Texto principal | `--fg` · `text-fg` | `#0B1220` | `#E7EAF0` |
| Texto secundário | `--fg-2` | `#475467` | `#A4ACB9` |
| Texto discreto (legendas) | `--fg-3` | `#5B6474` | `#8189A0` |
| Primária | `--primary` (+ `-hover`, `-fg`) | `#2563EB` | `#2563EB` |
| Texto/link azul | `--primary-text` | `#1D4ED8` | `#6EA8FE` |
| Destaque suave | `--primary-soft` (+ `-fg`) | `#EFF5FF` | azul 14% |
| Informação | `--info` (+ `-soft`, `-border`) | `#1D4ED8` | `#6EA8FE` |
| Sucesso | `--success` (+ `-soft`, `-border`) | `#067647` | `#47CD89` |
| Aviso | `--warning` (+ `-soft`, `-border`) | `#B54708` | `#FDB022` |
| Perigo | `--danger` (+ `-strong`, `-soft`, `-border`) | `#B42318` | `#F97066` |
| Foco | `--ring` · `outline-ring` | `#2563EB` | `#3B82F6` |
| Gráficos | `--chart-1/2/3`, `--chart-track` | azul · verde-água · vermelho | idem |

### Contraste (WCAG AA)
Verificado no E2E `tema.spec.ts` nos dois temas: `fg`, `fg-2`, `fg-3`, `primary-text`, `info`, `warning`, `danger` e `success` sobre `bg`, `sidebar`, `surface`, `surface-2`, `surface-elevated` e `bg-subtle` (conforme o par), e branco sobre o azul — todos **≥ 4,5:1**.

### Cores de status
Só quando têm significado, **sempre com ícone + texto** (`Selo`, `SeloStatus`): ✓ Pago (verde) · ◷ Pendente (azul) · ⚠ Atrasado (vermelho) · Previsto (âmbar) · Confirmado/Na fatura (neutro).

## Tipografia
Geist Sans (arquivos locais) e Geist Mono (código de barras). Hierarquia por **tamanho, peso e contraste**; `font-semibold` só em títulos e valores, `font-medium` em rótulos e navegação.

| Classe | Tamanho / altura | Uso |
|---|---|---|
| `text-title` | 24/32, 600, −1,5% | Título da página (`CabecalhoPagina`) |
| `text-display` | 32/36, 600, −2% | Valor em destaque (Hoje, saldo) |
| `text-2xl`/`text-xl` | 24 / 20, 600 | Valores em cards e indicadores |
| `text-lead` | 17/24 | Destaque em card, título de modal, campo de moeda |
| `text-body` | 15/22 | Texto de listas e cards |
| `text-sm` | 14/20 | Botões no desktop, navegação, rótulos de campo, títulos de seção |
| `text-meta` | 13/18 | Texto secundário, metadados |
| `text-caption` | 12/16 | Legendas, grupos da sidebar, barra inferior, selos |

- Valores monetários: classe `numeros` (algarismos tabulares) — alinham em colunas.
- Títulos de seção em **sentence case** (`TituloSecao`: 14px, `font-medium`, `text-fg-2`) — sem caixa alta via CSS.
- Campos com **16px** em qualquer tela (evita o zoom automático do Safari iOS).

## Espaçamento
Escala de 4px do Tailwind. Padrões:
- **Página:** `px-4` (celular) · `px-6` (≥ 640px) · `px-10` (≥ 1024px); topo `pt-5`/`pt-8`; largura máxima `max-w-6xl` (formulários e detalhes usam `max-w-2xl`/`max-w-3xl`).
- **Entre seções:** `gap-6`/`gap-8`; cabeçalho da página `mb-6`.
- **Cards/painéis:** `p-4` (`p-5` em destaque); listas com linhas `px-4 py-3` e `divide-y`.
- **Formulários:** `gap-4` entre campos; rótulo → campo `gap-1.5`.
- **Tabelas:** células `py-2.5`, `pl-3`; cabeçalho `bg-bg-subtle`.
- Medidas do shell: `--altura-barra-inferior` (56px), `--largura-sidebar` (240px), `--largura-sidebar-compacta` (68px).

## Raios e sombras
| Raio | Valor | Uso |
|---|---|---|
| `rounded-sm` | 6px | Selos, itens de menu, chips pequenos |
| `rounded-md` | 8px | Botões, campos, itens de navegação |
| `rounded-lg` | 12px | Cards, listas, tabelas, popovers |
| `rounded-xl` | 16px | Modais e sheets |

Sombras discretas: `shadow-xs` (botões, campos), `shadow-sm` (item ativo), `shadow-md` (FAB, dicas), `shadow-lg` (menus, modais, toasts). **Cards não têm sombra** — só borda.

## Ícones
Lucide React. Tamanhos: 16px em botões pequenos e selos (14px), **18px** em botões/navegação desktop, 20px na barra inferior e no FAB. Traço padrão; 2.1 no item ativo da navegação. Ícone sempre com função (e `aria-hidden` quando o texto já diz o que é).

## Movimento
Curto e discreto (150–220ms, curva `--ease-suave`): `animate-surgir` (menus, FAB), `animate-subir` (sheet no celular), `animate-esmaecer` (fundos), transições de cor em hover/ativo, largura da sidebar. `prefers-reduced-motion` desliga tudo.

## Componentes (`src/components/ui`)
| Componente | Notas |
|---|---|
| `Botao` / `LinkBotao` | `primario` (uma por tela), `secundario`, `fantasma`, `perigo`, `suave`; `sm` 36px, `md` 44px no celular / 40px no desktop, `lg` 48px; `carregando` + `textoCarregando` |
| `BotaoIcone` | Botão só com ícone (nome acessível obrigatório): 36px ou 44/40px |
| `BotaoFiltros` | "Filtros" com contador (Boletos, Transações) |
| `Campo`, `Entrada`, `AreaTexto`, `Seletor`, `CampoMoeda`, `CampoSaldo` | Fundo `input`, borda forte, foco com anel azul, erro com `role="alert"`; 44px (40px no desktop) |
| `Cartao`, `TituloSecao` | Superfície com borda; título de seção em sentence case |
| `CabecalhoPagina` | PageHeader: voltar (opcional), título, descrição curta, ações |
| `Selo`, `SeloStatus` | Badge com tons `neutro`/`info`/`sucesso`/`aviso`/`perigo`; status com ícone + texto |
| `Dialogo` | `<dialog>` nativo: foco preso, Esc e clique fora fecham; *bottom sheet* com alça no celular, centralizado ≥ 640px; `tamanho` sm/md/lg; `alerta` perigo/aviso = AlertDialog (`role="alertdialog"`, ícone) para exclusões e impedimentos |
| `MenuAcoes` | Menu de três pontos (WAI-ARIA *menu button*): setas, Home/End, Esc devolve o foco; posição fixa |
| `Dica` | Tooltip em CSS (hover e foco) — usado na sidebar recolhida |
| `Esqueleto` | Skeleton de carregamento |
| `Segmentado` | Grupo de rádios com visual de abas (tema, tipo, métrica) |
| `ChipsFiltro`, `CampoPesquisa`, `DetalhePeriodo`, `FiltrosAtivos`, `FiltroPeriodo` | Filtros de listas |
| `PainelMetricas`, `Metrica` | Métricas (MetricCard) em painel dividido; níveis `destaque`, `padrao`, `compacta`; `tom` perigo/saldo; `testId` no valor |
| `Valor` | MoneyDisplay: `sinal` saldo (padrão, "− R$" nos negativos) / sempre ("+ R$", "− R$") / nunca; `tom` semântico; algarismos tabulares |
| `Tabela`, `CabecalhoTabela`, `CorpoTabela`, `LinhaTabela`, `Th`, `Td` | Tabela financeira densa (desktop): cabeçalho em `bg-subtle`, divisórias sutis, números à direita |
| `ListaPainel`, `LinhaLista`, `IconeLista` | Lista em painel (celular e listas simples): ícone · título/descrição · valor, linhas ≥ 56px |
| `CabecalhoSecao` | SectionHeader: título + detalhe/link/ação |
| `PainelFiltros` | "Mais filtros": popover ancorado (≥ 640px) ou sheet (celular); Esc, clique fora, foco |
| `BarraFiltros`, `SeletorFiltro`, `CampoFiltro` | Barra de filtros (pesquisa + controles compactos que se destacam quando aplicados) e campos do painel |
| `PainelFormulario`, `SecaoFormulario`, `CampoMarcacao`, `Aviso` | Formulários em seções; checkbox estilizado (input real); aviso informativo/atenção |
| `EstadoVazio`, `ListaDetalhes`, `LinkVoltar`, `Valor`, `Spinner`, `BarraAcoesFormulario`, `BotaoConfirmar` | Utilitários |

Estados: hover (cor/borda), foco visível (contorno azul 2px), ativo (`scale-[0.98]`), carregando (spinner + texto), desabilitado (50%, sem clique).

## Botões e campos
- **Hierarquia:** uma ação `primario` por tela (ou por diálogo); demais ações `secundario`; ações discretas `fantasma`; exclusão `perigo`. Botões só com ícone usam `BotaoIcone` (nome acessível obrigatório).
- **Estados:** hover (cor/borda), foco (contorno azul 2px), ativo (`scale-[0.98]`), carregando (spinner + texto, desabilitado — impede duplo clique), desabilitado (50%).
- **Campos:** rótulo sempre visível (placeholder não substitui rótulo), dica abaixo quando ajuda, erro abaixo com `role="alert"` ligado por `aria-describedby` e borda vermelha. 44px no celular, 40px no desktop, texto 16px. Datas com o seletor nativo; valores com `CampoMoeda` (máscara de banco, centavos).

## Ações rápidas (FAB)
- Celular: o **+** central da barra inferior abre um *speed dial* acima dele (fundo escurecido): **Despesa** (vermelho, seta para cima → Conta a pagar / Compra no cartão, com "Voltar") e **Entrada** (verde, seta para baixo → diálogo de entrada). O + vira × no mesmo lugar.
- Desktop: botão "Novo lançamento" no topo da sidebar abre as mesmas opções em menu suspenso (ao lado do botão quando a sidebar está recolhida).
- Esc, clique fora e o × fecham; o foco vai para a primeira opção; animação curta (desligada com movimento reduzido).

## Padrões de UX
- **Obrigação × caixa:** verde/vermelho só para dinheiro que já entrou/saiu; o que ainda é obrigação ou previsão aparece neutro e com status em texto.
- **Filtros:** pesquisa + controles compactos; filtros extras no painel (popover no desktop, sheet no celular); tudo na URL; filtros ativos como etiquetas removíveis + "Limpar filtros"; estado vazio diz se a lista está vazia por causa dos filtros.
- **Confirmações:** só para ações destrutivas ou irreversíveis, explicando o impacto ("… será excluído permanentemente"); impedimentos (ex.: categoria em uso) explicam o motivo antes da tentativa.
- **Retorno:** toast curto no passado ("Pagamento registrado."); erros humanos, sem detalhes internos; carregamento com skeleton da tela ou spinner no próprio botão.
- **Tarefas do dia a dia** sempre a um toque: Hoje (copiar código, marcar como pago), + (despesa/entrada), Transações, Fechar o dia.

## Navegação (shell)
- **Desktop (≥ 1024px): sidebar** (`components/layout/menu-lateral.tsx`), sem topbar. Topo: marca e recolher; empresa (seletor global); **Novo lançamento** (ações rápidas). Áreas em grupos — **Principal** (Hoje, Transações, Boletos, Contas, Fechar o dia), **Gestão** (Dashboard, Cartões, Meses, Fornecedores, Histórico), **Sistema** (Configurações). Rodapé: conta, tema, sair. Item ativo: fundo de superfície, texto forte, ícone azul e indicador lateral; `aria-current="page"`.
- **Sidebar recolhível:** só ícones, com `Dica` no hover/foco; nomes continuam acessíveis. O estado fica no cookie `nonatofin-sidebar`, lido no servidor (abre já no estado certo, sem piscar).
- **Celular/tablet (< 1024px):** cabeçalho (marca, empresa, tema) e **barra inferior**: Hoje · Transações · **+** (ações rápidas: Despesa/Entrada) · Dashboard · Mais. Item ativo com pílula atrás do ícone e texto mais forte. Respeita `env(safe-area-inset-*)`.
- **Menu "Mais":** sheet com os mesmos grupos da sidebar (sem o que já está na barra), itens de 48px, conta e Sair no fim.
- Estrutura em `components/layout/navegacao.ts` (`ITENS_NAVEGACAO`, `GRUPOS_NAVEGACAO`, `GRUPOS_MAIS`).

## Dinheiro, datas e status
- **Dinheiro:** sempre pelo `Valor` (ou `formatarMoeda`/`formatarMoedaComSinal`/`formatarMoedaSaldo`). Saldos: negativo com "−" e, quando importa, em vermelho (`tom="negativo-perigo"`). Movimentos: "+ R$" / "− R$". Verde/vermelho só para dinheiro que efetivamente entrou/saiu.
- **Datas:** `DD/MM/AAAA` (`formatarData`); agrupamentos por dia com "Hoje — …", "Amanhã — …", "Qui, 24/09/2026" (`rotuloDia`); meses "Outubro/2026"; instantes "24/09/2026 14:30".
- **Status:** `Selo` com ícone + texto, mesmos tons em todo o app: Pago (sucesso), Pendente (info), Atrasado (perigo), Previsto (aviso), Confirmado / Na fatura / Inativo / Em uso (neutro).
- **Feedback (toasts):** frases no passado, com ponto: "Pagamento registrado.", "Entrada adicionada.", "Transferência concluída.", "Categoria atualizada.", "Boleto excluído.".

## Tabelas e listas
No celular, **listas em vez de tabelas**. Transações usa lista agrupada por dia até 1279px e tabela densa a partir de 1280px (`xl`), com ações no `MenuAcoes`. A tabela do gráfico mensal fica em "Ver tabela" com rolagem própria.

## Gráficos
Leves, em HTML/CSS (sem biblioteca), com tokens `chart-*`. Paleta categórica validada para daltonismo; legenda para 2+ séries; valores sempre disponíveis em texto.

## Breakpoints
| Largura | Layout |
|---|---|
| < 640px (`sm`) | 1 coluna, barra inferior, botões largura total, modais *bottom sheet* |
| 640–1023px | Barra inferior, modais centralizados |
| ≥ 1024px (`lg`) | Sidebar (recolhível), controles de 40px |
| ≥ 1280px (`xl`) | Tabela de Transações |

Nada depende de hover. Alvos de toque ≥ 44px no celular. Sem rolagem horizontal (testado em 375, 390, 430, 768 e 1440px).

## Acessibilidade
Labels em todos os campos, `aria-describedby` para dicas/erros, foco visível, teclado em menus e diálogos, `aria-current` e `aria-expanded` na navegação, landmarks (`nav`, `main`, `aside`), status com texto, contraste AA, `prefers-reduced-motion`, `lang="pt-BR"`.

## Como alterar a identidade
- **Cor principal:** `--primary`, `--primary-hover`, `--primary-text`, `--primary-soft(-fg)`, `--ring`, `--info` e `--chart-1` nos dois temas (`globals.css`). Rode `npm run test:e2e -- tema` (contraste).
- **Fundos:** `--bg`, `--bg-subtle`, `--sidebar`, `--surface*`, `--input`, `--border*`. Atualize também `COR_BARRA` (`provedores.tsx`), `themeColor` (`app/layout.tsx`) e `manifest.ts` se mudar `--bg`.
- **Fonte:** veja [MANUTENCAO.md](MANUTENCAO.md#alterar-a-tipografia).
- **Logo/ícones:** `components/layout/logo.tsx` e `scripts/gerar-icones.mjs` (`npm run icones`).
