# Arquitetura do NonatoFin

## Visão geral

O NonatoFin é uma aplicação **Next.js 16 (App Router) + TypeScript** hospedada na Vercel, com **Supabase** (Postgres + Auth) como banco de dados e autenticação.

```
Navegador (celular/PC)
   │  HTML/RSC + Server Actions (cookies httpOnly da sessão)
   ▼
Next.js na Vercel ── proxy.ts (renova sessão, protege rotas)
   │  Server Components (leitura)  ·  Server Actions (escrita)  ·  /api/exportar
   │  cliente Supabase COM a sessão do usuário → RLS sempre aplicada
   ▼
Supabase: Auth (GoTrue) + PostgREST + Postgres (RLS, constraints, funções)
```

**Decisão central:** o navegador **nunca fala direto com o Supabase**. Toda leitura acontece em Server Components e toda escrita em Server Actions. Consequências:

- nenhuma chave do Supabase vai para o JavaScript do navegador (nem a pública);
- a política de segurança de conteúdo (CSP) permite conexões só com a própria origem;
- a lógica de acesso fica em um único lugar (servidor + RLS).

## Tecnologias

| Camada | Tecnologia | Por quê |
|---|---|---|
| Framework | Next.js 16 (App Router, Turbopack) | Server Components, Server Actions, deploy gratuito na Vercel |
| Linguagem | TypeScript (strict) | Tipos claros, menos erros |
| Estilo | Tailwind CSS v4 + tokens CSS | Design system centralizado em `globals.css` |
| Banco/Auth | Supabase (Postgres + Auth) | Gratuito, RLS nativa, migrations versionadas |
| Formulários | React Hook Form + Zod | Validação idêntica no navegador e no servidor |
| Tema | next-themes | Claro/Escuro/Sistema, sem flash |
| Fonte | Geist Sans (pacote `geist`, local) | Sem depender do Google Fonts |
| Notificações | sonner | Toasts leves e acessíveis |
| Ícones | lucide-react | Tree-shaking (só os usados) |
| Excel | fflate (~8 KB) + gerador próprio | Sem bibliotecas pesadas |
| Gráficos | SVG/CSS próprios | Nenhuma biblioteca de gráficos (leve) |
| Testes | Vitest, Testing Library, Playwright | Unitários, integração e E2E |

## Glossário do código

| Palavra no código | Significado | Na tela aparece como |
|---|---|---|
| **lançamento** (`lancamentos`, `Lancamento`) | Qualquer conta a pagar: boleto, fatura de cartão, empréstimo, despesa fixa ou variada | "Boletos" (lista, novo, detalhe) |
| **série** | Lançamentos de "vários meses" criados juntos (`serie_id`, parcela x/y) | "Parcela 2/5" |
| **fatura** | Lançamento criado automaticamente para um cartão em um mês (`cartao_id` + `fatura_mes`) | "Fatura Nubank PJ — Outubro/2026" |
| **compra / parcela** | Compra no cartão e cada parte dela, que cai numa fatura | "Compra", "3x" |
| **empresa** | CNPJ dono do lançamento; filtro global do topo | Seletor "Todas as empresas" |
| **competência** (`ChaveMes`) | Mês no formato `AAAA-MM` | "Outubro/2026" |

As **rotas e os textos** usam a palavra do usuário (`/boletos`, "Novo boleto"); o **modelo interno** usa "lançamento". Decisão registrada em [DECISOES.md](DECISOES.md).

## Camadas (e quem pode usar quem)

```
app/ (telas e rotas)
  │ usa
  ▼
features/<funcionalidade>/   consultas.ts (ler) · acoes.ts (gravar) · esquemas.ts (validar) · componentes/
  │ usa
  ▼
components/ui · components/graficos     (visual genérico, sem dados)
lib/ (infraestrutura)                    supabase, auth, acoes, validacao, parametros, utils
lib/domain/ (REGRAS DE NEGÓCIO PURAS)    sem React, sem Next, sem Supabase — 100% testável
```

