-- =============================================================================
-- NonatoFin — Migration: importação de lançamentos (CSV) e lançamentos sem empresa
-- =============================================================================
-- Decisões importantes:
--  * Lançamentos importados entram SEM empresa definida (a empresa é atribuída
--    depois, inclusive em lote). Por isso `lancamentos.empresa_id` passa a
--    aceitar null. Faturas de cartão continuam sempre com empresa.
--  * A FK composta da conta (conta_id, empresa_id, user_id) é MATCH SIMPLE: com
--    empresa_id null o Postgres não a confere. A regra "conta só com empresa"
--    fecha essa brecha (senão um lançamento sem empresa poderia apontar para a
--    conta de qualquer empresa).
--  * Nenhuma coluna nova em `lancamentos` (nem nas outras 8 tabelas do backup):
--    a assinatura do esquema dos backups não muda e os backups já existentes
--    continuam restauráveis. Tirar o "not null" não altera a assinatura (ela
--    usa nome e tipo das colunas).
--  * Os metadados da importação (lote, chave de cada linha, conta original,
--    valor estimado) ficam em `importacoes` e `importacao_itens`, fora do
--    backup. O item é apagado junto com o lançamento (cascade): a chave
--    representa sempre um lançamento importado que ainda existe.
--  * As funções são SECURITY INVOKER (RLS aplicada) e usam a mesma trava por
--    usuário das operações de dados (limpeza/restauração não rodam junto).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- LANÇAMENTOS: empresa opcional
-- -----------------------------------------------------------------------------
alter table public.lancamentos
  alter column empresa_id drop not null,
  add constraint lancamentos_conta_exige_empresa
    check (conta_id is null or empresa_id is not null),
  add constraint lancamentos_fatura_exige_empresa
    check (cartao_id is null or empresa_id is not null),
  -- Alvo da FK composta dos itens de importação (anti-IDOR).
  add constraint lancamentos_id_user_unique unique (id, user_id);

comment on column public.lancamentos.empresa_id is
  'Empresa do lançamento. Null = sem empresa definida (lançamentos importados); faturas sempre têm empresa.';

create index lancamentos_sem_empresa_idx on public.lancamentos (user_id, vencimento) where empresa_id is null;

-- -----------------------------------------------------------------------------
-- IMPORTAÇÕES (um registro por lote importado)
-- -----------------------------------------------------------------------------
create table public.importacoes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  arquivo_nome    text not null,
  arquivo_sha256  text not null,
  periodo_de      date not null,
  periodo_ate     date not null,
  linhas_arquivo  integer not null,
  importados      integer not null default 0,
  total_centavos  bigint not null default 0,
  -- Contagens por motivo, linhas separadas para conferência e coincidências decididas na prévia.
  resumo          jsonb not null default '{}'::jsonb,
  status          text not null default 'concluida',
  removidos       integer not null default 0,
  criado_em       timestamptz not null default now(),
  desfeita_em     timestamptz,

  constraint importacoes_id_user_unique unique (id, user_id),
  constraint importacoes_arquivo_nome_tamanho check (char_length(btrim(arquivo_nome)) between 1 and 200),
  constraint importacoes_sha256_formato check (arquivo_sha256 ~ '^[0-9a-f]{64}$'),
  constraint importacoes_periodo_valido check (periodo_de <= periodo_ate),
  constraint importacoes_contagens check (linhas_arquivo >= 0 and importados >= 0 and removidos >= 0 and total_centavos >= 0),
  constraint importacoes_resumo_objeto check (jsonb_typeof(resumo) = 'object' and pg_column_size(resumo) <= 1000000),
  constraint importacoes_status_valido check (status in ('concluida', 'desfeita')),
  constraint importacoes_desfeita_consistente check ((status = 'desfeita') = (desfeita_em is not null))
);

comment on table public.importacoes is 'Lotes de lançamentos importados de planilhas (CSV). Fora do backup.';

create index importacoes_user_criado_idx on public.importacoes (user_id, criado_em desc);

