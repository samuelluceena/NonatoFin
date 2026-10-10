# Backup externo e recuperação

O NonatoFin guarda **backups automáticos** por 30 dias (Configurações → Dados). Este guia cobre o que fazer **depois** disso: guardar cópias fora do Supabase e recuperar a partir delas.

## 1. Cópias externas (faça com frequência)

| Cópia | Como | Quando | Recupera com |
|---|---|---|---|
| **Arquivo `.json` do app** | Configurações → Dados → **Baixar backup completo (.json)** | Toda semana e **antes de qualquer limpeza** | Seção 2 |
| **Dump do banco** (último recurso) | No seu PC, com Docker: `npx supabase db dump --linked -f esquema.sql` e `npx supabase db dump --linked --data-only -f dados.sql` (pede a senha do banco; é só leitura) | Antes de cada publicação com migration | Seção 4 |

O `.json` contém **todos** os seus dados financeiros em texto: guarde-o em local criptografado (ex.: cofre de senhas ou pasta com criptografia), nunca em e-mail ou nuvem pública.

O arquivo traz: `formato`, `versao_formato`, `assinatura_esquema` (versão do banco), `contagens`, `sha256` (do conteúdo) e `conteudo` (as 9 tabelas: empresas, categorias, fornecedores, contas, cartões, lançamentos, compras, parcelas e movimentações).

## 2. Recuperar a partir do `.json` (backups internos já expiraram)

A recuperação usa o **mesmo caminho seguro** da restauração pela tela: o arquivo é primeiro registrado como um backup e depois restaurado pelo app, com senha, frase, conferência de hash, versão do banco, quantidades e integridade das faturas, e rollback se algo falhar.

1. **Confira o acesso:** a conta de destino precisa existir e conseguir entrar no app (se foi apagada, crie de novo com `npm run usuario:criar`; os dados passam para a conta nova).
2. **Abra** Supabase → **SQL Editor** do projeto e cole o conteúdo de [`supabase/snippets/importar-backup-json.sql`](../supabase/snippets/importar-backup-json.sql).
3. **Edite só as três linhas marcadas `<<< EDITE`:**
   - `v_email` → o e-mail da conta;
   - `v_confirmacao` → `IMPORTAR BACKUP JSON` (sem isso o script se recusa a rodar);
   - `v_arquivo` → apague o texto de exemplo entre as marcas `$arquivo$` e cole ali o arquivo `.json` **inteiro**, como está (não precisa escapar nada).
4. **Rode.** O script confere, nesta ordem: confirmação e papel administrativo → formato → as 9 tabelas → **hash SHA-256** → contagens → **versão do banco** → usuário existe e está autorizado → registros de uma única conta. Qualquer falha interrompe com a mensagem e **nada é gravado**. Se tudo estiver certo, aparece `Backup importado (id …)`. Nenhum dado do app foi alterado até aqui.
5. **No app:** Configurações → Dados → **Backups automáticos** → o backup "Antes de reiniciar do zero" (válido por 7 dias) → **Restaurar…** → senha + `RESTAURAR BACKUP`. Os dados atuais são substituídos pelos do arquivo (mesmos ids, valores, datas, status e pagamentos) e o estado atual vira um novo backup, então isso também pode ser desfeito.
6. **Confira:** saldos das contas, faturas pagas e a lista de Boletos. Se o arquivo for antigo, o app pode pedir a conferência de saldos do dia.

Mensagens do script e o que fazer:

| Mensagem | Causa | O que fazer |
|---|---|---|
| Confirmação ausente | `v_confirmacao` não editado | Digite `IMPORTAR BACKUP JSON` |
| Rode como administrador | Executado por outro papel | Use o SQL Editor (papel `postgres`) |
| Não é um backup do NonatoFin / 9 tabelas | Arquivo errado ou incompleto | Use o arquivo baixado em Configurações → Dados |
| O hash não confere / contagens | Arquivo alterado ou corrompido | Use outra cópia; não edite o `.json` |
| Outra versão do banco | Arquivo de antes de uma migration que mudou colunas | Seção 3 |
| Usuário não encontrado / não autorizado | E-mail errado ou conta sem autorização | Corrija o e-mail ou rode `npm run usuario:criar` |

## 3. Arquivo de outra versão do banco

A restauração exige as mesmas colunas de quando o arquivo foi gerado. Para um arquivo antigo, migre-o num Supabase **local**:

1. Num clone do repositório, descubra a última migration que existia na data do arquivo (`git log -- supabase/migrations`).
2. `npx supabase start` e `npx supabase db reset --local --version <timestamp dessa migration>`.
3. Crie a mesma conta localmente (`ARQUIVO_ENV=.env.test npm run usuario:criar` ou pelo painel local) e faça a seção 2 **no banco local** (o SQL Editor local fica em http://127.0.0.1:54323).
4. `npx supabase migration up --local` — as migrations convertem os dados para a versão atual.
5. Com o app rodando contra o Supabase local, baixe um `.json` novo e faça a seção 2 em produção com ele.

## 4. Último recurso: dump do banco

Restaurar um dump substitui as tabelas do banco inteiro (todas as contas). Só use em perda geral, com o projeto parado: num projeto novo ou após conferir com cuidado, `psql "<connection string>" -f esquema.sql` e depois `-f dados.sql`. Prefira sempre a seção 2, que afeta só uma conta e passa por todas as verificações.

## Validação
`tests/integracao/recuperacao-json.test.ts` executa o próprio script (trocando só as três linhas marcadas) no Supabase local: 13 tipos de arquivo/execução inválidos que não gravam nada, papel não administrativo, importação válida, restauração idêntica ao original (fatura paga com ajuste, série, transferência, saldo negativo, textos com acentos, aspas e emoji) e recuperação numa conta recriada com outro id.