Essas regras são **verificadas pelo lint** (`eslint.config.mjs`, seção "camadas"). `npm run lint` falha se:
- `lib/domain` importar React, Next, Supabase ou qualquer coisa fora de `lib/domain` e `lib/config`;
- `lib` importar `features`, `app` ou `components`;
- `components/ui` ou `components/graficos` importar `features`, `app` ou acesso a dados;
- uma tela (`app`) ou componente chamar `supabase.from(...)`/`supabase.rpc(...)` direto — isso só existe em `features/*/consultas.ts` e `acoes.ts`.

Entre funcionalidades: `features/lancamentos` é o modelo central (tipos, mapeadores, colunas); outras funcionalidades podem usá-lo. O contrário não acontece.

## Estrutura de pastas

```
nonatofin/
├─ docs/                      Documentação (para alterar o app, comece por MANUTENCAO.md)
├─ scripts/
│  ├─ criar-usuario.ts        Cria/autoriza o usuário (roda só no seu PC)
│  ├─ gerar-tipos-banco.mjs   npm run db:tipos — gera os tipos TS a partir do banco
│  ├─ dados-exemplo.sql       Dados fictícios para desenvolvimento
│  ├─ gerar-icones.mjs        Gera os ícones do PWA
│  └─ supabase-local/         Supabase local SEM Docker (testes em Linux)
├─ supabase/
│  ├─ config.toml             Config do Supabase CLI (cadastro público desligado)
│  └─ migrations/             Migrations SQL versionadas (a verdade sobre o banco)
├─ src/
│  ├─ proxy.ts                Proxy (antigo middleware): renova sessão e protege rotas
│  ├─ app/                    Rotas (App Router) — só montam a tela
│  │  ├─ layout.tsx           Layout raiz: fonte, tema, metadados, PWA
│  │  ├─ globals.css          DESIGN TOKENS (cores, raios, sombras, fonte)
│  │  ├─ login/               Única rota pública
│  │  ├─ conferir-saldos/     Conferência diária dos saldos (fora do grupo (app), sem menu)
│  │  ├─ api/exportar/        GET CSV/XLSX
│  │  └─ (app)/               Rotas autenticadas (layout com menu e seletor de empresa)
│  │     ├─ page.tsx          Hoje
│  │     ├─ dashboard/        Indicadores e gráficos
│  │     ├─ boletos/          Lista, novo, [id] (detalhe), [id]/editar — lançamentos
│  │     ├─ contas/           Contas bancárias (saldos), nova, [id] (extrato e previsão), [id]/editar
│  │     ├─ fechar-dia/       Texto do fechamento do dia (WhatsApp)
│  │     ├─ cartoes/          Cartões, [id], compras/nova, compras/[id]/editar
│  │     ├─ meses/            Contas por mês e [mes]
│  │     ├─ fornecedores/     Lista/comparativo e [id]
│  │     ├─ historico/        Pagamentos realizados
│  │     └─ configuracoes/    Tema, exportação, conta; empresas/ e categorias/
│  ├─ features/               Funcionalidades (uma pasta por assunto)
│  │  ├─ lancamentos/         Modelo central: consultas, acoes, esquemas, mapeadores, serie, componentes/
│  │  ├─ contas/              Contas bancárias, saldo, entradas, transferências, conferências
│  │  ├─ fechamento/          Dados e tela do "Fechar o dia"
│  │  ├─ cartoes/             Cartões, compras parceladas, faturas
│  │  ├─ empresas/            Empresas, categorias, empresa selecionada (cookie), seletor do topo
│  │  ├─ fornecedores/        Fornecedores
│  │  ├─ dashboard/dados.ts   Carregamento único dos dados de relatório
│  │  ├─ historico/           Filtros do histórico
│  │  ├─ exportacao/          csv.ts, xlsx.ts, linhas.ts, botões
│  │  └─ auth/acoes.ts        Login/logout
│  ├─ components/
│  │  ├─ ui/                  Design system: Botao, Campo, CampoMoeda, CampoSaldo, Cartao, Dialogo,
│  │  │                       Segmentado, BarraAcoesFormulario, BotaoConfirmar, ListaDetalhes, LinkVoltar…
│  │  ├─ graficos/            Gráficos leves em SVG/CSS (mensal, comparativos, status)
│  │  ├─ layout/              Menu lateral, barra inferior, cabeçalho, navegação, tema
│  │  └─ providers/           Tema + notificações
│  └─ lib/
│     ├─ config.ts            Nome, versão, fuso, LIMITES (sem números mágicos)
│     ├─ domain/              REGRAS DE NEGÓCIO PURAS
│     │  ├─ datas.ts          Datas sem fuso, soma de meses preservando o dia
│     │  ├─ dinheiro.ts       Centavos, formatação e máscara pt-BR
│     │  ├─ recorrencia.ts    Séries (vários meses)
│     │  ├─ status.ts         Pendente / Pago / Atrasado (+ conversão do banco)
│     │  ├─ filtros.ts        Filtros da lista (URL ↔ filtros → critério de busca)
│     │  ├─ indicadores.ts    Cálculos do dashboard, fornecedores, meses, grupos
│     │  ├─ saldos.ts         Previsão de saldo, cobertura, conta padrão, agrupamento
│     │  ├─ dias-uteis.ts     Feriados nacionais (Páscoa, Carnaval…) e próximo dia útil
│     │  ├─ fechamento.ts     Texto do "Fechar o dia" e saldo após pagar
│     │  ├─ cartoes.ts        Fechamento, fatura da compra, divisão em parcelas
│     │  ├─ cnpj.ts           CNPJ numérico e alfanumérico
│     │  ├─ codigo-barras.ts  Código de barras / linha digitável
│     │  ├─ fornecedores.ts   Normalização de nomes
│     │  └─ tipos.ts          Tipos de domínio (Lancamento, Fornecedor, Cartao…)
│     ├─ supabase/
│     │  ├─ database.types.ts GERADO pelo `npm run db:tipos` — não edite
│     │  ├─ tipos-banco.ts    Ajustes dos tipos gerados + atalhos (LinhaLancamento…)
│     │  ├─ server.ts         Cliente com a sessão do usuário (só no servidor)
│     │  ├─ consultas.ts      ErroConsulta, falharConsulta, paginação
│     │  ├─ embutidos.ts      Relacionamentos trazidos junto (primeiroEmbutido)
│     │  ├─ sessao-proxy.ts   Renovação da sessão no proxy
│     │  └─ env.ts            Variáveis de ambiente validadas
│     ├─ auth/                exigirUsuario(), destinoSeguro()
│     ├─ acoes/               resultado.ts (sucesso/falha), erros.ts (mensagens), revalidar.ts
│     ├─ validacao.ts         ehUuid, esquemaId, campoSelecao, textoOuNulo
│     ├─ parametros.ts        idDaRota, idDaBusca, textoDaBusca (URL segura)
│     └─ utils/               cn(), área de transferência
└─ tests/
   ├─ unit/                   Vitest (regras, exportação, componentes)
   ├─ integracao/             Vitest contra Postgres/Supabase reais (RLS, séries, cartões, tipos)
   └─ e2e/                    Playwright (fluxos, temas, segurança, responsivo)
```