-- -----------------------------------------------------------------------------
-- ITENS DA IMPORTAÇÃO (um por lançamento criado)
-- -----------------------------------------------------------------------------
create table public.importacao_itens (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  importacao_id    uuid not null,
  lancamento_id    uuid not null,
  -- Identidade da linha do arquivo: data | valor | descrição | conta | ocorrência.
  chave            text not null,
  linha            integer not null,
  conta_origem     text,
  categoria_origem text,
  valor_estimado   boolean not null default false,
  created_at       timestamptz not null default now(),

  constraint importacao_itens_importacao_fk foreign key (importacao_id, user_id)
    references public.importacoes (id, user_id) on delete cascade,
  constraint importacao_itens_lancamento_fk foreign key (lancamento_id, user_id)
    references public.lancamentos (id, user_id) on delete cascade,
  constraint importacao_itens_chave_unica unique (user_id, chave),
  constraint importacao_itens_lancamento_unico unique (lancamento_id),
  constraint importacao_itens_chave_tamanho check (char_length(chave) between 1 and 600),
  constraint importacao_itens_linha_valida check (linha >= 1),
  constraint importacao_itens_conta_tamanho check (conta_origem is null or char_length(conta_origem) <= 120),
  constraint importacao_itens_categoria_tamanho check (categoria_origem is null or char_length(categoria_origem) <= 120)
);

comment on table public.importacao_itens is 'Lançamentos criados por cada importação (chave da linha do arquivo, conta original, valor estimado).';

create index importacao_itens_importacao_idx on public.importacao_itens (importacao_id);

