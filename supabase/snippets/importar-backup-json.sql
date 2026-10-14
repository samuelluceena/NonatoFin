-- =============================================================================
-- NonatoFin — IMPORTAR um arquivo de backup (.json) como backup restaurável
-- =============================================================================
-- Uso ADMINISTRATIVO e MANUAL (nunca é executado automaticamente: não é
-- migration nem seed). Passo a passo completo em docs/RECUPERACAO.md.
--
-- O que faz: confere o arquivo e o registra em public.backups_dados como um
-- backup "completo", válido por 7 dias. NÃO apaga nem altera nenhum dado do
-- app. A restauração em si é feita depois pela tela (Configurações → Dados →
-- Restaurar…), com a senha e a frase RESTAURAR BACKUP.
--
-- Onde rodar: Supabase → SQL Editor (papel postgres) — ou psql como postgres.
--
-- Antes de rodar, edite SÓ as três linhas marcadas com  <<< EDITE:
--   1. v_email       → e-mail da conta que vai receber os dados;
--   2. v_confirmacao → digite exatamente IMPORTAR BACKUP JSON;
--   3. v_arquivo     → apague o texto entre as marcas $arquivo$ e cole ali o
--                      conteúdo INTEIRO do arquivo .json (sem escapar nada).
--
-- Tudo roda num único bloco: qualquer verificação que falhar interrompe com
-- uma mensagem e nada é gravado.
-- =============================================================================
do $importar$
declare
  v_email        text  := 'seu-email@exemplo.com';                           -- <<< EDITE
  v_confirmacao  text  := 'NAO';                                             -- <<< EDITE
  v_arquivo      jsonb := $arquivo${"cole": "aqui o conteúdo do arquivo .json"}$arquivo$::jsonb;  -- <<< EDITE

  v_conteudo     jsonb;
  v_tabelas      text[];
  v_uid          uuid;
  v_donos        uuid[];
  v_id           uuid;
begin
  -- 0. Execução consciente, por um papel administrativo.
  if v_confirmacao is distinct from 'IMPORTAR BACKUP JSON' then
    raise exception 'Confirmação ausente: troque v_confirmacao por IMPORTAR BACKUP JSON. Nada foi importado.';
  end if;
  if current_user not in ('postgres', 'supabase_admin') then
    raise exception 'Rode como administrador (postgres) no SQL Editor. Papel atual: %. Nada foi importado.', current_user;
  end if;

  -- 1. Formato.
  if jsonb_typeof(v_arquivo) is distinct from 'object'
     or v_arquivo ->> 'formato' is distinct from 'nonatofin-backup'
     or jsonb_typeof(v_arquivo -> 'conteudo') is distinct from 'object' then
    raise exception 'Este arquivo não é um backup do NonatoFin. Nada foi importado.';
  end if;
  if v_arquivo ->> 'versao_formato' is distinct from '1' then
    raise exception 'Versão de formato desconhecida (%). Nada foi importado.', v_arquivo ->> 'versao_formato';
  end if;
  v_conteudo := v_arquivo -> 'conteudo';

  -- 2. Estrutura: exatamente as 9 tabelas, cada uma uma lista de registros.
  select array_agg(k order by k) into v_tabelas from jsonb_object_keys(v_conteudo) k;
  if v_tabelas is distinct from (select array_agg(t order by t) from unnest(nonatofin_interno.tabelas_backup()) t) then
    raise exception 'O arquivo não tem exatamente as 9 tabelas esperadas (tem: %). Nada foi importado.', v_tabelas;
  end if;
  if exists (select 1 from jsonb_each(v_conteudo) e where jsonb_typeof(e.value) <> 'array') then
    raise exception 'Alguma tabela do arquivo não é uma lista de registros. Nada foi importado.';
  end if;

  -- 3. Integridade: hash SHA-256 e contagens declaradas.
  if nonatofin_interno.hash_conteudo(v_conteudo) is distinct from v_arquivo ->> 'sha256' then
    raise exception 'O hash não confere: o arquivo foi alterado ou está corrompido. Nada foi importado.';
  end if;
  if nonatofin_interno.contar_snapshot(v_conteudo) is distinct from v_arquivo -> 'contagens' then
    raise exception 'As contagens declaradas não conferem com o conteúdo. Nada foi importado.';
  end if;

  -- 4. Versão do banco (mesmas colunas nas 9 tabelas).
  if v_arquivo ->> 'assinatura_esquema' is distinct from nonatofin_interno.assinatura_esquema() then
    raise exception 'O backup é de outra versão do banco (assinatura %, atual %). Siga "Arquivo de outra versão" em docs/RECUPERACAO.md. Nada foi importado.',
      v_arquivo ->> 'assinatura_esquema', nonatofin_interno.assinatura_esquema();
  end if;

  -- 5. Usuário de destino: existe e está autorizado.
  select u.id into v_uid from auth.users u where lower(u.email) = lower(btrim(v_email));
  if v_uid is null then
    raise exception 'Usuário % não encontrado no Auth. Nada foi importado.', v_email;
  end if;
  if not exists (select 1 from public.usuarios_autorizados a where a.user_id = v_uid) then
    raise exception 'Usuário % não está em usuarios_autorizados. Nada foi importado.', v_email;
  end if;

  -- 6. Os registros vêm de uma única conta (na restauração, todos passam a ser do usuário de destino).
  select array_agg(distinct (r ->> 'user_id')::uuid) into v_donos
    from jsonb_each(v_conteudo) e, jsonb_array_elements(e.value) r;
  if coalesce(array_length(v_donos, 1), 0) > 1 then
    raise exception 'O arquivo mistura registros de mais de uma conta. Nada foi importado.';
  end if;
  if v_donos[1] is not null and v_donos[1] <> v_uid then
    raise notice 'Os dados vieram de outra conta (id %); na restauração passarão a ser de %.', v_donos[1], v_email;
  end if;

  -- 7. Registra como backup restaurável (7 dias). Nenhum dado do app é alterado aqui.
  insert into public.backups_dados (user_id, nivel, motivo, versao_formato, assinatura_esquema,
                                    conteudo, contagens, sha256, expira_em)
  values (v_uid, 'completo', 'limpeza', 1, v_arquivo ->> 'assinatura_esquema',
          v_conteudo, nonatofin_interno.contar_snapshot(v_conteudo), v_arquivo ->> 'sha256',
          now() + interval '7 days')
  returning id into v_id;

  raise notice 'Backup importado (id %): %. Agora restaure em Configurações → Dados → Restaurar…',
    v_id, nonatofin_interno.contar_snapshot(v_conteudo);
end
$importar$;
