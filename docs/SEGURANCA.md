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
