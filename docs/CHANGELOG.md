# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/). Versão exibida em Configurações → Sobre (vem do `package.json`).

## [1.2.0] — 2026-09-24

### Adicionado (Etapa 4 — Fechar o dia)
- Botão **Fechar o dia** (tela Hoje e menu): texto pronto para o WhatsApp com saldo disponível por conta, pagas hoje, pendentes, **contas do próximo dia útil** (pula fim de semana e feriados, inclui o que vence neles) e **saldo após pagar**.
- Botões **Copiar texto** e **Enviar no WhatsApp**. Nada é gravado nem enviado automaticamente; sem código de barras.
- Feriados nacionais (inclusive Carnaval, Sexta-feira Santa e Corpus Christi) calculados; feriados da cidade em `FERIADOS_LOCAIS`.

### Adicionado (Etapa 3 — filtros combináveis)
- Boletos: **período** (hoje, amanhã, semana, mês, próximo mês, **escolher o mês**, **um dia**, **intervalo de datas**, todo o período) **×** **status** (todos, em aberto, a vencer, atrasados, pagos).
- **Mais filtros**: categoria, fornecedor e **conta** (inclusive "sem conta definida"), com etiquetas removíveis e "Limpar filtros".
- **Exportar esta lista**: CSV/Excel só com o que está filtrado.
- Links antigos (`?filtro=`) continuam funcionando.

### Adicionado (Etapa 2 — conferência diária)
- No **primeiro acesso de cada dia**, o app pede o saldo de cada conta ativa (obrigatório), já preenchido com o saldo do sistema; diferenças viram ajuste.
- Antes, mostra as contas vencidas até hoje para marcar o que **já foi pago** (evita descontar duas vezes).

### Adicionado (Etapa 1 — contas bancárias e saldo)
- **Contas bancárias por empresa** (menu Contas): cadastro com saldo de hoje, conta padrão, ativa/inativa.
- **Saldo calculado**: entradas (inclusive previstas), transferências entre contas, **conferência com o extrato** (ajuste), pagamentos saindo da conta.
- **Conta de débito** nos lançamentos e cartões (faturas herdam), já preenchida com a padrão da empresa.
- **Ao pagar**: um toque com a conta prevista (+ "Trocar conta"); sem conta, pergunta por qual conta foi pago.
- Tela da conta: saldo de hoje, previsto no fim do mês, **alerta de saldo negativo**, próximos 60 dias e extrato.
- Tela Hoje: **Saldo × saídas de hoje** por conta. Tela Contas: total geral, por empresa e por conta, "cobre / faltam" até o fim do mês.
- Exportação com a coluna **Conta**.

### Interno (Etapa 0 — nada muda na tela)
- Modelo interno renomeado de "boleto" para **lançamento** (tabela `lancamentos`, funções `atualizar_lancamento`/`excluir_lancamento`, tipo `Lancamento`, pasta `features/lancamentos`). Rotas e textos continuam "Boletos".
- Tipos do banco **gerados automaticamente** (`npm run db:tipos`) + teste que acusa divergência com o banco.
- Utilitários compartilhados: validação de ids e parâmetros de URL, mensagens de erro centralizadas (duplicidade e "em uso"), `revalidarTudo`, consultas (`ErroConsulta`, paginação), barra de botões dos formulários, lista de detalhes.
- Arquivos grandes divididos (detalhe do lançamento, formulário).
- **Regras de camadas verificadas pelo lint** (domínio puro, telas sem acesso direto ao banco).
- Comandos `npm run verificar` e `npm run test:e2e:rapido`.
- Documentação: guia de alterações com receitas e checklist ([MANUTENCAO.md](MANUTENCAO.md)), [DECISOES.md](DECISOES.md), glossário e camadas em [ARQUITETURA.md](ARQUITETURA.md).

## [1.1.0] — 2026-09-23

### Adicionado
- **Empresas (CNPJ)**: cadastro com validação de CNPJ numérico e alfanumérico; todo lançamento pertence a uma empresa.
- **Seletor de empresa no topo** ("Todas" ou uma empresa), filtrando todas as telas e a exportação.
- **Categorias editáveis** (Boleto de fornecedor, Empréstimo, Despesa fixa, Despesa variada, Cartão de crédito), filtro por categoria.
- **Cartões de crédito**: cadastro com fechamento/vencimento, **compras parceladas** (até 48x), faturas automáticas como contas a pagar, ajuste de fatura (juros/estorno), trava de fatura paga.
- Dashboard: totais **por empresa** e **por categoria**.
- Exportação com colunas **Empresa, CNPJ e Categoria**.
- Botão "+" do celular abre "Boleto ou conta" / "Compra no cartão".

### Alterado
- Formulário de boleto: campos Empresa e Categoria; "Fornecedor" passa a "Fornecedor / credor".
- Detalhe do boleto mostra empresa, CNPJ e categoria; faturas mostram as compras, a soma e o ajuste.

### Migração
- Boletos existentes vão para "Empresa principal" (renomeie e informe o CNPJ em Configurações → Empresas) e para a categoria "Boleto de fornecedor".

## [1.0.0] — 2026-09-23

### Adicionado
- Login com e-mail e senha (Supabase Auth), sem cadastro público, com lista de usuários autorizados no banco.
- Tela **Hoje**: total e quantidade do dia, cards com fornecedor, descrição, parcela, valor, vencimento e código; **COPIAR CÓDIGO** e **MARCAR COMO PAGO**; atrasados; próximos 15 dias.
- Cadastro de boleto **único** e **vários meses** (mensal, 2–120), valor por lançamento, resumo antes de salvar, preservação do dia (31/01 → 28/02 → 31/03…), código só no 1º por padrão.
- Edição (inclusive status) e exclusão com escopo **somente este / este e os próximos / todos**, com confirmação.
- Marcar pago / desfazer pagamento (`pago_em`), status derivado **Atrasado**.
- Adicionar código a boleto sem código.
- Lista de boletos com filtros (Hoje, Amanhã, Esta semana, Este mês, Próximo mês, Pendentes, Atrasados, Pagos, Todos, Fornecedor) e pesquisa (inclui contas futuras).
- **Dashboard** com 10 indicadores, valores por mês, comparativo de fornecedores e pago x pendente.
- **Fornecedores**: tabela própria sem duplicidade por maiúsculas/acentos, totais por status, detalhe com filtros por status e período, renomear/excluir.
- **Contas por mês** e detalhe do mês.
- **Histórico** de pagamentos com pesquisa, fornecedor e período.
- **Exportação** CSV (padrão brasileiro) e Excel (.xlsx).
- Temas **Claro / Escuro / Sistema** com persistência e sem flash; design system com tokens; fonte Geist Sans.
- **PWA**: manifesto, ícones, modo standalone.
- Segurança: RLS, policies, FK composta anti-IDOR, CSP e cabeçalhos, validação Zod, sem chaves no navegador.
- Testes: unitários, integração (banco real) e E2E em 5 tamanhos de tela.
- Documentação completa em `docs/`.
