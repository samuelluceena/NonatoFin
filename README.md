# NonatoFin

**NonatoFin** é um sistema pessoal para controle de **boletos, contas a pagar, fornecedores e planejamento financeiro**. Foi feito primeiro para o celular (*mobile-first*) e pode ser instalado como app (PWA).

Fluxo do dia a dia: abrir o NonatoFin → ver **o que vence hoje** → **Copiar código** com um toque → pagar no app do banco → **Marcar como pago** → próximo.

## Funcionalidades
- **Transações:** visão cronológica de tudo que entra e sai — contas a pagar, pagamentos, entradas, transferências, ajustes e compras no cartão —, com filtros (período, tipo, status, empresa, categoria, conta, fornecedor), pesquisa e totais que separam o que já movimentou dinheiro do que ainda é obrigação.
- **Ações rápidas ("+"):** no celular, o botão central abre Despesa (conta a pagar ou compra no cartão) e Entrada; no desktop, o mesmo menu fica no topo da barra lateral.
- **Hoje:** total e quantidade do dia, atrasados e próximos vencimentos, com botões grandes de copiar código e marcar como pago; saldo × saídas de hoje por conta.
- **Contas bancárias e saldo:** contas por empresa (apelido, banco e só os 4 últimos dígitos), conta de débito padrão, saldo calculado (entradas, transferências, pagamentos), conferência com o extrato e **conferência obrigatória no primeiro acesso do dia**; total geral, por empresa e por conta.
- **Fechar o dia:** texto pronto para o WhatsApp com saldos, pagas hoje, pendentes e contas do **próximo dia útil** (feriados nacionais calculados), com saldo após pagar.
- **Boletos:** cadastro único ou **vários meses** (o valor é de cada lançamento, sem divisão, e o dia 31 é preservado). Edição e exclusão em série (somente este / este e os próximos / todos), desfazer pagamento, **filtros combináveis** (período — dia, mês ou intervalo —, status, fornecedor, categoria, conta) e pesquisa; exporta o que está filtrado.
- **Dashboard:** situação atual (saldo disponível, a pagar até o fim do mês e se o saldo cobre, atrasados), próximos compromissos (hoje, amanhã, semana, mês, próximo mês), pago no mês, total futuro, tendência por mês, composição por status e distribuição por fornecedor, categoria e empresa.
- **Empresas (CNPJ):** controle de várias empresas no mesmo login; seletor no topo filtra todas as telas ("Todas" ou uma empresa). CNPJ validado, inclusive o novo alfanumérico.
- **Categorias** editáveis (também acessíveis por Transações), com quantos registros usam cada uma; categoria em uso não pode ser excluída.
- **Cartões de crédito:** compras à vista ou parceladas (até 48x) viram **faturas a pagar** automaticamente, com ajuste (juros/estorno) e trava após o pagamento.
- **Fornecedores:** sem duplicidade por maiúsculas ou acentos, com totais por status, detalhe e comparativo.
- **Contas por mês**, **Histórico** de pagamentos e **Exportação** em CSV e Excel.
- **Visual:** design system próprio (grafite + azul, Geist Sans), temas **Claro e Escuro** (botão sol/lua, escolha salva, sem flash), barra lateral agrupada e recolhível no desktop, barra inferior no celular. Veja [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md).
- **Segurança:** login sem cadastro público, RLS no banco, lista de usuários autorizados e nenhuma chave no navegador.

## Tecnologias
Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Supabase (Postgres + Auth) · React Hook Form · Zod · next-themes · Geist · sonner · lucide-react · fflate · Vitest · Testing Library · Playwright.

