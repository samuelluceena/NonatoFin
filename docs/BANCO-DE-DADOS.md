# Banco de dados

Postgres do Supabase. Toda a estrutura é criada por **migrations versionadas** em `supabase/migrations/` — nada precisa ser criado manualmente no painel.

| Migration | Conteúdo |
|---|---|
| `20260923120000_base.sql` | `definir_updated_at()`, `normalizar_nome()`, `usuarios_autorizados`, `usuario_autorizado()` |
| `20260923120100_fornecedores.sql` | Tabela `fornecedores`, RLS, `obter_ou_criar_fornecedor()` |
| `20260923120200_lancamentos.sql` | Tabela `lancamentos` (contas a pagar), constraints, índices, RLS |
| `20260923120300_funcoes_lancamentos.sql` | `definir_pagamento()`, `atualizar_lancamento()`, `excluir_lancamento()` |
| `20260924090000_empresas_categorias.sql` | `cnpj_valido()`, `empresas`, `categorias`, categorias padrão, `lancamentos.empresa_id`/`categoria_id` (com migração dos boletos existentes para "Empresa principal") |
| `20260925090000_contas_bancarias.sql` | `contas_bancarias`, `movimentos_conta`, `conta_id` em lançamentos e cartões, `hoje_app()`, `saldos_contas()`, `conferir_saldo()`, `transferir_entre_contas()`, `excluir_transferencia()`; `definir_pagamento` e `atualizar_lancamento` com conta; faturas herdam a conta |
| `20260926090000_conferencia_diaria.sql` | `contas_a_conferir_hoje()` + índice das conferências |
| `20260924090100_cartoes.sql` | `cartoes`, `compras_cartao`, `parcelas_cartao`, campos de fatura em `lancamentos`, gatilhos de fatura e trava, RPCs de compra/ajuste, `atualizar_boleto()` com empresa e categoria |

## Diagrama

```
auth.users ──1:N── empresas ─┬──────────────┐
    │                        │ N            │ N
    ├──1:N── categorias ─────┼──── lancamentos ◄┼── (fatura) ─┐
    │                        │   ▲   ▲      │             │
    ├──1:N── fornecedores ───┘   │   │   cartoes ─1:N─ compras_cartao ─1:N─ parcelas_cartao
    │                            │   └─(emissor = fornecedor)
    └──0..1── usuarios_autorizados

Todas as FKs entre tabelas do usuário são COMPOSTAS (x_id, user_id):
é impossível referenciar um registro de outra conta (anti-IDOR no banco).
```

## Tabelas

### `usuarios_autorizados`
| Campo | Tipo | Observação |
|---|---|---|
| `user_id` | uuid PK | FK `auth.users`, `on delete cascade` |
| `created_at` | timestamptz | |

RLS ligada **sem policies**: inacessível pela API pública. Só o SQL Editor/service role inserem.

### `fornecedores`
| Campo | Tipo | Observação |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid | padrão `auth.uid()`, FK `auth.users` |
| `nome` | text | 1–120 caracteres (grafia escolhida) |
| `nome_normalizado` | text **gerada** | `normalizar_nome(nome)`: sem acento, minúsculo, espaços únicos |
| `created_at`, `updated_at` | timestamptz | `updated_at` via gatilho |

Constraints: `unique (user_id, nome_normalizado)` — impede "Via da Moda" / "VIA DA MODA" / "via  da  móda" duplicados; `unique (id, user_id)` — alvo da FK composta.

### `lancamentos`

Toda conta a pagar: boleto de fornecedor, fatura de cartão, empréstimo, despesa fixa ou variada. (Na interface a lista se chama "Boletos".)

| Campo | Tipo | Observação |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid | padrão `auth.uid()` |
| `fornecedor_id` | uuid | FK composta `(fornecedor_id, user_id)` → `fornecedores (id, user_id)`, `on delete restrict` |
| `descricao` | text | nome/descrição, 1–200 |
| `valor_centavos` | **bigint** | centavos inteiros (> 0 e ≤ R$ 1 bilhão). Sem ponto flutuante |
| `vencimento` | **date** | data pura, sem fuso (2000-01-01 a 2100-12-31) |
| `codigo_barras` | text null | somente dígitos: 44, 47 ou 48 |
| `observacao` | text null | até 1000 |
| `status` | text | `pendente` \| `pago` (atrasado é derivado) |
| `pago_em` | timestamptz null | preenchido ⇔ status = pago |
| `serie_id` | uuid null | agrupa lançamentos criados juntos |
| `parcela` | smallint null | 1..total |
| `total_parcelas` | smallint null | 1..360 |
| `created_at`, `updated_at` | timestamptz | |

