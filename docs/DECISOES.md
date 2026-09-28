# Decisões de arquitetura

Registro curto do **porquê** das escolhas importantes. Antes de mudar algo listado aqui, leia o motivo — e, se mudar, registre a nova decisão no fim do arquivo (com data).

Formato: **Decisão** · Motivo · Consequência.

---

### D1 — Dinheiro em centavos inteiros (`bigint`)
- **Motivo:** ponto flutuante erra somas (0,1 + 0,2 ≠ 0,3). Centavos inteiros são exatos.
- **Consequência:** todo valor no banco e no código é `Centavos` (inteiro). Formatação só na exibição (`lib/domain/dinheiro.ts`).

### D2 — Vencimento é DATA, não instante
- **Motivo:** "vence dia 15" não tem hora nem fuso. Tratar como instante faria o dia mudar dependendo do fuso do servidor.
- **Consequência:** `date` no banco, texto `AAAA-MM-DD` no app, nunca `new Date()` local. "Hoje" é calculado no fuso de São Paulo.

### D3 — "Atrasado" é calculado, não gravado
- **Motivo:** depende do dia de hoje; gravado, ficaria errado no dia seguinte.
- **Consequência:** o banco guarda `pendente`/`pago`; `calcularStatus()` deriva "atrasado". Filtros de atrasados usam `pendente + vencimento < hoje`.

### D4 — O navegador nunca fala direto com o Supabase
- **Motivo:** nenhuma chave no JavaScript do navegador, CSP restrita à própria origem, acesso a dados em um só lugar.
- **Consequência:** leitura em Server Components (`features/*/consultas.ts`), escrita em Server Actions (`features/*/acoes.ts`). O lint impede `supabase.from/rpc` em telas e componentes.

### D5 — Segurança no banco (RLS + FKs compostas)
- **Motivo:** não confiar apenas no app. Mesmo com um bug no código, o banco não entrega nem aceita dados de outra conta.
- **Consequência:** toda tabela tem RLS e FKs `(x_id, user_id)`; é impossível apontar para um registro de outra conta (anti-IDOR). Toda tabela nova segue o mesmo padrão.

### D6 — Regras de negócio puras em `lib/domain`, iguais às do banco
- **Motivo:** regras testáveis em milissegundos, sem banco nem tela. Quando a mesma regra existe no SQL (séries, parcelas de cartão), um teste de integração confere que TS e SQL dão o mesmo resultado.
- **Consequência:** `lib/domain` não importa React/Next/Supabase (verificado pelo lint).

### D7 — "Lançamento" no código, "Boletos" na tela
- **Motivo:** a tabela guarda boletos, faturas de cartão, empréstimos e despesas. Chamar tudo de "boleto" no código confundia quem fosse alterar. Para o usuário, a lista continua "Boletos" (é como ele fala).
- **Consequência:** tabela `lancamentos`, tipo `Lancamento`, pasta `features/lancamentos`. Rotas (`/boletos`), textos e `data-testid` usam a palavra da tela. Glossário em [ARQUITETURA.md](ARQUITETURA.md). *(2026-09-24, antes da primeira publicação.)*

### D8 — Fatura de cartão é um lançamento comum
- **Motivo:** a fatura é o que se paga; tratá-la como lançamento faz ela aparecer sozinha em Hoje, Meses, Dashboard, Exportação e Histórico, sem código extra em cada tela.
- **Consequência:** o banco mantém a fatura sincronizada (gatilhos). Ela não é editada pelo formulário comum; muda pelas compras ou pelo ajuste. Fatura paga trava as compras dela.

### D9 — Depois de gravar, atualizar todas as telas (`revalidarTudo`)
- **Motivo:** um único usuário e telas que se cruzam (um pagamento muda Hoje, Dashboard, Meses, Fornecedores…). Rastrear página por página é frágil.
- **Consequência:** toda Server Action chama `revalidarTudo()` (`lib/acoes/revalidar.ts`).

### D10 — Tipos do banco gerados + ajustes separados
- **Motivo:** tipos escritos à mão ficam desatualizados sem ninguém perceber.
- **Consequência:** `database.types.ts` é gerado (`npm run db:tipos`) e um teste compara com o banco. O que o gerador não sabe (parâmetros que aceitam `null`) fica em `tipos-banco.ts`.

### D11 — Status como texto com `check` (não enum)
- **Motivo:** enums do Postgres são difíceis de alterar depois (remover um valor exige recriar o tipo).
- **Consequência:** o gerador tipa `status` como `string`; `statusDoBanco()` converte e interrompe se aparecer valor inesperado.

### D12 — Um banco local sem Docker para os testes
- **Motivo:** rodar testes de integração/E2E em máquinas sem Docker (Linux).
- **Consequência:** `scripts/supabase-local/` sobe Postgres + Auth + PostgREST com as mesmas portas e chaves do Supabase CLI. Com Docker, `npx supabase start` funciona igual.

### D13 — Camadas verificadas pelo lint
- **Motivo:** arquitetura só se mantém se for verificada; revisão manual esquece.
- **Consequência:** regras `no-restricted-imports`/`no-restricted-syntax` em `eslint.config.mjs`. `npm run lint` falha se uma camada usar outra indevidamente.

