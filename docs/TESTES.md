# Testes

| Tipo | Ferramenta | Pasta | Comando | Precisa de Supabase local? |
|---|---|---|---|---|
| Unitários (regras, exportação, componentes) | Vitest + Testing Library | `tests/unit` | `npm test` | Não |
| Integração (banco real: RLS, constraints, séries, cartões, consultas, tipos) | Vitest + supabase-js + pg | `tests/integracao` | `npm run test:integracao` | Sim |
| E2E rápido (todos os fluxos, celular 390×844) | Playwright | `tests/e2e` | `npm run test:e2e:rapido` | Sim |
| E2E completo (5 tamanhos de tela) | Playwright | `tests/e2e` | `npm run test:e2e` | Sim |
| Lint (inclui as regras de camadas) | ESLint (config Next + `camadas`) | — | `npm run lint` | Não |
| Tipos | TypeScript | — | `npm run typecheck` | Não |
| Build | Next.js | — | `npm run build` | Não |

No dia a dia: `npm run verificar` (lint + tipos + unitários). Tudo de uma vez: `npm run test:tudo` (lint → typecheck → unit → integração → build → E2E).

## Supabase local (para integração e E2E)
Os testes usam o arquivo `.env.test`, com as portas e chaves **de demonstração** do Supabase CLI (valem só localmente).

**Opção A — com Docker (Windows, macOS, Linux):**
```bash
npx supabase start          # sobe Postgres, Auth e API em 54321/54322 e aplica as migrations
npm run test:integracao
npm run build && npm run test:e2e
npx supabase stop
```

**Opção B — sem Docker (Linux x86-64 com PostgreSQL instalado):**
```bash
npm run supabase:local            # baixa GoTrue/PostgREST, cria o banco e aplica as migrations
npm run test:integracao
npm run build && npm run test:e2e
npm run supabase:local:parar
```
`bash scripts/supabase-local/start.sh --reset` recria o banco do zero.

Na primeira execução do Playwright em outra máquina: `npx playwright install chromium`.

## O que é testado

### Unitários (`tests/unit`)
- **Datas:** validação, DD/MM/AAAA, meses em português, semana seg–dom, fim de mês, fuso de São Paulo (23h30 continua "hoje"), `pago_em` → data local.
- **Recorrência:** mudança de mês e de ano; dias 28, 29, 30 e 31; ano bissexto; **teste obrigatório 31/01/2027 → 28/02 → 31/03 → 30/04 → 31/05/2027**; valor não dividido; código só no 1º (ou em todos).
- **Dinheiro:** R$ 10,00 · R$ 100,50 · R$ 1.234,56 · R$ 100.000,00 · **R$ 2.995,00 × 5 = R$ 14.975,00**; conversão de textos; máscara; somas exatas.
- **Dashboard:** cenário conhecido — hoje, amanhã, semana, mês, próximo mês, atrasados, futuro, pago no mês, quantidades, por fornecedor, por mês, ordenação por métrica, sem dupla contagem.
- **CNPJ:** dígitos verificadores (numérico e alfanumérico, exemplo oficial `12.ABC.345/01DE-35`), formatação. **Cartões:** fechamento antes/depois do vencimento, compra no dia do fechamento, fim de mês, divisão com sobra na 1ª parcela, resumo "3x: 1ª de…". **Totais por empresa/categoria.**
- **Fechar o dia:** Páscoa e feriados, próximo dia útil (fim de semana, feriado, Carnaval, feriado local), saldo após pagar, texto completo esperado.
- **Filtros, código de barras, nomes de fornecedores, exportação CSV/XLSX, componentes** (status com ícone+texto, campo de moeda), proteção de redirecionamento.