Constraints (`check`): valor positivo, faixa de vencimento, formato do código, tamanho de textos, status válido, `(status = 'pago') = (pago_em is not null)`, série consistente (os três campos juntos, parcela ≤ total), `unique (serie_id, parcela)`.

Por que "atrasado" não é gravado: depende da data atual; gravado, ficaria desatualizado todo dia. É calculado em `lib/domain/status.ts` (e o filtro equivalente é `status = 'pendente' and vencimento < hoje`).

### `empresas`
| Campo | Tipo | Observação |
|---|---|---|
| `id`, `user_id` | uuid | `unique (id, user_id)` para FKs compostas |
| `apelido` | text | 1–40; `apelido_normalizado` gerado; único por usuário |
| `razao_social` | text null | até 150 |
| `cnpj` | text null | 14 caracteres sem pontuação, `check cnpj_valido(cnpj)`, único por usuário |

### `categorias`
`nome` (1–40, `nome_normalizado` gerado e único por usuário), `ordem`. FKs de lançamentos/compras/cartões com `on delete restrict`.

### `lancamentos` (empresa, categoria e fatura)
`empresa_id` e `categoria_id` **not null** (FKs compostas). Faturas: `cartao_id`, `fatura_mes` (`AAAA-MM`), `ajuste_centavos`; `check lancamentos_fatura_consistente` (os três juntos, fatura nunca é série) e `unique (cartao_id, fatura_mes)`.

### `cartoes`
`empresa_id`, `fornecedor_id` (emissor), `categoria_fatura_id`, `nome` (único), `final` (`^[0-9]{4}$`), `dia_fechamento`/`dia_vencimento` (1–31, diferentes), `ativo`.

### `compras_cartao`
`cartao_id`, `categoria_id`, `descricao`, `data_compra`, `valor_total_centavos` (≥ parcelas), `parcelas` (1–48), `primeira_fatura_mes`, `observacao`. Escrita somente pelas RPCs.

### `parcelas_cartao`
`compra_id` (`on delete cascade`), `cartao_id`, `numero`/`total`, `valor_centavos`, `fatura_mes`. Geradas pelo banco. Gatilhos:
- `parcelas_trava_fatura_paga` (BEFORE): impede incluir/alterar/excluir parcela de fatura paga (exceto na exclusão da conta — `conta_em_exclusao`).
- `parcelas_sincroniza_faturas` (AFTER): chama `sincronizar_fatura(cartao, mês)`, que cria/atualiza/remove o lançamento da fatura.
- `cartoes_propagar_faturas` (em `cartoes`): repassa nome, empresa, emissor, categoria e vencimento às faturas **pendentes**.

### `contas_bancarias`
`empresa_id` (FK composta), `apelido` (único por usuário, sem acento/maiúsculas), `banco`, `final` (`^[0-9]{4}$`), `padrao`, `ativa`. `check (not padrao or ativa)`; índice único parcial `(empresa_id) where padrao` (uma padrão por empresa) e o gatilho `contas_troca_padrao` desmarca a anterior. `unique (id, empresa_id, user_id)` é o alvo das FKs de `lancamentos.conta_id` e `cartoes.conta_id` — assim a conta é sempre **da mesma empresa** do lançamento/cartão.

### `movimentos_conta`
`conta_id` (FK composta, `on delete cascade`), `tipo` (`entrada` \| `transferencia` \| `conferencia`), `data`, `valor_centavos` **com sinal** (+ entra, − sai), `saldo_informado` (só conferência), `descricao`, `confirmado` (entrada prevista = false), `transferencia_id` (liga os dois lados). Checks: entrada > 0; transferência com `transferencia_id` e confirmada; conferência ⇔ `saldo_informado`.

Pagamentos **não** viram movimento: o saldo desconta os `lancamentos` com `status = 'pago'` e `conta_id` da conta.

## Índices
- `lancamentos (user_id, vencimento)` — listas e filtros por período
- `lancamentos (user_id, status, vencimento)` — pendentes/atrasados/pagos
- `lancamentos (fornecedor_id)` — detalhe do fornecedor e FK
- `lancamentos (user_id, pago_em) where pago_em is not null` — histórico
- `unique (serie_id, parcela)` — operações em série
- `unique (user_id, nome_normalizado)` — busca/unicidade de fornecedores
- `lancamentos (empresa_id, vencimento)`, `lancamentos (categoria_id)` — filtros por empresa/categoria
- `compras_cartao (cartao_id, data_compra)`, `parcelas_cartao (cartao_id, fatura_mes)` — faturas e compras