-- -----------------------------------------------------------------------------
-- RLS (mesmo padrão das demais tabelas)
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['importacoes', 'importacao_itens'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
    execute format($p$create policy %I on public.%I for select to authenticated
      using (user_id = (select auth.uid()) and (select public.usuario_autorizado()))$p$, t || '_select', t);
    execute format($p$create policy %I on public.%I for insert to authenticated
      with check (user_id = (select auth.uid()) and (select public.usuario_autorizado()))$p$, t || '_insert', t);
    execute format($p$create policy %I on public.%I for update to authenticated
      using (user_id = (select auth.uid()) and (select public.usuario_autorizado()))
      with check (user_id = (select auth.uid()) and (select public.usuario_autorizado()))$p$, t || '_update', t);
    execute format($p$create policy %I on public.%I for delete to authenticated
      using (user_id = (select auth.uid()) and (select public.usuario_autorizado()))$p$, t || '_delete', t);
  end loop;
end
$$;

-- -----------------------------------------------------------------------------
-- Trava por usuário compartilhada com limpeza/restauração de dados.
-- -----------------------------------------------------------------------------
create or replace function public.travar_operacao_dados()
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not (select public.usuario_autorizado()) then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  if not pg_try_advisory_xact_lock(hashtextextended('nonatofin:dados:' || v_uid::text, 0)) then
    raise exception 'Já existe uma operação de dados em andamento. Aguarde alguns segundos.' using errcode = '55P03';
  end if;
  return v_uid;
end;
$$;
revoke all on function public.travar_operacao_dados() from public, anon;
grant execute on function public.travar_operacao_dados() to authenticated;

-- -----------------------------------------------------------------------------
-- IMPORTAR: grava o lote inteiro numa única transação (tudo ou nada).
-- Linhas cuja chave já foi importada são ignoradas (idempotente).
-- Todo lançamento entra pendente, sem empresa e sem conta.
-- -----------------------------------------------------------------------------
create or replace function public.importar_lancamentos(
  p_arquivo_nome   text,
  p_arquivo_sha256 text,
  p_periodo_de     date,
  p_periodo_ate    date,
  p_linhas_arquivo integer,
  p_resumo         jsonb,
  p_linhas         jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid        uuid;
  v_lote       uuid;
  v_linha      record;
  v_fornecedor uuid;
  v_categoria  uuid;
  v_lancamento uuid;
  v_nome       text;
  v_importados integer := 0;
  v_ja         integer := 0;
  v_total      bigint := 0;
begin
  v_uid := public.travar_operacao_dados();

  if p_linhas is null or jsonb_typeof(p_linhas) <> 'array' then
    raise exception 'Nenhuma linha para importar.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_linhas) = 0 then
    raise exception 'Nenhuma linha para importar.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_linhas) > 3000 then
    raise exception 'Arquivo grande demais: importe no máximo 3.000 lançamentos por vez.' using errcode = '22023';
  end if;
  if p_periodo_de is null or p_periodo_ate is null or p_periodo_de > p_periodo_ate then
    raise exception 'Período inválido.' using errcode = '22023';
  end if;

  insert into public.importacoes (arquivo_nome, arquivo_sha256, periodo_de, periodo_ate, linhas_arquivo, resumo)
  values (btrim(p_arquivo_nome), p_arquivo_sha256, p_periodo_de, p_periodo_ate, coalesce(p_linhas_arquivo, 0),
          coalesce(p_resumo, '{}'::jsonb))
  returning id into v_lote;

  for v_linha in
    select *
      from jsonb_to_recordset(p_linhas) as x(
        chave text, linha integer, vencimento date, descricao text, valor_centavos bigint,
        fornecedor text, categoria text, codigo_barras text, observacao text,
        conta_origem text, categoria_origem text, valor_estimado boolean)
     order by x.linha
  loop
    if v_linha.chave is null or v_linha.linha is null or v_linha.vencimento is null
       or v_linha.descricao is null or v_linha.valor_centavos is null
       or v_linha.fornecedor is null or v_linha.categoria is null then
      raise exception 'Linha % incompleta.', coalesce(v_linha.linha::text, '?') using errcode = '22023';
    end if;
    if v_linha.vencimento < p_periodo_de or v_linha.vencimento > p_periodo_ate then
      raise exception 'Linha % fora do período escolhido.', v_linha.linha using errcode = '22023';
    end if;

    -- Já importada antes (ou repetida neste lote): ignora.
    if exists (select 1 from public.importacao_itens i where i.user_id = v_uid and i.chave = v_linha.chave) then
      v_ja := v_ja + 1;
      continue;
    end if;

    v_fornecedor := public.obter_ou_criar_fornecedor(v_linha.fornecedor);

    v_nome := regexp_replace(btrim(v_linha.categoria), '\s+', ' ', 'g');
    v_categoria := null;
    insert into public.categorias (nome, ordem)
    values (v_nome, 100)
    on conflict (user_id, nome_normalizado) do nothing
    returning id into v_categoria;
    if v_categoria is null then
      select c.id into v_categoria from public.categorias c
       where c.user_id = v_uid and c.nome_normalizado = public.normalizar_nome(v_nome);
    end if;

    insert into public.lancamentos (fornecedor_id, categoria_id, empresa_id, conta_id, descricao, valor_centavos,
                                    vencimento, codigo_barras, observacao, status)
    values (v_fornecedor, v_categoria, null, null, regexp_replace(btrim(v_linha.descricao), '\s+', ' ', 'g'),
            v_linha.valor_centavos, v_linha.vencimento, nullif(v_linha.codigo_barras, ''), nullif(btrim(v_linha.observacao), ''),
            'pendente')
    returning id into v_lancamento;

    insert into public.importacao_itens (importacao_id, lancamento_id, chave, linha, conta_origem, categoria_origem, valor_estimado)
    values (v_lote, v_lancamento, v_linha.chave, v_linha.linha, nullif(btrim(v_linha.conta_origem), ''),
            nullif(btrim(v_linha.categoria_origem), ''), coalesce(v_linha.valor_estimado, false));

    v_importados := v_importados + 1;
    v_total := v_total + v_linha.valor_centavos;
  end loop;

  if v_importados = 0 then
    raise exception 'Todas as linhas escolhidas já foram importadas antes. Nada foi gravado.' using errcode = '22023';
  end if;

  update public.importacoes
     set importados = v_importados,
         total_centavos = v_total
   where id = v_lote;

  return jsonb_build_object('importacao_id', v_lote, 'importados', v_importados, 'ja_importados', v_ja,
                            'total_centavos', v_total);
end;
$$;
revoke all on function public.importar_lancamentos(text, text, date, date, integer, jsonb, jsonb) from public, anon;
grant execute on function public.importar_lancamentos(text, text, date, date, integer, jsonb, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- DESFAZER: apaga os lançamentos do lote que continuam PENDENTES.
-- Os já pagos ficam (o pagamento é um fato e mexe no saldo). Como os itens
-- saem junto, as linhas removidas podem ser importadas de novo.
-- -----------------------------------------------------------------------------
create or replace function public.desfazer_importacao(p_importacao_id uuid, p_frase text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid       uuid;
  v_lote      public.importacoes;
  v_removidos integer;
  v_mantidos  integer;
begin
  v_uid := public.travar_operacao_dados();
  if p_frase is distinct from 'DESFAZER IMPORTACAO' then
    raise exception 'A frase de confirmação não confere.' using errcode = '22023';
  end if;

  select * into v_lote from public.importacoes i
   where i.id = p_importacao_id and i.user_id = v_uid
   for update;
  if not found then
    raise exception 'Importação não encontrada.' using errcode = 'P0002';
  end if;
  if v_lote.status <> 'concluida' then
    raise exception 'Esta importação já foi desfeita.' using errcode = '22023';
  end if;

  delete from public.lancamentos l
   using public.importacao_itens i
   where i.importacao_id = v_lote.id
     and i.user_id = v_uid
     and l.id = i.lancamento_id
     and l.status = 'pendente'
     and l.cartao_id is null;
  get diagnostics v_removidos = row_count;

  select count(*) into v_mantidos from public.importacao_itens i where i.importacao_id = v_lote.id;

  update public.importacoes
     set status = 'desfeita', desfeita_em = now(), removidos = v_removidos
   where id = v_lote.id;

  return jsonb_build_object('removidos', v_removidos, 'mantidos', v_mantidos);
end;
$$;
revoke all on function public.desfazer_importacao(uuid, text) from public, anon;
grant execute on function public.desfazer_importacao(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- ATRIBUIR EMPRESA EM LOTE: só lançamentos SEM empresa (nunca faturas).
-- Opcionalmente coloca a conta padrão da empresa nos que estão pendentes;
-- os já pagos ficam sem conta (não mexe no saldo retroativamente).
-- -----------------------------------------------------------------------------
create or replace function public.atribuir_empresa_lancamentos(
  p_ids                  uuid[],
  p_empresa_id           uuid,
  p_aplicar_conta_padrao boolean
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_conta uuid;
  v_qtd   integer;
begin
  if v_uid is null or not (select public.usuario_autorizado()) then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  if p_ids is null or cardinality(p_ids) = 0 then
    raise exception 'Selecione ao menos um lançamento.' using errcode = '22023';
  end if;
  if cardinality(p_ids) > 5000 then
    raise exception 'Selecione no máximo 5.000 lançamentos por vez.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.empresas e where e.id = p_empresa_id and e.user_id = v_uid) then
    raise exception 'Empresa não encontrada.' using errcode = 'P0002';
  end if;

  if coalesce(p_aplicar_conta_padrao, false) then
    select c.id into v_conta from public.contas_bancarias c
     where c.empresa_id = p_empresa_id and c.user_id = v_uid and c.padrao and c.ativa;
  end if;

  update public.lancamentos l
     set empresa_id = p_empresa_id,
         conta_id   = case when l.status = 'pendente' then v_conta else null end
   where l.id = any (p_ids)
     and l.user_id = v_uid
     and l.empresa_id is null
     and l.cartao_id is null;
  get diagnostics v_qtd = row_count;
  return v_qtd;
end;
$$;
revoke all on function public.atribuir_empresa_lancamentos(uuid[], uuid, boolean) from public, anon;
grant execute on function public.atribuir_empresa_lancamentos(uuid[], uuid, boolean) to authenticated;