### Integração (`tests/integracao`)
- **Segurança:** visitante sem acesso; cadastro público recusado; usuário não autorizado sem dados; IDOR entre contas (ler, editar, pagar, excluir, FK de fornecedor, `user_id` forjado, transferência).
- **Banco:** fornecedores sem duplicidade (maiúsculas/acentos/espaços); todas as constraints; bigint; data sem fuso; `updated_at`; **regra de meses do TS idêntica à do Postgres** (369 casos).
- **CRUD e séries:** criar, ver, editar, pagar (idempotente), desfazer, excluir; série de 5; alterar somente um / próximos / todos (com recálculo de datas); excluir um / próximos / todos; inserção atômica.
- **Empresas, categorias e cartões:** CNPJ válido/inválido/repetido (e isolamento entre contas); categorias padrão, nome repetido, categoria em uso; RLS/IDOR em todas as tabelas novas (ler, lançar em empresa/categoria/cartão alheio, ajustar/excluir compra alheia, gravar parcela direto); **divisão das parcelas no SQL idêntica à do TS**; fatura = soma das parcelas, vencimento, descrição, empresa/emissor/categoria do cartão; edição e exclusão recalculam; **trava de fatura paga**; ajuste; fatura protegida contra edição/exclusão; propagação só para faturas em aberto; exclusão da conta com faturas pagas.
- **Contas e saldo:** contas a conferir hoje (ativa sem conferência de hoje; inativa não; conferência de ontem não vale); conta padrão única por empresa, validações, conta só da mesma empresa, conta em uso não é excluída; saldo = movimentos − pagos (pendente não conta, desfazer devolve); conferência com ajuste e data de hoje (inclusive negativo); transferência e exclusão dos dois lados; pagar por outra conta; conta em série com escopo; fatura herda a conta do cartão e só as em aberto mudam; RLS/IDOR (ver, conferir, transferir, lançar entrada, usar a conta alheia).
- **Tipos do banco:** `database.types.ts` confere com o banco real (tabelas, colunas, funções e parâmetros) — falha se uma migration mudou e os tipos não foram gerados.
- **Consultas do app:** cada combinação período × status no banco = mesma regra em memória; filtro por conta e "sem conta"; exportação filtrada = lista; pesquisa (fornecedor sem acento, descrição, observação, contas futuras, caracteres especiais); tela inicial; dashboard e fornecedor com dados reais; histórico por data de pagamento.

### E2E (`tests/e2e`) — em 375×667, 390×844, 430×932, 768×1024 e 1440×900
- **Fluxo principal:** login → criar → visualizar em Hoje → **copiar código (confere a área de transferência)** → editar → marcar pago → histórico → desfazer → excluir.
- **Série:** criar 5 → conferir resumo, valores, datas (31/01…31/05) e fornecedor → editar 3º e próximos → validar → excluir um → validar restantes; excluir "próximos" e "todos".
- Adicionar código, validação do formulário, **duplo toque não duplica**, pesquisa em contas futuras, período × status, mês/dia/intervalo, "Mais filtros" e "Limpar filtros".
- **Relatórios:** totais por fornecedor e filtros do detalhe; **dashboard confere exatamente com o banco**; meses; exportação CSV e Excel; **exportar a lista filtrada**.
- **Fechar o dia:** pagas hoje, pendentes e próximo dia útil no texto; link do WhatsApp com o mesmo texto; "Copiar texto" copia exatamente o texto.
- **Contas:** primeiro acesso do dia bloqueia as telas até conferir os saldos (e não pede de novo no mesmo dia); cadastrar com saldo de hoje, conta padrão no novo boleto, pagar (sai do saldo), entrada, conferência com ajuste, segunda conta e transferência, lista de contas; sem conta prevista o pagamento pergunta a conta; bloco "Saldo × saídas" em Hoje.
- **Empresas e cartões:** cadastrar empresa com CNPJ inválido → válido → excluir; **seletor do topo filtra a lista** e define a empresa do novo boleto; dashboard por empresa/categoria; categorias (criar, renomear, excluir, em uso); **cartão → compra de R$ 100 em 3x → 3 faturas → ajuste → pagar → compra travada**; lista de cartões.
- **Tema:** claro → escuro → recarregar (persistiu) → sistema (segue o aparelho); sem flash na carga; botão rápido; **contraste AA** nos dois temas.
- **Segurança:** rotas privadas → login; API 401; sem cadastro público; senha errada; open redirect; logout; cabeçalhos; nenhum segredo no JS; o navegador nunca chama o Supabase.
- **Responsivo:** todas as páginas (inclusive detalhe, edição, fornecedor e mês) **sem rolagem horizontal nos dois temas** — capturas anexadas ao relatório HTML (`npx playwright show-report`); navegação por barra inferior/menu "Mais" ou menu lateral; alvos de toque ≥ 44px; inputs com 16px.

## Limitações conhecidas
- Os testes E2E usam o **Chromium** emulando iPhone/Android (tamanho, toque, escala). O **Safari (WebKit) real** não foi executado neste ambiente. Para rodar localmente: `npx playwright install webkit` e adicione um projeto com `devices['iPhone 13']` (browserName `webkit`) no `playwright.config.ts`.
- Recomenda-se um teste manual final no seu iPhone/Android (copiar código e colar no app do banco).