## Fluxo de dados

### Leitura (ex.: tela Hoje)
1. `proxy.ts` valida/renova a sessão; sem sessão → `/login`.
2. `app/(app)/layout.tsx` chama `exigirUsuario()` (defesa em profundidade) e carrega as empresas.
3. A página lê parâmetros com `lib/parametros.ts` e chama `features/lancamentos/consultas.ts` com o cliente do usuário (e a empresa selecionada).
4. O Postgres aplica a RLS e devolve só os dados do usuário.
5. `mapeadores.ts` converte para os tipos de domínio; `lib/domain` calcula status e totais.
6. Erro de leitura → `falharConsulta` registra no log e lança `ErroConsulta` com mensagem amigável, mostrada por `app/(app)/error.tsx`.

### Conferência diária
`app/(app)/layout.tsx` chama `contasAConferirHoje()` (uma consulta por requisição, via React `cache`). Se alguma conta ativa não foi conferida hoje, redireciona para `/conferir-saldos` — que fica **fora** do grupo `(app)` para não cair no próprio bloqueio. Depois de confirmar, volta para `/`.

### Escrita (ex.: marcar como pago)
1. Componente cliente (`BotaoPagamento`) chama a Server Action `definirPagamento`.
2. A action exige usuário, valida com Zod e grava (tabela ou função SQL), sempre com RLS.
3. Erros viram mensagens por `lib/acoes/erros.ts` (inclusive duplicidade e "em uso").
4. `revalidarTudo()` atualiza todas as telas; a action devolve `sucesso(...)`/`falha(...)` e a tela mostra um toast.