## Requisitos
- Node.js **20.9+** (recomendado 22)
- Uma conta gratuita no [Supabase](https://supabase.com) e outra na [Vercel](https://vercel.com), para publicar
- Para os testes de integração e E2E: Docker (Supabase CLI) **ou** Linux com PostgreSQL (script sem Docker)

## Instalação
```bash
npm install
cp .env.example .env.local   # e preencha (veja "Variáveis")
```

## Configuração do Supabase
1. Crie um projeto no Supabase e **desligue o cadastro público**: Authentication → Sign In / Providers → *Allow new users to sign up* = desligado.
2. Aplique as migrations:
   ```bash
   npx supabase login
   npx supabase link --project-ref SEU_PROJECT_REF
   npx supabase db push
   ```
   Alternativa: cole os arquivos de `supabase/migrations/` em ordem no SQL Editor.
3. Crie e autorize o seu usuário (roda só no seu computador):
   ```bash
   npm run usuario:criar -- seu@email.com "senha-forte-com-16-caracteres"
   ```

4. Entre no app e cadastre suas empresas em **Configurações → Empresas** (apelido e CNPJ).

Passo a passo completo em [docs/DEPLOY.md](docs/DEPLOY.md).

## Variáveis
| Variável | Descrição | Onde |
|---|---|---|
| `SUPABASE_URL` | URL do projeto | `.env.local` e Vercel |
| `SUPABASE_PUBLISHABLE_KEY` | Chave pública (publishable/anon), usada só no servidor | `.env.local` e Vercel |
| `SUPABASE_SECRET_KEY` | Chave secreta, **apenas** para `npm run usuario:criar` | Somente `.env.local`, **nunca** na Vercel |

## Execução
```bash
npm run dev      # http://localhost:3000
```
Para desenvolver sem usar o projeto da nuvem, suba o Supabase local (`npx supabase start` ou `npm run supabase:local`), copie `.env.test` para `.env.local` e crie um usuário com `npm run usuario:criar`. Dados fictícios: veja [docs/MANUTENCAO.md](docs/MANUTENCAO.md#dados-de-exemplo-desenvolvimento).

## Testes
```bash
npm run verificar         # lint (inclui regras de camadas) + tipos + testes de regra — use sempre
npm run test:integracao   # banco real: RLS, séries, cartões, tipos (precisa do Supabase local)
npm run build && npm run test:e2e:rapido   # telas num celular (~5 min)
npm run test:e2e          # telas em 5 tamanhos (~17 min, antes de publicar)
npm run test:tudo         # tudo em sequência
```
Detalhes em [docs/TESTES.md](docs/TESTES.md).

## Build
```bash
npm run build && npm run start
```

## Deploy
Vercel (gratuito, endereço `*.vercel.app`) + Supabase Free. Custo: **R$ 0/mês**. Veja [docs/DEPLOY.md](docs/DEPLOY.md). No celular: *Adicionar à Tela de Início*.

## Estrutura
```
src/app/            rotas (login, (app)/…, api/exportar), layout, tokens de design (globals.css), manifest
src/components/     design system (ui/), gráficos, layout (menus), providers
src/features/       lancamentos (contas a pagar), cartoes, empresas, fornecedores, dashboard, historico, exportacao, auth
src/lib/domain/     regras de negócio puras (datas, dinheiro, recorrência, status, filtros, indicadores, cartões, CNPJ)
src/lib/supabase/   clientes, tipos do banco (gerados), consultas, sessão do proxy
src/lib/            validação, parâmetros de URL, mensagens de erro, config
supabase/           config e migrations
scripts/            criar usuário, ícones, dados de exemplo, Supabase local sem Docker
tests/              unit, integracao, e2e
docs/               documentação
```

## Documentação
Para **alterar** o app, comece pelo [Guia de manutenção e alterações](docs/MANUTENCAO.md).

- [Arquitetura](docs/ARQUITETURA.md)
- [Banco de dados](docs/BANCO-DE-DADOS.md)
- [Segurança](docs/SEGURANCA.md)
- [Regras de negócio](docs/REGRAS-DE-NEGOCIO.md)
- [Design system](docs/DESIGN-SYSTEM.md)
- [Manutenção e alterações](docs/MANUTENCAO.md) — receitas e checklist
- [Decisões de arquitetura](docs/DECISOES.md) — o porquê de cada escolha
- [Deploy](docs/DEPLOY.md)
- [Backup externo e recuperação](docs/RECUPERACAO.md)
- [Testes](docs/TESTES.md)
- [Changelog](docs/CHANGELOG.md)
