# Guia de manutenção e alterações

Este é o guia prático para mudar o NonatoFin com segurança. Leia uma vez a [ARQUITETURA.md](ARQUITETURA.md) (camadas, pastas e glossário) e o [DECISOES.md](DECISOES.md) (por que as coisas são como são).

> Este projeto usa **Next.js 16**. Algumas APIs mudaram em relação a versões antigas (ex.: `middleware.ts` virou `proxy.ts`; `params`/`searchParams` são Promises; o error boundary recebe `retry`). Em dúvida, consulte `node_modules/next/dist/docs/`.

## Os 5 comandos do dia a dia

| Comando | Quando | Tempo |
|---|---|---|
| `npm run verificar` | A cada mudança (lint + tipos + testes de regra) | ~25 s |
| `npm run test:integracao` | Mexeu em banco, consultas ou ações (precisa do Supabase local) | ~10 s |
| `npm run test:e2e:rapido` | Mexeu em telas (um celular, todos os fluxos; precisa de `npm run build`) | ~5 min |
| `npm run test:e2e` | Antes de publicar (5 tamanhos de tela) | ~26 min |
| `npm run db:tipos` | Depois de criar/alterar uma migration | ~10 s |

`npm run test:tudo` roda tudo em sequência. Detalhes em [TESTES.md](TESTES.md).

## Receita geral: qualquer mudança

1. **Regra de negócio primeiro.** Se existe uma regra (cálculo, data, valor, validação), ela vai em `src/lib/domain/` como função pura, com teste em `tests/unit/`. Nada de regra escondida em tela.
2. **Banco** (se precisar): nova migration → `npm run db:tipos` → `npm run typecheck` aponta o que ajustar.
3. **Funcionalidade:** em `src/features/<assunto>/`:
   - `consultas.ts` — leitura (`server-only`, sempre com o cliente do usuário);
   - `acoes.ts` — gravação (`'use server'`, sempre `exigirUsuario()` → validar com Zod → gravar → `revalidarTudo()` → `sucesso()`/`falha()`);
   - `esquemas.ts` — validação Zod (a mesma no navegador e no servidor);
   - `componentes/` — telas específicas do assunto.
4. **Tela:** `src/app/(app)/<rota>/page.tsx` só monta: lê parâmetros com `lib/parametros.ts`, chama consultas e renderiza componentes.
5. **Testes** em cada camada que você tocou + `npm run verificar`.
6. **Documentação:** regra nova → [REGRAS-DE-NEGOCIO.md](REGRAS-DE-NEGOCIO.md); tabela/função → [BANCO-DE-DADOS.md](BANCO-DE-DADOS.md); decisão de desenho → [DECISOES.md](DECISOES.md); versão → [CHANGELOG.md](CHANGELOG.md) e `package.json`.

## Checklist antes de dar a mudança por pronta

- [ ] `npm run verificar` passou (lint também confere as camadas)
- [ ] Regras novas estão em `lib/domain` e têm teste unitário
- [ ] Tabela nova tem RLS, policies, FK composta `(x_id, user_id)` e teste de acesso entre contas
- [ ] Tipos do banco gerados (`npm run db:tipos`) — o teste `tipos-banco` confere
- [ ] Nenhum texto de erro técnico chega à tela (use `mensagemDeErro`)
- [ ] Tela funciona em 375 px, sem rolagem horizontal, nos temas claro e escuro
- [ ] Docs e CHANGELOG atualizados

## Receitas prontas

### Adicionar um campo ao lançamento
Exemplo: `numero_documento`.
1. **Migration:** `alter table public.lancamentos add column numero_documento text check (char_length(numero_documento) <= 60);`
2. **Tipos:** `npm run db:tipos`.
3. **Domínio:** `src/lib/domain/tipos.ts` (`Lancamento`).
4. **Mapeador:** `src/features/lancamentos/mapeadores.ts` (`COLUNAS_LANCAMENTO` e `paraLancamento`).
5. **Validação:** `src/features/lancamentos/esquemas.ts` (`camposComuns`).
6. **Ações:** `src/features/lancamentos/acoes.ts` (insert em `criarLancamento`). Para edição, acrescente o parâmetro na função SQL `atualizar_lancamento` (nova migration com `drop function` + `create function`) e em `atualizarLancamento`. Se o parâmetro aceitar vazio, inclua-o em `ParametrosNulos` (`lib/supabase/tipos-banco.ts`).
7. **Formulário:** `componentes/formulario-lancamento.tsx` (um `<Campo>`); exibição no detalhe `app/(app)/boletos/[id]/page.tsx` (`<LinhaDetalhe>`).
8. **Exportação** (se desejar): `features/exportacao/linhas.ts`, `csv.ts`, `xlsx.ts`.
9. **Testes:** unitário do esquema/mapeador e caso na integração.

