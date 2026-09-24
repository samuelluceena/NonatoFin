# Deploy (publicação) — custo R$ 0

Hospedagem recomendada: **Vercel (plano Hobby, gratuito)** + **Supabase (plano Free)**. Endereço gratuito: `https://nonatofin-SEUNOME.vercel.app` (sem domínio próprio).

## 1. Criar o projeto no Supabase
1. Crie uma conta em https://supabase.com e um projeto (região **South America (São Paulo)**). Guarde a senha do banco.
2. **Desligue o cadastro público:** Authentication → Sign In / Providers → *Allow new users to sign up* → **desligado**. (Mantenha o provedor Email ligado.)
3. Aplique as migrations (escolha uma opção):
   - **CLI (recomendado):**
     ```bash
     npx supabase login
     npx supabase link --project-ref SEU_PROJECT_REF
     npx supabase db push
     ```
   - **Manual:** SQL Editor → cole e execute, **em ordem**, cada arquivo de `supabase/migrations/`.
4. Copie em Project Settings → API: **Project URL**, **Publishable key** (ou *anon key*) e **Secret key** (ou *service_role*).

## 2. Criar o seu usuário (no seu computador)
```bash
cp .env.example .env.local
# preencha SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY e SUPABASE_SECRET_KEY
npm install
npm run usuario:criar -- seu@email.com "uma-senha-forte-com-16+-caracteres"
```
O script cria o usuário (já confirmado) e o coloca em `usuarios_autorizados`.
Alternativa sem script: Authentication → Users → *Add user* (marque *Auto Confirm*) e depois, no SQL Editor:
```sql
insert into public.usuarios_autorizados (user_id)
select id from auth.users where email = 'seu@email.com';
```

**Depois do primeiro login:** vá em **Configurações → Empresas** e cadastre as empresas (apelido + CNPJ). Sem empresa cadastrada, o app mostra um aviso em vez do formulário de lançamento. As categorias padrão são criadas sozinhas.
> Depois disso você pode apagar a `SUPABASE_SECRET_KEY` do `.env.local`.

## 3. Publicar na Vercel
1. Envie o projeto para um repositório no GitHub (privado).
2. Em https://vercel.com → *Add New Project* → importe o repositório (framework: Next.js, detectado automaticamente).
3. Em *Environment Variables* adicione **somente**:
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
   > **Nunca** adicione a `SUPABASE_SECRET_KEY` na Vercel.
4. *Deploy*. Ao terminar, abra o endereço `*.vercel.app` e faça login.
5. No Supabase → Authentication → URL Configuration, coloque o endereço da Vercel em **Site URL**.

## 4. Instalar no celular (PWA)
- **iPhone (Safari):** abra o endereço → Compartilhar → *Adicionar à Tela de Início*.
- **Android (Chrome):** menu ⋮ → *Instalar app* / *Adicionar à tela inicial*.
O NonatoFin abre em tela cheia (standalone), com ícone e nome próprios.

## Atualizações
Cada `git push` na branch principal gera um novo deploy automático. Se houver nova migration, rode `npx supabase db push` **antes** do push do código.

## Custos e limites (planos gratuitos)
| Serviço | Plano | Custo | Observação |
|---|---|---|---|
| Vercel | Hobby | R$ 0 | Uso pessoal e não comercial, conforme os termos da Vercel |
| Supabase | Free | R$ 0 | 500 MB de banco (sobra para anos de boletos). **O projeto é pausado após ~7 dias sem nenhuma atividade**; para reativar, entre no painel do Supabase e clique em *Restore* (os dados não são perdidos). Usar o app regularmente evita a pausa |
| Domínio | — | R$ 0 | Usa `*.vercel.app` |

Nenhuma API paga é usada. Os planos e limites podem mudar; confira as páginas de preços da Vercel e do Supabase.

**Backup:** o plano Free do Supabase não tem backups automáticos acessíveis. Use periodicamente *Configurações → Exportar dados* (CSV/Excel) e/ou `npx supabase db dump --data-only > backup.sql`.

## Alternativas gratuitas à Vercel
Netlify ou Cloudflare Pages (com adaptador para Next.js). A Vercel é a mais simples para Next.js.
