-- =============================================================================
-- NonatoFin — Migration 009: gerenciamento de dados
--   * limpar dados financeiros  (opção 1)
--   * restaurar o NonatoFin do zero (opção 2)
--   * backup automático obrigatório (30 dias, até 10) e restauração
-- =============================================================================
-- Segurança (veja docs/SEGURANCA.md, seção Gerenciamento de dados):
--  * As exclusões e inserções nas tabelas do usuário rodam como o PRÓPRIO
--    usuário (SECURITY INVOKER): a RLS continua valendo e cada comando ainda
--    filtra user_id = auth.uid().
--  * Só três passos rodam com privilégio do dono (SECURITY DEFINER), porque o
--    usuário NÃO tem permissão de escrita nas tabelas internas:
--      criar_backup, iniciar_restauracao, concluir_restauracao.
--    Ficam no schema nonatofin_interno, que não é exposto pela API (PostgREST
--    só expõe public/graphql_public; o pg_graphql só reflete o search_path).
--  * Toda função interna exige: usuário autorizado + login com SENHA nos
--    últimos 120 s (claim amr do JWT) + marca de operação da transação atual,
--    que só limpar_dados/restaurar_backup gravam (set_config local).
--  * backups_dados: o usuário só LÊ os próprios backups. Não insere, não altera
--    e não apaga. A marca de restauração fica em uma tabela sem permissão
--    nenhuma para os papéis da API e vale apenas para a transação que a criou.
--  * Nada de TRUNCATE, nada de desligar RLS; auth.users e
--    usuarios_autorizados nunca são tocados.
-- =============================================================================

create schema if not exists nonatofin_interno;
revoke all on schema nonatofin_interno from public;
-- Necessário para as funções públicas (que rodam como o usuário) chamarem as internas.
grant usage on schema nonatofin_interno to authenticated;

comment on schema nonatofin_interno is
  'Funções internas do gerenciamento de dados. Não exposto pela API.';

-- -----------------------------------------------------------------------------
-- BACKUPS
-- -----------------------------------------------------------------------------
create table public.backups_dados (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  nivel              text not null,
  motivo             text not null,
  versao_formato     smallint not null,
  assinatura_esquema text not null,
  conteudo           jsonb not null,
  contagens          jsonb not null,
  sha256             text not null,
  criado_em          timestamptz not null default clock_timestamp(),
  expira_em          timestamptz not null,
  restaurado_em      timestamptz,

  constraint backups_nivel_valido check (nivel in ('financeiro', 'completo')),
  constraint backups_motivo_valido check (motivo in ('limpeza', 'antes_da_restauracao')),
  constraint backups_sha256_formato check (sha256 ~ '^[0-9a-f]{64}$')
);

comment on table public.backups_dados is
  'Cópia de todos os dados do usuário feita antes de cada limpeza/restauração. Somente leitura para o usuário.';

create index backups_dados_user_criado_idx on public.backups_dados (user_id, criado_em desc);

alter table public.backups_dados enable row level security;
revoke all on table public.backups_dados from public, anon, authenticated;
grant select on table public.backups_dados to authenticated;

create policy backups_dados_select on public.backups_dados for select to authenticated
  using (user_id = (select auth.uid()) and (select public.usuario_autorizado()));

-- Marca "restauração em andamento" (uma linha por transação). Sem permissão
-- nenhuma para os papéis da API: só as funções internas (dono) escrevem.
create table nonatofin_interno.restauracoes_ativas (
  user_id uuid not null,
  xid     xid8 not null,
  primary key (user_id, xid)
);
alter table nonatofin_interno.restauracoes_ativas enable row level security;
revoke all on table nonatofin_interno.restauracoes_ativas from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Utilitários (somente leitura)
-- -----------------------------------------------------------------------------

-- Tabelas do usuário, na ordem de INSERÇÃO (respeita as FKs).
create or replace function nonatofin_interno.tabelas_backup()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['empresas', 'categorias', 'fornecedores', 'contas_bancarias', 'cartoes',
               'lancamentos', 'compras_cartao', 'parcelas_cartao', 'movimentos_conta']
$$;