## RLS e policies
RLS ligada em todas as tabelas. Para `fornecedores`, `lancamentos`, `empresas`, `categorias`, `cartoes`, `compras_cartao` e `parcelas_cartao`, uma policy por operação (select/insert/update/delete), todas `to authenticated` com:

```sql
user_id = (select auth.uid()) and (select public.usuario_autorizado())
```

`update` usa a mesma expressão em `using` e `with check` (ninguém consegue "transferir" um registro para outra conta). O papel `anon` teve todos os privilégios revogados nas tabelas e funções.

## Funções (RPC)
Todas `security invoker` (rodam com as permissões do usuário, RLS aplicada), `search_path = ''` e `execute` só para `authenticated`.

| Função | O que faz |
|---|---|
| `usuario_autorizado()` | `security definer`; true se o usuário está em `usuarios_autorizados` |
| `obter_ou_criar_fornecedor(p_nome)` | Busca pelo nome normalizado ou cria (atômico, sem corrida) |
| `definir_pagamento(p_id, p_pago)` | Marca pago (preserva o `pago_em` original) ou desfaz |
| `atualizar_lancamento(...)` | Edição com escopo `este`/`proximos`/`todos` em uma única transação; recebe empresa e categoria; recusa faturas de cartão |
| `excluir_lancamento(p_id, p_escopo)` | Exclusão com o mesmo escopo; retorna a quantidade. Recusa fatura com compras |
| `garantir_categorias_padrao()` | Cria as 5 categorias padrão se o usuário não tiver nenhuma e devolve a lista |
| `registrar_compra_cartao(...)` | Grava a compra e gera as parcelas/faturas (transação única); retorna o id |
| `atualizar_compra_cartao(p_id, ...)` | Regrava a compra e recalcula parcelas e faturas |
| `excluir_compra_cartao(p_id)` | Exclui a compra (parcelas em cascata; faturas recalculadas) |
| `definir_ajuste_fatura(p_id, p_ajuste, p_observacao)` | Ajuste manual da fatura pendente; total precisa ficar > 0 |
| `cnpj_valido(text)` | Validação de CNPJ numérico e alfanumérico (usada no `check`) |
| `hoje_app()` | Data de hoje no fuso de São Paulo (mesmo de `lib/config.ts`) |
| `saldos_contas()` | Saldo atual de cada conta: movimentos confirmados − lançamentos pagos |
| `conferir_saldo(p_conta_id, p_saldo_informado)` | Grava a conferência com o ajuste calculado na mesma transação |
| `transferir_entre_contas(...)` | Cria os dois movimentos da transferência (valida contas diferentes e data não futura) |
| `excluir_transferencia(p_transferencia_id)` | Exclui os dois lados |
| `contas_a_conferir_hoje()` | Contas ativas sem conferência com a data de hoje (usado para exigir a conferência diária) |
| `definir_pagamento(p_id, p_pago, p_conta_id?)` | Agora aceita a conta que pagou |
| `conta_em_exclusao(user_id)` | `security definer`; true quando a conta está sendo apagada — deixa a exclusão da conta passar pela trava de fatura paga |

A criação de séries é um único `INSERT` com várias linhas (atômico).

## Tipos TypeScript do banco
- `src/lib/supabase/database.types.ts` é **gerado** a partir do banco pelo gerador oficial do Supabase: `npm run db:tipos` (banco local) ou `npm run db:tipos:nuvem` (projeto ligado). Nunca edite à mão.
- `src/lib/supabase/tipos-banco.ts` complementa os tipos gerados: marca quais parâmetros de funções SQL aceitam `null` (o Postgres não guarda essa informação) e exporta atalhos como `LinhaLancamento`. Os clientes Supabase usam o `Database` deste arquivo.
- O teste `tests/integracao/tipos-banco.test.ts` compara o arquivo gerado com o banco (tabelas, colunas, funções e parâmetros) e falha se alguém mudar uma migration e esquecer de gerar os tipos.
- `status` é texto com `check` no banco; o app converte com `statusDoBanco()` (`lib/domain/status.ts`), que interrompe se aparecer um valor inesperado.

## Migrations: como aplicar
- **Projeto na nuvem:** `npx supabase link --project-ref SEU_REF` e `npx supabase db push`, ou cole cada arquivo, em ordem, no SQL Editor.
- **Local com Docker:** `npx supabase start` (aplica automaticamente).
- **Local sem Docker (Linux):** `npm run supabase:local`.

Como criar uma nova migration: veja [MANUTENCAO.md](MANUTENCAO.md#alterar-o-banco--criar-migration).