### Relatórios (dashboard, fornecedores, meses)
`features/dashboard/dados.ts` carrega uma única vez por requisição (React `cache`) uma projeção enxuta dos lançamentos da empresa selecionada. As funções puras de `lib/domain/indicadores.ts` fazem os cálculos. Para uso pessoal (milhares de lançamentos) é rápido e mantém a regra testável; se o volume crescer muito, a evolução natural é mover as agregações para views SQL.

## Onde fica cada funcionalidade

| Funcionalidade | Arquivos principais |
|---|---|
| Login/logout | `app/login/*`, `features/auth/acoes.ts`, `lib/supabase/sessao-proxy.ts`, `proxy.ts` |
| Tela Hoje | `app/(app)/page.tsx`, `consultas.listarLancamentosTelaInicial` |
| Cadastro/edição | `features/lancamentos/componentes/formulario-lancamento.tsx` (+ `previa-serie.tsx`), `acoes.criarLancamento/atualizarLancamento` |
| Detalhe | `app/(app)/boletos/[id]/page.tsx`, `lista-serie.tsx`, `features/cartoes/componentes/compras-da-fatura.tsx` |
| Séries | `lib/domain/recorrencia.ts`, funções SQL `atualizar_lancamento`/`excluir_lancamento` |
| Copiar código | `componentes/botao-copiar-codigo.tsx`, `lib/utils/area-transferencia.ts` |
| Pagamento | `componentes/botao-pagamento.tsx`, função SQL `definir_pagamento` |
| Filtros/pesquisa | `lib/domain/filtros.ts`, `componentes/filtros-lancamentos.tsx`, `consultas.opcoesDosFiltros/consultaFiltrada` (lista e exportação) |
| Dashboard | `app/(app)/dashboard/page.tsx`, `lib/domain/indicadores.ts`, `components/graficos/*` |
| Fornecedores | `app/(app)/fornecedores/*`, `features/fornecedores/*` |
| Meses | `app/(app)/meses/*` |
| Histórico | `app/(app)/historico/page.tsx`, `consultas.listarHistorico` |
| Exportação | `app/api/exportar/route.ts`, `features/exportacao/*` |
| Empresas e categorias | `app/(app)/configuracoes/empresas`, `…/categorias`, `features/empresas/*`, `lib/domain/cnpj.ts` |
| Filtro por empresa | `features/empresas/consultas.obterContextoEmpresas` (cookie `nonatofin-empresa`), `componentes/seletor-empresa.tsx`; cada consulta recebe `empresaId` |
| Cartões e faturas | `app/(app)/cartoes/*`, `features/cartoes/*`, `lib/domain/cartoes.ts`, gatilhos SQL `parcelas_*` e `sincronizar_fatura` |
| Contas e saldo | `app/(app)/contas/*`, `features/contas/*`, `lib/domain/saldos.ts`, funções SQL `saldos_contas`/`conferir_saldo`/`transferir_entre_contas` |
| Fechar o dia | `app/(app)/fechar-dia/page.tsx`, `features/fechamento/*`, `lib/domain/fechamento.ts` (texto), `lib/domain/dias-uteis.ts`, `FERIADOS_LOCAIS` em `lib/config.ts` |
| Conta ao pagar | `features/lancamentos/componentes/conta-do-pagamento.tsx` (diálogo único no layout) e `botao-pagamento.tsx` |
| Tema | `components/providers/provedores.tsx`, `components/layout/seletor-tema.tsx`, `globals.css` |
| PWA | `app/manifest.ts`, `public/icons/*`, `scripts/gerar-icones.mjs` |

## Autenticação

Supabase Auth com e-mail e senha. Não existe cadastro público (desligado no Supabase e sem tela). O usuário é criado pelo script `npm run usuario:criar`, que também o inclui na tabela `usuarios_autorizados`. Detalhes em [SEGURANCA.md](SEGURANCA.md).