-- Tabelas apagadas pela opção 1 (dados financeiros/operacionais).
create or replace function nonatofin_interno.tabelas_financeiras()
returns text[]
language sql
immutable
set search_path = ''
as $$ select array['lancamentos', 'compras_cartao', 'parcelas_cartao', 'movimentos_conta'] $$;

create or replace function nonatofin_interno.tabelas_do_nivel(p_nivel text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case p_nivel when 'completo' then nonatofin_interno.tabelas_backup()
                      else nonatofin_interno.tabelas_financeiras() end
$$;

-- Assinatura das colunas das 9 tabelas. Um backup só é restaurado se o banco
-- ainda tiver exatamente as mesmas colunas (protege contra migrations futuras).
create or replace function nonatofin_interno.assinatura_esquema()
returns text
language sql
stable
set search_path = ''
as $$
  select md5(string_agg(c.relname || '.' || a.attname || ':' || pg_catalog.format_type(a.atttypid, a.atttypmod)
                        || ':' || a.attgenerated::text, ',' order by c.relname, a.attnum))
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    join pg_catalog.pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
   where c.relname = any (nonatofin_interno.tabelas_backup())
$$;

-- Colunas restauráveis de uma tabela (sem colunas geradas e sem user_id).
create or replace function nonatofin_interno.colunas_restauraveis(p_tabela text)
returns text
language sql
stable
set search_path = ''
as $$
  select string_agg(pg_catalog.quote_ident(a.attname), ', ' order by a.attnum)
    from pg_catalog.pg_attribute a
   where a.attrelid = pg_catalog.to_regclass('public.' || pg_catalog.quote_ident(p_tabela))
     and a.attnum > 0 and not a.attisdropped and a.attgenerated = '' and a.attname <> 'user_id'
$$;

-- Todos os dados do usuário, por tabela. Filtra explicitamente por p_user_id
-- (quando chamada pelo próprio usuário, a RLS também se aplica).
create or replace function nonatofin_interno.montar_snapshot(p_user_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_tabela text;
  v_linhas jsonb;
  v_dados  jsonb := '{}'::jsonb;
begin
  foreach v_tabela in array nonatofin_interno.tabelas_backup() loop
    execute format('select coalesce(jsonb_agg(to_jsonb(t) order by t.id), ''[]''::jsonb) from public.%I t where t.user_id = $1', v_tabela)
      into v_linhas using p_user_id;
    v_dados := v_dados || jsonb_build_object(v_tabela, v_linhas);
  end loop;
  return v_dados;
end;
$$;

create or replace function nonatofin_interno.contar_snapshot(p_conteudo jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(e.key, jsonb_array_length(e.value)), '{}'::jsonb)
    from jsonb_each(p_conteudo) e
$$;

create or replace function nonatofin_interno.hash_conteudo(p_conteudo jsonb)
returns text
language sql
immutable
set search_path = ''
as $$ select encode(sha256(convert_to(p_conteudo::text, 'UTF8')), 'hex') $$;

-- Quantidade atual de registros do usuário em cada tabela.
create or replace function nonatofin_interno.contagens_atuais(p_user_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_tabela text;
  v_qtd    bigint;
  v_r      jsonb := '{}'::jsonb;
begin
  foreach v_tabela in array nonatofin_interno.tabelas_backup() loop
    execute format('select count(*) from public.%I t where t.user_id = $1', v_tabela) into v_qtd using p_user_id;
    v_r := v_r || jsonb_build_object(v_tabela, v_qtd);
  end loop;
  return v_r;
end;
$$;

-- -----------------------------------------------------------------------------
-- Validação comum a todas as etapas internas
-- -----------------------------------------------------------------------------
-- 1. usuário logado e autorizado;
-- 2. marca de operação desta transação (gravada só por limpar_dados ou
--    restaurar_backup — clientes da API não conseguem definir variáveis);
-- 3. login com SENHA nos últimos 120 s (claim amr do JWT, gravado pelo
--    Supabase Auth no momento do login; renovar o token não o atualiza).
create or replace function nonatofin_interno.validar_operacao(p_operacoes text[])
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_amr   jsonb := auth.jwt() -> 'amr';
  v_agora numeric := extract(epoch from now());
  v_marca text := current_setting('nonatofin.operacao', true);
begin
  if v_uid is null or not public.usuario_autorizado() then
    raise exception 'Você não tem permissão para esta ação.' using errcode = '42501';
  end if;
  if v_marca is null or not exists (
    select 1 from unnest(p_operacoes) op where v_marca = op || ':' || pg_current_xact_id()::text
  ) then
    raise exception 'Operação não autorizada.' using errcode = '42501';
  end if;
  if jsonb_typeof(v_amr) is distinct from 'array' or not exists (
    select 1
      from jsonb_array_elements(v_amr) a
     where jsonb_typeof(a) = 'object'
       and a ->> 'method' = 'password'
       and jsonb_typeof(a -> 'timestamp') = 'number'
       and (a ->> 'timestamp')::numeric between v_agora - 120 and v_agora + 30
  ) then
    raise exception 'Confirme sua senha para continuar.' using errcode = '28000';
  end if;
  return v_uid;
end;
$$;

-- Marca a transação atual como "operação de dados" e impede execução duplicada.
create or replace function nonatofin_interno.iniciar_operacao(p_operacao text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid;
begin
  perform set_config('nonatofin.operacao', p_operacao || ':' || pg_current_xact_id()::text, true);
  v_uid := nonatofin_interno.validar_operacao(array[p_operacao]);
  if not pg_try_advisory_xact_lock(hashtextextended('nonatofin:dados:' || v_uid::text, 0)) then
    raise exception 'Já existe uma operação de dados em andamento. Aguarde alguns segundos.' using errcode = '55P03';
  end if;
  return v_uid;
end;
$$;

-- -----------------------------------------------------------------------------
-- Etapas privilegiadas (SECURITY DEFINER) — só escrevem nas tabelas internas
-- -----------------------------------------------------------------------------
create or replace function nonatofin_interno.criar_backup(p_nivel text, p_motivo text, p_preservar uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := nonatofin_interno.validar_operacao(array['limpar', 'restaurar']);
  v_conteudo jsonb;
  v_id       uuid;
begin
  v_conteudo := nonatofin_interno.montar_snapshot(v_uid);

  insert into public.backups_dados (user_id, nivel, motivo, versao_formato, assinatura_esquema,
                                    conteudo, contagens, sha256, expira_em)
  values (v_uid, p_nivel, p_motivo, 1, nonatofin_interno.assinatura_esquema(),
          v_conteudo, nonatofin_interno.contar_snapshot(v_conteudo),
          nonatofin_interno.hash_conteudo(v_conteudo), now() + interval '30 days')
  returning id into v_id;

  -- Retenção: 30 dias e no máximo 10 backups (nunca apaga o que será restaurado).
  delete from public.backups_dados b
   where b.user_id = v_uid
     and b.id is distinct from p_preservar
     and (b.expira_em <= now()
          or b.id not in (select x.id from public.backups_dados x
                           where x.user_id = v_uid
                           order by x.criado_em desc, x.id desc
                           limit 10));
  return v_id;
end;
$$;

create or replace function nonatofin_interno.iniciar_restauracao(p_backup_id uuid)
returns public.backups_dados
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := nonatofin_interno.validar_operacao(array['restaurar']);
  v_backup public.backups_dados;
begin
  select * into v_backup from public.backups_dados b
   where b.id = p_backup_id and b.user_id = v_uid
   for update;
  if not found then
    raise exception 'Backup não encontrado.' using errcode = 'P0002';
  end if;
  if v_backup.expira_em <= now() then
    raise exception 'Este backup expirou e não pode mais ser restaurado.' using errcode = '22023';
  end if;
  if v_backup.versao_formato <> 1 or v_backup.assinatura_esquema <> nonatofin_interno.assinatura_esquema() then
    raise exception 'Este backup é de uma versão anterior do banco e não pode ser restaurado automaticamente.'
      using errcode = '22023';
  end if;
  if nonatofin_interno.hash_conteudo(v_backup.conteudo) <> v_backup.sha256 then
    raise exception 'O backup está corrompido (o hash não confere). Nada foi alterado.' using errcode = '22023';
  end if;

  insert into nonatofin_interno.restauracoes_ativas (user_id, xid) values (v_uid, pg_current_xact_id());
  return v_backup;
end;
$$;

create or replace function nonatofin_interno.concluir_restauracao(p_backup_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := nonatofin_interno.validar_operacao(array['restaurar']);
begin
  delete from nonatofin_interno.restauracoes_ativas r where r.user_id = v_uid and r.xid = pg_current_xact_id();
  update public.backups_dados b set restaurado_em = now() where b.id = p_backup_id and b.user_id = v_uid;
end;
$$;

-- Usada pelos gatilhos das parcelas. Verdadeira SOMENTE dentro da transação de
-- uma restauração do próprio usuário (marca gravada por iniciar_restauracao).
create or replace function nonatofin_interno.restauracao_em_andamento(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id = auth.uid()
     and pg_current_xact_id_if_assigned() is not null
     and exists (select 1 from nonatofin_interno.restauracoes_ativas r
                  where r.user_id = p_user_id and r.xid = pg_current_xact_id_if_assigned())
$$;

-- -----------------------------------------------------------------------------
-- Exclusão na ordem segura (como o usuário: RLS + filtro explícito)
-- -----------------------------------------------------------------------------
-- Ordem validada em testes: faturas primeiro (a trava de fatura paga deixa de
-- se aplicar), depois TODAS as parcelas em um único comando (a sincronização
-- encontra soma 0 e nenhuma fatura), compras, demais lançamentos e movimentos.
create or replace function nonatofin_interno.apagar_dados(p_nivel text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := nonatofin_interno.validar_operacao(array['limpar', 'restaurar']);
  v_faturas bigint; v_parcelas bigint; v_compras bigint; v_lancamentos bigint; v_movimentos bigint;
  v_cartoes bigint := 0; v_contas bigint := 0; v_categorias bigint := 0; v_fornecedores bigint := 0; v_empresas bigint := 0;
begin
  delete from public.lancamentos l where l.user_id = v_uid and l.cartao_id is not null;
  get diagnostics v_faturas = row_count;
  delete from public.parcelas_cartao p where p.user_id = v_uid;
  get diagnostics v_parcelas = row_count;
  delete from public.compras_cartao c where c.user_id = v_uid;
  get diagnostics v_compras = row_count;
  delete from public.lancamentos l where l.user_id = v_uid;
  get diagnostics v_lancamentos = row_count;
  delete from public.movimentos_conta m where m.user_id = v_uid;
  get diagnostics v_movimentos = row_count;

  if p_nivel = 'completo' then
    delete from public.cartoes c where c.user_id = v_uid;
    get diagnostics v_cartoes = row_count;
    delete from public.contas_bancarias c where c.user_id = v_uid;
    get diagnostics v_contas = row_count;
    delete from public.categorias c where c.user_id = v_uid;
    get diagnostics v_categorias = row_count;
    delete from public.fornecedores f where f.user_id = v_uid;
    get diagnostics v_fornecedores = row_count;
    delete from public.empresas e where e.user_id = v_uid;
    get diagnostics v_empresas = row_count;
  end if;

  return jsonb_build_object(
    'lancamentos', v_faturas + v_lancamentos, 'parcelas_cartao', v_parcelas, 'compras_cartao', v_compras,
    'movimentos_conta', v_movimentos, 'cartoes', v_cartoes, 'contas_bancarias', v_contas,
    'categorias', v_categorias, 'fornecedores', v_fornecedores, 'empresas', v_empresas);
end;
$$;

-- Integridade financeira depois de restaurar.
create or replace function nonatofin_interno.verificar_integridade(p_user_id uuid)
returns void
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.lancamentos f
     where f.user_id = p_user_id and f.cartao_id is not null
       and f.valor_centavos <> f.ajuste_centavos + coalesce((
             select sum(p.valor_centavos) from public.parcelas_cartao p
              where p.cartao_id = f.cartao_id and p.fatura_mes = f.fatura_mes), 0)
  ) then
    raise exception 'Verificação de integridade falhou: valor de fatura diferente da soma das parcelas. Nada foi alterado.'
      using errcode = '22023';
  end if;
  if exists (
    select 1 from public.parcelas_cartao p
     where p.user_id = p_user_id
       and not exists (select 1 from public.lancamentos f where f.cartao_id = p.cartao_id and f.fatura_mes = p.fatura_mes)
  ) then
    raise exception 'Verificação de integridade falhou: parcela sem fatura. Nada foi alterado.' using errcode = '22023';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Gatilhos das parcelas: durante uma restauração autorizada, as parcelas são
-- reinseridas exatamente como estavam (inclusive em faturas pagas) e a fatura
-- NÃO é recalculada — ela também volta do backup. A integridade é conferida
-- no fim por verificar_integridade (senão, tudo é desfeito).
-- -----------------------------------------------------------------------------
create or replace function public.parcelas_bloquear_fatura_paga()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Excluir a conta inteira apaga tudo, inclusive faturas pagas.
  if tg_op = 'DELETE' and public.conta_em_exclusao(old.user_id) then
    return old;
  end if;
  -- Restauração autorizada de backup (somente inserção, somente nesta transação).
  -- IF aninhado: exclusões/alterações nunca consultam o schema interno.
  if tg_op = 'INSERT' then
    if nonatofin_interno.restauracao_em_andamento(new.user_id) then
      return new;
    end if;
  end if;
  if tg_op in ('UPDATE', 'DELETE') and public.fatura_esta_paga(old.cartao_id, old.fatura_mes) then
    raise exception 'A fatura de % já está paga. Desfaça o pagamento dela para alterar as compras.',
      public.rotulo_competencia(old.fatura_mes) using errcode = '22023';
  end if;
  if tg_op in ('INSERT', 'UPDATE') and public.fatura_esta_paga(new.cartao_id, new.fatura_mes) then
    raise exception 'A fatura de % já está paga. Escolha uma fatura seguinte ou desfaça o pagamento.',
      public.rotulo_competencia(new.fatura_mes) using errcode = '22023';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.parcelas_sincronizar_faturas()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and public.conta_em_exclusao(old.user_id) then
    return null; -- a conta inteira está sendo apagada
  end if;
  if tg_op = 'INSERT' then
    if nonatofin_interno.restauracao_em_andamento(new.user_id) then
      return null; -- a fatura volta do backup com o valor original
    end if;
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.sincronizar_fatura(old.cartao_id, old.fatura_mes);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.sincronizar_fatura(new.cartao_id, new.fatura_mes);
  end if;
  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPCs públicas
-- -----------------------------------------------------------------------------

-- Quantidades para a tela (somente leitura).
create or replace function public.resumo_dados()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.usuario_autorizado() then
    raise exception 'Você não tem permissão para esta ação.' using errcode = '42501';
  end if;
  return nonatofin_interno.contagens_atuais(auth.uid());
end;
$$;

-- Backup completo dos dados atuais para download (somente leitura).
create or replace function public.exportar_dados()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_conteudo jsonb;
begin
  if auth.uid() is null or not public.usuario_autorizado() then
    raise exception 'Você não tem permissão para esta ação.' using errcode = '42501';
  end if;
  v_conteudo := nonatofin_interno.montar_snapshot(auth.uid());
  return jsonb_build_object(
    'versao_formato', 1,
    'assinatura_esquema', nonatofin_interno.assinatura_esquema(),
    'contagens', nonatofin_interno.contar_snapshot(v_conteudo),
    'sha256', nonatofin_interno.hash_conteudo(v_conteudo),
    'conteudo', v_conteudo);
end;
$$;

-- Opção 1 (financeiro) ou 2 (completo). Atômica: backup + exclusão na mesma
-- transação; qualquer erro desfaz tudo.
create or replace function public.limpar_dados(p_nivel text, p_frase text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid       uuid;
  v_contagens jsonb;
  v_alvo      bigint;
  v_backup    uuid;
  v_apagados  jsonb;
begin
  if p_nivel is null or p_nivel not in ('financeiro', 'completo') then
    raise exception 'Opção de limpeza inválida.' using errcode = '22023';
  end if;
  v_uid := nonatofin_interno.iniciar_operacao('limpar');
  if p_frase is distinct from (case p_nivel when 'financeiro' then 'LIMPAR DADOS FINANCEIROS'
                                            else 'REINICIAR NONATOFIN' end) then
    raise exception 'A frase de confirmação não confere.' using errcode = '22023';
  end if;

  v_contagens := nonatofin_interno.contagens_atuais(v_uid);
  select coalesce(sum((v_contagens ->> t)::bigint), 0) into v_alvo
    from unnest(nonatofin_interno.tabelas_do_nivel(p_nivel)) t;
  if v_alvo = 0 then
    raise exception 'Não há dados para apagar.' using errcode = '22023';
  end if;

  -- Sem backup, sem limpeza.
  v_backup := nonatofin_interno.criar_backup(p_nivel, 'limpeza');
  if v_backup is null then
    raise exception 'Não foi possível criar o backup. Nada foi apagado.';
  end if;

  v_apagados := nonatofin_interno.apagar_dados(p_nivel);
  perform set_config('nonatofin.operacao', '', true);
  return jsonb_build_object('backup_id', v_backup, 'apagados', v_apagados);
end;
$$;

-- Restaura um backup: guarda o estado atual em um novo backup, apaga o escopo
-- do backup (financeiro ou completo) e reinsere os dados originais (mesmos
-- ids). Confere hash, versão do banco, quantidades e integridade financeira.
create or replace function public.restaurar_backup(p_backup_id uuid, p_frase text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid      uuid;
  v_backup   public.backups_dados;
  v_anterior uuid;
  v_tabelas  text[];
  v_tabela   text;
  v_colunas  text;
  v_linhas   jsonb;
  v_qtd      bigint;
  v_resumo   jsonb := '{}'::jsonb;
begin
  v_uid := nonatofin_interno.iniciar_operacao('restaurar');
  if p_frase is distinct from 'RESTAURAR BACKUP' then
    raise exception 'A frase de confirmação não confere.' using errcode = '22023';
  end if;

  v_backup := nonatofin_interno.iniciar_restauracao(p_backup_id);
  v_anterior := nonatofin_interno.criar_backup(v_backup.nivel, 'antes_da_restauracao', p_backup_id);
  v_tabelas := nonatofin_interno.tabelas_do_nivel(v_backup.nivel);

  perform nonatofin_interno.apagar_dados(v_backup.nivel);

  foreach v_tabela in array nonatofin_interno.tabelas_backup() loop
    continue when not (v_tabela = any (v_tabelas));
    v_linhas := coalesce(v_backup.conteudo -> v_tabela, '[]'::jsonb);
    v_colunas := nonatofin_interno.colunas_restauraveis(v_tabela);
    execute format('insert into public.%I (user_id, %s) select $1, %s from jsonb_populate_recordset(null::public.%I, $2)',
                   v_tabela, v_colunas, v_colunas, v_tabela)
      using v_uid, v_linhas;
    get diagnostics v_qtd = row_count;
    if v_qtd <> jsonb_array_length(v_linhas) then
      raise exception 'Verificação de integridade falhou em %. Nada foi alterado.', v_tabela using errcode = '22023';
    end if;
    v_resumo := v_resumo || jsonb_build_object(v_tabela, v_qtd);
  end loop;

  perform nonatofin_interno.verificar_integridade(v_uid);
  perform nonatofin_interno.concluir_restauracao(p_backup_id);
  perform set_config('nonatofin.operacao', '', true);
  return jsonb_build_object('backup_id', p_backup_id, 'backup_anterior_id', v_anterior,
                            'nivel', v_backup.nivel, 'restaurados', v_resumo);
end;
$$;

-- -----------------------------------------------------------------------------
-- Permissões das funções
-- -----------------------------------------------------------------------------
do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'nonatofin_interno'
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end
$$;

-- Os gatilhos das parcelas também rodam para papéis administrativos (scripts
-- com service_role): eles só precisam LER se há restauração em andamento.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant usage on schema nonatofin_interno to service_role;
    grant execute on function nonatofin_interno.restauracao_em_andamento(uuid) to service_role;
  end if;
end
$$;

revoke all on function public.resumo_dados() from public, anon;
revoke all on function public.exportar_dados() from public, anon;
revoke all on function public.limpar_dados(text, text) from public, anon;
revoke all on function public.restaurar_backup(uuid, text) from public, anon;
grant execute on function public.resumo_dados() to authenticated;
grant execute on function public.exportar_dados() to authenticated;
grant execute on function public.limpar_dados(text, text) to authenticated;
grant execute on function public.restaurar_backup(uuid, text) to authenticated;