### D14 — Saldo calculado, nunca digitado; conferência como ajuste
- **Motivo:** saldo digitado fica errado sem ninguém perceber. Calculado (movimentos − pagamentos) ele acompanha cada pagamento; a conferência diária com o extrato corrige o que não foi lançado (tarifas, entradas esquecidas) e deixa registrado quanto foi ajustado.
- **Consequência:** pagamentos não viram movimento (vêm dos lançamentos pagos); `saldos_contas()` soma tudo no banco; `conferir_saldo()` calcula o ajuste na mesma transação.

### D15 — Conta da mesma empresa garantida pelo banco
- **Motivo:** débito de um CNPJ saindo da conta de outro CNPJ seria um erro grave e silencioso.
- **Consequência:** FK composta `(conta_id, empresa_id, user_id)` → `contas_bancarias (id, empresa_id, user_id)` em lançamentos e cartões. Trocar a empresa na tela troca a conta pela padrão da nova empresa.

### D16 — Diálogo "por qual conta foi pago?" no layout
- **Motivo:** o cartão do lançamento some da lista logo depois de pago; um diálogo dentro dele sumiria junto.
- **Consequência:** um único `DialogoContaDoPagamento` no layout do app, aberto por `pedirContaDoPagamento()` de qualquer botão.

### D17 — Conferência diária no layout, página fora do grupo
- **Motivo:** tem que valer para qualquer tela (é obrigatória) e não pode bloquear a si mesma.
- **Consequência:** o layout de `(app)` verifica e redireciona; `/conferir-saldos` fica em `app/conferir-saldos`, com cabeçalho próprio (logo e Sair). A verificação é uma função SQL (`contas_a_conferir_hoje`), uma consulta por página.

### D18 — Filtros da lista na URL, um só montador de consulta
- **Motivo:** filtro que vive só na tela se perde ao atualizar ou voltar, e duas consultas "parecidas" (lista e exportação) acabam divergindo.
- **Consequência:** `lerFiltros()`/`parametrosDosFiltros()` (`lib/domain/filtros.ts`) convertem URL ↔ filtros; `consultaFiltrada()` monta a consulta para a lista **e** para "Exportar esta lista". Links antigos `?filtro=` são traduzidos. *(2026-09-24)*

### D19 — "Fechar o dia" sem gravar nada; feriados calculados no código
- **Motivo:** o pedido é um texto para colar no WhatsApp, sem histórico. Gravar fechamentos criaria dados a manter sem uso. Feriados nacionais seguem regras fixas (datas e Páscoa); os municipais variam por cidade e não devem ser inventados.
- **Consequência:** a página só lê e monta o texto (`lib/domain/fechamento.ts`, testado com o texto completo). Feriados nacionais em `lib/domain/dias-uteis.ts`; os da cidade o usuário informa em `FERIADOS_LOCAIS` (`lib/config.ts`). *(2026-09-24)*

### D20 — "Transações" é uma visão composta, sem tabela própria
- **Motivo:** tudo o que a tela mostra já existe (lançamentos, movimentos de conta, compras no cartão). Uma tabela `transacoes` duplicaria dados e criaria uma segunda fonte da verdade para saldo e status.
- **Consequência:** `features/transacoes/consultas.ts` busca cada origem já filtrada no banco (RLS), limitada e ordenada; `lib/domain/transacoes.ts` mescla, classifica e soma. Obrigação (conta a pagar) e caixa (pagamento, entrada) ficam separados; transferência é um item neutro; compra no cartão é informativa (sai pela fatura). Nenhuma regra financeira foi alterada. *(2026-09-24)*

### D21 — Categorias: sem "arquivar" por enquanto
- **Motivo:** arquivar exige uma coluna nova (`categorias.ativa boolean not null default true`) e filtrar os seletores de novos registros (lançamento, compra, cartão). A necessidade não é urgente: a exclusão de categoria em uso já é bloqueada pelo banco, e editar o nome resolve os casos comuns.
- **Consequência:** se for implementado: migration `alter table public.categorias add column ativa boolean not null default true` (sem impacto em RLS; os dados existentes ficam ativos), `npm run db:tipos`, filtro `ativa` nos seletores de cadastro (mantendo a categoria atual ao editar) e botão Arquivar/Reativar. Rollback: `alter table public.categorias drop column ativa` (perde só a marcação). *(2026-09-24)*

### D22 — Design system próprio com tokens semânticos (sem biblioteca de UI)
- **Motivo:** o app precisa de poucos componentes, leves e acessíveis; uma biblioteca de UI traria peso e um visual que não é o do produto. Tokens semânticos (fundo, superfície, superfície elevada, texto, estados) permitem mudar a identidade e os temas num só arquivo.
- **Consequência:** cores, tipografia, raios, sombras e movimento em `src/app/globals.css`; componentes em `src/components/ui` só usam tokens (sem hexadecimais nem tamanhos soltos) e acessibilidade nativa (`<dialog>`, `<select>`, `<input type="checkbox">`). Dinheiro sempre pelo `Valor`; confirmações destrutivas pelo `Dialogo` com `alerta`. Guia completo em [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md). *(2026-09-24)*

### D23 — Tema só Claro/Escuro; estado da sidebar em cookie
- **Motivo:** "Sistema" confundia (o tema mudava sozinho) e o pedido era um controle de um clique. O estado da sidebar recolhida precisa ser conhecido no servidor para a página abrir já no formato certo.
- **Consequência:** next-themes com `enableSystem={false}` e padrão Claro; preferência antiga "system" migra uma vez para o tema do aparelho. Sidebar: cookie `nonatofin-sidebar` lido no layout. *(2026-09-24)*