### Criar uma funcionalidade nova (ex.: contas bancárias)
1. `lib/domain/<assunto>.ts` + `tests/unit/<assunto>.test.ts` — as regras.
2. Migration com a tabela (modelo em "Alterar o banco" abaixo) → `npm run db:tipos`.
3. `features/<assunto>/` com `consultas.ts`, `acoes.ts`, `esquemas.ts`, `componentes/`.
4. Páginas em `app/(app)/<rota>/`; menu em `components/layout/navegacao.ts`.
5. `tests/integracao/<assunto>.test.ts` (RLS entre contas, restrições, regras SQL) e `tests/e2e/<assunto>.spec.ts` (fluxo principal).
6. Rotas novas em `tests/e2e/responsivo.spec.ts` (PAGINAS) e `seguranca.spec.ts` (rotas privadas).
7. Documentação (veja a receita geral).

### Adicionar um indicador ao dashboard
1. Campo em `IndicadoresDashboard` (`lib/domain/tipos.ts`).
2. Cálculo em `calcularIndicadores()` (`lib/domain/indicadores.ts`) + teste em `tests/unit/indicadores.test.ts` com o cenário conhecido.
3. Exiba com `<Metrica …/>` (dentro do `PainelMetricas` do nível certo) em `app/(app)/dashboard/page.tsx` (use `testId`).

### Adicionar um filtro (lista de Boletos)
Tudo passa por `FiltrosLista` (`lib/domain/filtros.ts`); a URL é lida por `lerFiltros()` e escrita por `parametrosDosFiltros()`.
- **Novo período rápido** (ex.: "Últimos 7 dias"): inclua em `PERIODOS_RAPIDOS` e trate em `faixaDoPeriodo()`. Pronto — aparece no seletor, nos testes de integração e na exportação.
- **Novo status**: inclua em `STATUS_FILTRO` e trate em `criterioDosFiltros()`.
- **Novo campo** (ex.: "com código de barras"):
  1. Campo em `FiltrosLista` + `FILTROS_PADRAO`, leitura em `lerFiltros()` (valide! valor inválido = ignorar) e escrita em `parametrosDosFiltros()`.
  2. Opção em `OpcoesListagem` + `opcoesDosFiltros()` e o `.eq/.is` em `consultaFiltrada()` (`features/lancamentos/consultas.ts`) — lista e exportação usam a mesma função.
  3. Tela: `DialogoMaisFiltros` e a etiqueta em `ativos` (`features/lancamentos/componentes/filtros-lancamentos.tsx`).
  4. Testes: ida e volta da URL em `tests/unit/filtros.test.ts`; consulta em `tests/integracao/consultas-dashboard.test.ts`.
- Links de outras telas para a lista: use `linkDaLista({ status: 'atrasados', … })`, nunca monte a URL à mão.

### Cadastrar um feriado da cidade (Fechar o dia)
Em `src/lib/config.ts`, `FERIADOS_LOCAIS`: `'MM-DD'` repete todo ano, `'AAAA-MM-DD'` vale só naquele ano. Ex.: `['03-19', '2026-12-31']`. Os nacionais já estão em `lib/domain/dias-uteis.ts`.

### Mudar o texto do "Fechar o dia"
Tudo em `montarTextoFechamento()` (`lib/domain/fechamento.ts`). O teste `tests/unit/fechamento.test.ts` tem o texto completo esperado — ajuste-o junto. Novos dados vêm de `carregarFechamento()` (`features/fechamento/consultas.ts`).

### Criar uma página
1. `src/app/(app)/nova-pagina/page.tsx` (o grupo `(app)` já exige login e aplica o layout).
2. Comece com `const { supabase } = await exigirUsuario();` e exporte `metadata = { title: '…' }`.
3. Parâmetros: `idDaRota`, `idDaBusca`, `textoDaBusca` (`lib/parametros.ts`) — nunca use a URL crua.
4. Menu: `components/layout/navegacao.ts` (`ITENS_NAVEGACAO`; no celular, `NAV_MAIS` ou a barra inferior).
5. Rota em `tests/e2e/responsivo.spec.ts` e em `seguranca.spec.ts`.

### Mensagens de erro
- Restrição `unique` nova → acrescente a mensagem em `MENSAGENS_DUPLICIDADE` (`lib/acoes/erros.ts`).
- Registro "em uso" (não pode excluir) → `mensagemDeErro(error, 'contexto', { emUso: 'Texto para o usuário' })`.
- Regra de negócio no SQL → `raise exception 'Mensagem para o usuário' using errcode = '22023'` (a mensagem chega à tela como está).

