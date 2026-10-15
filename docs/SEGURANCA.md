# Segurança

## Camadas de proteção

1. **Autenticação (Supabase Auth)** — e-mail e senha; sessão em cookies `httpOnly`, renovada pelo `src/proxy.ts`.
2. **Cadastro público desligado** — no painel (Authentication → Sign In / Providers → *Allow new users to sign up* **desligado**), em `supabase/config.toml` (`enable_signup = false`) e sem tela de cadastro no app.
3. **Lista de autorizados no banco** — `usuarios_autorizados`. Mesmo que alguém consiga criar uma conta (ex.: cadastro reativado por engano), as policies exigem `usuario_autorizado()`; sem isso a conta não lê nem grava nada. O login também recusa usuários fora da lista.
4. **RLS em todas as tabelas** — cada linha tem `user_id`; policies comparam com `auth.uid()`. Veja [BANCO-DE-DADOS.md](BANCO-DE-DADOS.md#rls-e-policies).
5. **FK composta** `(fornecedor_id, user_id)` — impede ligar um boleto ao fornecedor de outra conta (IDOR).
6. **Proteção de rotas** — o proxy redireciona quem não está logado para `/login` (API responde 401). Além disso, **toda página privada, Server Action e Route Handler chama `exigirUsuario()`/`obterUsuario()`** — não depende só do proxy.
7. **Validação forte** — Zod em todas as Server Actions (o servidor nunca confia no navegador) + constraints no banco.
8. **Nenhuma chave no navegador** — o navegador não fala com o Supabase; `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` são lidas só no servidor. A chave secreta (service role) **não é usada pelo app**; só pelo script local `criar-usuario.ts`.
9. **Cabeçalhos HTTP** (`next.config.ts`): CSP restritiva (`connect-src 'self'`, `frame-ancestors 'none'`), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS, `X-Robots-Tag: noindex`, sem `X-Powered-By`.
10. **Sem open redirect** — o parâmetro `voltar` do login só aceita caminhos internos (`lib/auth/destino.ts`).
11. **Erros sem detalhes internos** — mensagens amigáveis ao usuário; o erro técnico vai só para o log do servidor (`lib/acoes/erros.ts`).
12. **Exportação** — `/api/exportar` exige sessão, usa RLS e responde com `Cache-Control: no-store`.
13. **CSV injection** — campos que começam com `= + - @` são neutralizados na exportação.

## Gerenciamento de dados (limpeza, backup e restauração)
Configurações → Dados permite **limpar dados financeiros**, **restaurar o NonatoFin do zero** e **restaurar um backup**. São as únicas operações destrutivas em massa do app.

- **Senha recente validada no banco.** A Server Action confirma a senha abrindo uma sessão nova e temporária (`lib/supabase/reautenticacao.ts`, sem tocar nos cookies), chama a RPC com o token dessa sessão e a encerra em seguida. As funções do banco exigem no JWT o claim `amr` com `password` dos **últimos 120 s**. O Supabase Auth grava esse horário no login, e renovar o token não o atualiza (testado contra o Auth real). Uma sessão comum, mesmo válida, é recusada (`28000`). Assim, chamar a RPC direto pela API sem saber a senha não funciona.
- **Frase exata** conferida no navegador, na Server Action e no banco (`LIMPAR DADOS FINANCEIROS`, `REINICIAR NONATOFIN`, `RESTAURAR BACKUP`).
- **Só os dados do próprio usuário.** Exclusões e inserções rodam como o usuário (`SECURITY INVOKER`): a RLS vale e cada comando ainda filtra `user_id = auth.uid()`. `auth.users` e `usuarios_autorizados` nunca são tocados. Não há `TRUNCATE` nem RLS desligada.
- **Backup obrigatório, na mesma transação.** Se o backup falhar, nada é apagado; qualquer erro desfaz tudo (rollback).
- **`/api/backup`:** 401 sem sessão, **403** para usuário logado fora de `usuarios_autorizados`, 400 para id inválido, 404 para backup inexistente ou de outro usuário (RLS); `Cache-Control: no-store`.
- **Importação de `.json`** (`supabase/snippets/importar-backup-json.sql`, [RECUPERACAO.md](RECUPERACAO.md)): só manual, no SQL Editor (papel `postgres`), com a frase `IMPORTAR BACKUP JSON`. Sem SQL dinâmico; confere formato, 9 tabelas, hash, contagens, versão do banco, usuário autorizado e conta única, num único bloco — nada é gravado se algo falhar. Apenas registra um backup; a restauração continua exigindo senha e frase no app.
- **Cadastro público no Supabase local:** `supabase/config.toml` usa `[auth] enable_signup = false` (como produção) e `[auth.email] enable_signup = true` (no CLI esta opção liga/desliga o provedor de e-mail inteiro, inclusive o login). O arquivo vale só para o ambiente local; **não rode `supabase config push`**.
- **Backups somente leitura para o usuário.** `backups_dados` só tem `SELECT` (RLS). Gravar, restaurar e marcar "restauração em andamento" são feitos por três funções `SECURITY DEFINER` (`criar_backup`, `iniciar_restauracao`, `concluir_restauracao`) no schema `nonatofin_interno`, que **não é exposto pela API** (PostgREST expõe `public`/`graphql_public`; o GraphQL também não as mostra, o que é testado). Cada uma exige usuário autorizado, senha recente e a marca de operação da transação atual, que só `limpar_dados`/`restaurar_backup` gravam.
- **Desvio dos gatilhos só na restauração autorizada.** A trava de fatura paga e a sincronização das faturas são suspensas apenas para **inserções** feitas na transação de uma restauração do próprio usuário (marca em `nonatofin_interno.restauracoes_ativas`, sem permissão para os papéis da API). Ao final, a integridade financeira é conferida (fatura = soma das parcelas + ajuste; nenhuma parcela sem fatura) e, se algo não bater, tudo é desfeito.
- **Integridade do backup:** hash SHA-256 do conteúdo e assinatura do esquema (colunas das 9 tabelas) conferidos antes de restaurar.
- **Execução duplicada:** trava por usuário (`pg_try_advisory_xact_lock`), botão desabilitado durante a operação e diálogo que não fecha enquanto processa.
- **Privilégio extra concedido:** `service_role` pode apenas **ler** a marca de restauração (necessário porque os gatilhos das parcelas também rodam em scripts administrativos). Nenhuma credencial nova na Vercel.

## Importação de planilhas
- O arquivo vai para uma **Server Action** (sessão obrigatória), é lido e validado no servidor (tamanho, colunas, datas reais, valores com até 2 casas, limites de linhas) e gravado por `importar_lancamentos` como o próprio usuário (`SECURITY INVOKER`, RLS): nenhuma chave de serviço.
- A confirmação reenvia o arquivo e **refaz a análise**; o hash precisa ser o mesmo da prévia. As decisões do navegador são só listas de chaves validadas (Zod).
- Itens de importação têm FKs compostas (`lancamento_id, user_id`) e (`importacao_id, user_id`): não é possível ligar um item a lançamento ou lote de outra conta. A atribuição em lote só altera lançamentos do próprio usuário e só aceita empresa dele (`P0002`).
- **Desfazer** exige senha (sessão temporária, como em Dados) e a frase `DESFAZER IMPORTACAO`, conferida no navegador, no servidor e no banco. Importar, desfazer, limpar e restaurar usam a mesma trava por usuário.
- O texto da planilha é tratado só como dado; a exportação continua neutralizando fórmulas.

## Consultas compostas (Transações)
A tela Transações só lê: compõe lançamentos, movimentos de conta e compras no cartão com o cliente do usuário (RLS em todas as consultas), sem tabela nova e sem chave de serviço. O teste de integração `transacoes.test.ts` confere que outro usuário não vê nada com nenhum filtro (inclusive passando ids de conta, empresa ou fornecedor do dono). A contagem de uso das categorias também passa pela RLS.

## Variáveis de ambiente

| Variável | Onde | Segredo? |
|---|---|---|
| `SUPABASE_URL` | Vercel + `.env.local` | Não |
| `SUPABASE_PUBLISHABLE_KEY` | Vercel + `.env.local` | Não (pública; protegida pela RLS). Mesmo assim fica só no servidor |
| `SUPABASE_SECRET_KEY` | **Somente** `.env.local` no seu PC, para `npm run usuario:criar` | **SIM — nunca coloque na Vercel** |

- `.env.example` documenta as variáveis. Arquivos `.env*` reais estão no `.gitignore` (exceção: `.env.test`, que só contém as chaves públicas de *demonstração* do Supabase local).
- Se a chave secreta vazar: Supabase → Project Settings → API Keys → gere uma nova e revogue a antiga.

## O que foi testado automaticamente
`tests/integracao/seguranca.test.ts` e `tests/e2e/seguranca.spec.ts`:
- visitante não lê, não grava e não executa funções; cadastro público recusado;
- usuário autenticado **fora da lista** não vê nem grava nada e não consegue se autoincluir;
- outro usuário não lê/edita/paga/exclui dados do dono, nem via RPC; não usa fornecedor alheio; não forja `user_id`; não transfere registros;
- todas as rotas privadas redirecionam para o login; API retorna 401;
- nenhum segredo, chave ou URL do Supabase aparece no JavaScript enviado ao navegador; o navegador não faz nenhuma requisição externa;
- cabeçalhos de segurança presentes; `voltar` externo é ignorado; logout encerra a sessão.

## Recomendações de uso
- Use uma senha forte e exclusiva (mínimo 10 caracteres; recomendado 16+).
- No Supabase, ative a proteção contra senhas vazadas (Authentication → Policies) se disponível no seu plano.
- Não compartilhe o endereço do app sem necessidade — mesmo que alguém o descubra, **não verá nada sem login**.
- Logout em "Configurações" encerra só a sessão do aparelho atual.