## Alterar o banco / criar migration
1. Arquivo novo em `supabase/migrations/` com timestamp maior que o último: `npx supabase migration new descricao_curta` (ou `AAAAMMDDHHMMSS_descricao.sql` à mão).
2. **Nunca edite migrations já aplicadas em produção** — crie outra. (Antes da primeira publicação, as migrations foram reorganizadas; depois de publicar, só migrations novas.)
3. Toda tabela nova: `enable row level security`, `revoke all … from anon`, policies com `user_id = (select auth.uid()) and (select public.usuario_autorizado())`, e `unique (id, user_id)` para servir de alvo às FKs compostas.
4. Funções: `security invoker`, `set search_path = ''`, `revoke … from public, anon`, `grant execute … to authenticated`. Funções chamadas por gatilhos também precisam de `grant` (o gatilho roda com as permissões de quem disparou).
5. `npm run supabase:local -- --reset` (ou `npx supabase db reset`) → `npm run db:tipos` → `npm run typecheck` → `npm run test:integracao`.
6. Produção: `npx supabase db push` **antes** de publicar o código que depende da mudança.
7. **Gerenciamento de dados:** se a migration mudar colunas de alguma das 9 tabelas do usuário, os backups antigos passam a ser recusados na restauração (a assinatura do esquema muda), mas continuam baixáveis em `.json`. Tabela nova do usuário precisa entrar em `nonatofin_interno.tabelas_backup()` (e, se for financeira, em `tabelas_financeiras()`) e em `apagar_dados`, na ordem certa das FKs.
8. No Windows, se `npm run db:tipos` falhar ao chamar o `npx`, rode o gerador direto: `npx supabase gen types typescript --local --schema public` e mantenha o formato e o cabeçalho do arquivo atual.

## Gerar os tipos do banco
- Com Docker (`npx supabase start`): `npm run db:tipos`.
- Projeto na nuvem (`npx supabase link` feito): `npm run db:tipos:nuvem`.
- Sem Docker (stack de testes `npm run supabase:local`): use o mesmo gerador direto do npm:
  ```bash
  mkdir -p /tmp/pgmeta && cd /tmp/pgmeta && npm i @supabase/postgres-meta
  PG_META_GENERATE_TYPES=typescript PG_META_GENERATE_TYPES_INCLUDED_SCHEMAS=public \
  PG_META_DB_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres \
  node node_modules/@supabase/postgres-meta/dist/server/server.js > tipos.ts
  ```
  e copie `tipos.ts` para `src/lib/supabase/database.types.ts`, mantendo o cabeçalho "ARQUIVO GERADO".

## Alterar o design
Tudo em `src/app/globals.css` (tokens) — veja [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md). Componentes nunca recebem hexadecimais nem tamanhos soltos. Antes de criar um componente visual, veja se já existe em `components/ui/`.

**Montando uma tela nova no padrão:** `CabecalhoPagina` (título, descrição, ações) → `BarraFiltros` + `PainelFiltros` (se houver filtros) → `CabecalhoSecao` por seção → conteúdo com `PainelMetricas`/`Metrica` (números), `ListaPainel`/`LinhaLista` (listas; padrão no celular) ou `Tabela` (desktop, a partir de 1280px) → `EstadoVazio` com ação. Formulários: `PainelFormulario` + `SecaoFormulario` + `Campo` + `BarraAcoesFormulario`. Dinheiro sempre com `Valor`; status com `Selo`/`SeloStatus`; exclusões com `Dialogo alerta="perigo"` (ou `BotaoConfirmar perigo`). Mensagens de retorno no passado, com ponto.

### Alterar a cor principal
Em `:root` e `.dark`: `--primary`, `--primary-hover`, `--primary-text`, `--primary-soft`, `--primary-soft-fg`, `--ring`, `--chart-1`. Atualize também `COR_BARRA`/`themeColor` se mudar o fundo. Rode `npm run test:e2e -- tema` para verificar o contraste.

### Alterar a tipografia
1. `src/app/layout.tsx`: troque `GeistSans`/`GeistMono` (pacote `geist`) por outra fonte via `next/font/local` ou `next/font/google`, mantendo a variável CSS.
2. `globals.css`: ajuste `--font-sans`/`--font-mono` no `@theme`.

## Fazer deploy
Veja [DEPLOY.md](DEPLOY.md). Resumo: migrations (`npx supabase db push`) → `git push` (a Vercel publica sozinha).

Antes de publicar uma migration, baixe o backup `.json` e faça o dump do banco — veja [RECUPERACAO.md](RECUPERACAO.md).

## Investigar um erro
1. A tela mostra uma mensagem amigável e, às vezes, um **código do erro** (digest).
2. **Logs do servidor (Vercel):** projeto → *Logs*. Os erros do app começam com `[NonatoFin]` e incluem o contexto (ex.: `[NonatoFin] criar lançamento: { code: '23514' }`). Procure também pelo digest.
3. **Logs do banco/Auth (Supabase):** painel → *Logs* (Postgres, Auth, API).
4. Códigos comuns: `23505` duplicado · `23503` registro em uso · `23514` restrição · `42501` RLS/sem permissão · `P0002` não encontrado · `22023` regra de negócio (mensagem pronta).
5. Reproduza localmente com o Supabase local e `npm run dev`; rode o teste relacionado.

## Consultar logs localmente
- App: saída do `npm run dev` / `npm run start`.
- Supabase local sem Docker: `.local-stack/logs/` (`postgres.log`, `auth.log`, `postgrest.log`, `gateway.log`).
- Supabase local com Docker: `npx supabase status` e `docker logs <container>`.

## Dados de exemplo (desenvolvimento)
```bash
npm run usuario:criar -- dono@nonatofin.local "senha-dono-1234"   # com .env.local apontando para o local
psql "postgres://postgres:postgres@127.0.0.1:54322/postgres" -v email="'dono@nonatofin.local'" -f scripts/dados-exemplo.sql
```
