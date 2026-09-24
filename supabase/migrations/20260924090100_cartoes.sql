-- =============================================================================
-- NonatoFin — Migration 006: cartões de crédito, compras parceladas e faturas
--
-- Modelo:
--   cartoes          -> cartão (empresa, emissor, dias de fechamento/vencimento)
--   compras_cartao   -> compra (valor total, nº de parcelas, 1ª fatura)
--   parcelas_cartao  -> parcela de uma compra, ligada a uma competência (AAAA-MM)
--   lancamentos          -> a FATURA de cada cartão/competência é um lançamento a
--                       pagar comum (cartao_id + fatura_mes), mantido em
--                       sincronia AUTOMATICAMENTE por gatilhos:
--                       valor = soma das parcelas + ajuste_centavos.
-- Regras (iguais a src/lib/domain/cartoes.ts):
--   * vencimento = dia de vencimento no mês da competência (ou último dia);
--   * sobra de centavos da divisão vai para a 1ª parcela;
--   * fatura PAGA fica travada: não aceita incluir/alterar/excluir parcelas.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Utilitários de competência "AAAA-MM"
-- -----------------------------------------------------------------------------
create or replace function public.competencia_valida(p_mes text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$ select p_mes ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' $$;

create or replace function public.data_na_competencia(p_mes text, p_dia int)
returns date
language sql
immutable
parallel safe
set search_path = ''
as $$
  select make_date(
    split_part(p_mes, '-', 1)::int,
    split_part(p_mes, '-', 2)::int,
    least(p_dia, extract(day from ((p_mes || '-01')::date + interval '1 month - 1 day'))::int)
  )
$$;

create or replace function public.somar_meses_competencia(p_mes text, p_meses int)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$ select to_char((p_mes || '-01')::date + make_interval(months => p_meses), 'YYYY-MM') $$;

create or replace function public.rotulo_competencia(p_mes text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select (array['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto',
                'Setembro','Outubro','Novembro','Dezembro'])[split_part(p_mes, '-', 2)::int]
         || '/' || split_part(p_mes, '-', 1)
$$;

-- -----------------------------------------------------------------------------
-- CARTÕES
-- -----------------------------------------------------------------------------
create table public.cartoes (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  empresa_id          uuid not null,
  fornecedor_id       uuid not null,   -- emissor (banco) — credor da fatura
  categoria_fatura_id uuid not null,   -- categoria das faturas (ex.: Cartão de crédito)
  nome                text not null,
  nome_normalizado    text generated always as (public.normalizar_nome(nome)) stored,
  final               text,
  dia_fechamento      smallint not null,
  dia_vencimento      smallint not null,
  ativo               boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint cartoes_nome_tamanho check (char_length(btrim(nome)) between 1 and 60),
  constraint cartoes_final_formato check (final is null or final ~ '^[0-9]{4}$'),
  constraint cartoes_dias check (dia_fechamento between 1 and 31 and dia_vencimento between 1 and 31
                                 and dia_fechamento <> dia_vencimento),
  constraint cartoes_id_user_unique unique (id, user_id),
  constraint cartoes_nome_unico unique (user_id, nome_normalizado),
  constraint cartoes_empresa_fk foreign key (empresa_id, user_id)
    references public.empresas (id, user_id) on delete restrict,
  constraint cartoes_fornecedor_fk foreign key (fornecedor_id, user_id)
    references public.fornecedores (id, user_id) on delete restrict,
  constraint cartoes_categoria_fk foreign key (categoria_fatura_id, user_id)
    references public.categorias (id, user_id) on delete restrict
);

create trigger cartoes_updated_at
  before update on public.cartoes
  for each row execute function public.definir_updated_at();

-- -----------------------------------------------------------------------------
-- COMPRAS
-- -----------------------------------------------------------------------------
create table public.compras_cartao (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null default auth.uid() references auth.users (id) on delete cascade,
  cartao_id            uuid not null,
  categoria_id         uuid not null,
  descricao            text not null,
  data_compra          date not null,
  valor_total_centavos bigint not null,
  parcelas             smallint not null,
  primeira_fatura_mes  text not null,
  observacao           text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint compras_descricao_tamanho check (char_length(btrim(descricao)) between 1 and 200),
  constraint compras_valor check (valor_total_centavos > 0 and valor_total_centavos <= 100000000000),
  constraint compras_parcelas check (parcelas between 1 and 48 and valor_total_centavos >= parcelas),
  constraint compras_primeira_fatura check (public.competencia_valida(primeira_fatura_mes)),
  constraint compras_data check (data_compra between date '2000-01-01' and date '2100-12-31'),
  constraint compras_observacao_tamanho check (observacao is null or char_length(observacao) <= 1000),
  constraint compras_id_user_unique unique (id, user_id),
  constraint compras_cartao_fk foreign key (cartao_id, user_id)
    references public.cartoes (id, user_id) on delete restrict,
  constraint compras_categoria_fk foreign key (categoria_id, user_id)
    references public.categorias (id, user_id) on delete restrict
);

create index compras_cartao_idx on public.compras_cartao (cartao_id, data_compra);

create trigger compras_cartao_updated_at
  before update on public.compras_cartao
  for each row execute function public.definir_updated_at();

-- -----------------------------------------------------------------------------
-- PARCELAS
-- -----------------------------------------------------------------------------
create table public.parcelas_cartao (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  compra_id      uuid not null,
  cartao_id      uuid not null,
  numero         smallint not null,
  total          smallint not null,
  valor_centavos bigint not null,
  fatura_mes     text not null,

  constraint parcelas_numero check (total between 1 and 48 and numero between 1 and total),
  constraint parcelas_valor check (valor_centavos > 0),
  constraint parcelas_competencia check (public.competencia_valida(fatura_mes)),
  constraint parcelas_unica unique (compra_id, numero),
  constraint parcelas_compra_fk foreign key (compra_id, user_id)
    references public.compras_cartao (id, user_id) on delete cascade,
  constraint parcelas_cartao_fk foreign key (cartao_id, user_id)
    references public.cartoes (id, user_id) on delete restrict
);

create index parcelas_fatura_idx on public.parcelas_cartao (cartao_id, fatura_mes);

-- -----------------------------------------------------------------------------
-- BOLETOS: campos de fatura
-- -----------------------------------------------------------------------------
alter table public.lancamentos
  add column cartao_id       uuid,
  add column fatura_mes      text,
  add column ajuste_centavos bigint not null default 0,
  add constraint lancamentos_cartao_fk foreign key (cartao_id, user_id)
    references public.cartoes (id, user_id) on delete restrict,
  add constraint lancamentos_fatura_consistente check (
    (cartao_id is null and fatura_mes is null and ajuste_centavos = 0)
    or (cartao_id is not null and public.competencia_valida(fatura_mes) and serie_id is null)
  ),
  add constraint lancamentos_ajuste_faixa check (ajuste_centavos between -100000000000 and 100000000000),
  add constraint lancamentos_fatura_unica unique (cartao_id, fatura_mes);

-- -----------------------------------------------------------------------------
-- RLS (mesmo padrão das demais tabelas)
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['cartoes', 'compras_cartao', 'parcelas_cartao'] loop
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
-- Sincroniza a fatura (lançamento a pagar) de um cartão/competência:
-- cria, atualiza o valor ou remove (se ficou vazia e não tem nada do usuário).
-- -----------------------------------------------------------------------------
create or replace function public.sincronizar_fatura(p_cartao_id uuid, p_mes text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_soma   bigint;
  v_fatura public.lancamentos;
  v_cartao public.cartoes;
begin
  select coalesce(sum(p.valor_centavos), 0) into v_soma
    from public.parcelas_cartao p
   where p.cartao_id = p_cartao_id and p.fatura_mes = p_mes;

  select * into v_fatura from public.lancamentos b
   where b.cartao_id = p_cartao_id and b.fatura_mes = p_mes
   for update;

  if not found then
    if v_soma > 0 then
      select * into v_cartao from public.cartoes c where c.id = p_cartao_id;
      insert into public.lancamentos (user_id, empresa_id, categoria_id, fornecedor_id, descricao,
                                  valor_centavos, vencimento, cartao_id, fatura_mes)
      values (v_cartao.user_id, v_cartao.empresa_id, v_cartao.categoria_fatura_id, v_cartao.fornecedor_id,
              'Fatura ' || v_cartao.nome || ' — ' || public.rotulo_competencia(p_mes),
              v_soma, public.data_na_competencia(p_mes, v_cartao.dia_vencimento), v_cartao.id, p_mes);
    end if;
    return;
  end if;

  if v_soma = 0 and v_fatura.ajuste_centavos = 0 and v_fatura.status = 'pendente'
     and v_fatura.codigo_barras is null and v_fatura.observacao is null then
    delete from public.lancamentos b where b.id = v_fatura.id;
    return;
  end if;

  if v_soma + v_fatura.ajuste_centavos <= 0 then
    raise exception 'O valor da fatura de % ficaria zerado ou negativo.', public.rotulo_competencia(p_mes)
      using errcode = '22023';
  end if;

  update public.lancamentos b
     set valor_centavos = v_soma + v_fatura.ajuste_centavos
   where b.id = v_fatura.id and b.valor_centavos <> v_soma + v_fatura.ajuste_centavos;
end;
$$;

-- Trava: parcelas de fatura já paga não podem ser incluídas/alteradas/excluídas.
create or replace function public.fatura_esta_paga(p_cartao_id uuid, p_mes text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (select 1 from public.lancamentos b
                  where b.cartao_id = p_cartao_id and b.fatura_mes = p_mes and b.status = 'pago')
$$;

-- Verdadeiro quando a conta dona do registro já foi apagada (exclusão em
-- cascata a partir de auth.users). Só responde sobre a própria conta ou
-- quando não há usuário logado (operação administrativa).
create or replace function public.conta_em_exclusao(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (auth.uid() is null or auth.uid() = p_user_id)
     and not exists (select 1 from auth.users u where u.id = p_user_id)
$$;
revoke all on function public.conta_em_exclusao(uuid) from public, anon;
grant execute on function public.conta_em_exclusao(uuid) to authenticated;
-- A exclusão de conta (auth.users -> cascata) é feita pelo papel do Auth.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant execute on function public.conta_em_exclusao(uuid) to supabase_auth_admin;
  end if;
end;
$$;

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

create trigger parcelas_trava_fatura_paga
  before insert or update or delete on public.parcelas_cartao
  for each row execute function public.parcelas_bloquear_fatura_paga();

-- Depois de mexer em parcelas: sincroniza as faturas afetadas.
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
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.sincronizar_fatura(old.cartao_id, old.fatura_mes);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.sincronizar_fatura(new.cartao_id, new.fatura_mes);
  end if;
  return null;
end;
$$;

create trigger parcelas_sincroniza_faturas
  after insert or update or delete on public.parcelas_cartao
  for each row execute function public.parcelas_sincronizar_faturas();

-- Alterações no cartão refletem nas faturas ainda não pagas.
create or replace function public.cartoes_propagar_faturas()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.lancamentos b
     set empresa_id    = new.empresa_id,
         fornecedor_id = new.fornecedor_id,
         categoria_id  = new.categoria_fatura_id,
         descricao     = 'Fatura ' || new.nome || ' — ' || public.rotulo_competencia(b.fatura_mes),
         vencimento    = public.data_na_competencia(b.fatura_mes, new.dia_vencimento)
   where b.cartao_id = new.id and b.status = 'pendente';
  return null;
end;
$$;

create trigger cartoes_propaga_faturas
  after update of empresa_id, fornecedor_id, categoria_fatura_id, nome, dia_vencimento on public.cartoes
  for each row execute function public.cartoes_propagar_faturas();

-- -----------------------------------------------------------------------------
-- Gera as parcelas de uma compra (divisão com sobra na 1ª).
-- -----------------------------------------------------------------------------
create or replace function public.gerar_parcelas_compra(p_compra_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_compra public.compras_cartao;
  v_base   bigint;
  v_sobra  bigint;
begin
  select * into v_compra from public.compras_cartao c where c.id = p_compra_id;
  if not found then
    raise exception 'Compra não encontrada.' using errcode = 'P0002';
  end if;
  v_base  := v_compra.valor_total_centavos / v_compra.parcelas;
  v_sobra := v_compra.valor_total_centavos - v_base * v_compra.parcelas;

  insert into public.parcelas_cartao (user_id, compra_id, cartao_id, numero, total, valor_centavos, fatura_mes)
  select v_compra.user_id, v_compra.id, v_compra.cartao_id, n, v_compra.parcelas,
         case when n = 1 then v_base + v_sobra else v_base end,
         public.somar_meses_competencia(v_compra.primeira_fatura_mes, n - 1)
    from generate_series(1, v_compra.parcelas) as n;
end;
$$;
revoke all on function public.gerar_parcelas_compra(uuid) from public, anon;
grant execute on function public.gerar_parcelas_compra(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- RPCs de compras (atômicas)
-- -----------------------------------------------------------------------------
create or replace function public.registrar_compra_cartao(
  p_cartao_id           uuid,
  p_categoria_id        uuid,
  p_descricao           text,
  p_data_compra         date,
  p_valor_total         bigint,
  p_parcelas            int,
  p_primeira_fatura_mes text,
  p_observacao          text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.compras_cartao (cartao_id, categoria_id, descricao, data_compra, valor_total_centavos,
                                     parcelas, primeira_fatura_mes, observacao)
  values (p_cartao_id, p_categoria_id, btrim(p_descricao), p_data_compra, p_valor_total,
          p_parcelas, p_primeira_fatura_mes, p_observacao)
  returning id into v_id;

  perform public.gerar_parcelas_compra(v_id);
  return v_id;
end;
$$;

create or replace function public.atualizar_compra_cartao(
  p_id                  uuid,
  p_cartao_id           uuid,
  p_categoria_id        uuid,
  p_descricao           text,
  p_data_compra         date,
  p_valor_total         bigint,
  p_parcelas            int,
  p_primeira_fatura_mes text,
  p_observacao          text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform 1 from public.compras_cartao c where c.id = p_id for update;
  if not found then
    raise exception 'Compra não encontrada.' using errcode = 'P0002';
  end if;

  -- Remove as parcelas antigas (a trava impede se alguma fatura estiver paga).
  delete from public.parcelas_cartao p where p.compra_id = p_id;

  update public.compras_cartao c
     set cartao_id = p_cartao_id,
         categoria_id = p_categoria_id,
         descricao = btrim(p_descricao),
         data_compra = p_data_compra,
         valor_total_centavos = p_valor_total,
         parcelas = p_parcelas,
         primeira_fatura_mes = p_primeira_fatura_mes,
         observacao = p_observacao
   where c.id = p_id;

  perform public.gerar_parcelas_compra(p_id);
end;
$$;

create or replace function public.excluir_compra_cartao(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.compras_cartao c where c.id = p_id;
  if not found then
    raise exception 'Compra não encontrada.' using errcode = 'P0002';
  end if;
end;
$$;

-- Ajuste manual da fatura (anuidade, juros, estorno, compra não lançada).
create or replace function public.definir_ajuste_fatura(p_id uuid, p_ajuste bigint, p_observacao text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_fatura public.lancamentos;
begin
  select * into v_fatura from public.lancamentos b where b.id = p_id for update;
  if not found or v_fatura.cartao_id is null then
    raise exception 'Fatura não encontrada.' using errcode = 'P0002';
  end if;
  if v_fatura.status = 'pago' then
    raise exception 'A fatura já está paga. Desfaça o pagamento para alterar o ajuste.' using errcode = '22023';
  end if;
  update public.lancamentos b set ajuste_centavos = p_ajuste, observacao = p_observacao where b.id = p_id;
  perform public.sincronizar_fatura(v_fatura.cartao_id, v_fatura.fatura_mes);
end;
$$;

-- -----------------------------------------------------------------------------
-- atualizar_lancamento / excluir_lancamento: passam a ter empresa e categoria, e
-- protegem as faturas (editadas pela tela da fatura).
-- -----------------------------------------------------------------------------
drop function if exists public.atualizar_lancamento(uuid, text, uuid, text, bigint, date, text, text, text);

create or replace function public.atualizar_lancamento(
  p_id             uuid,
  p_escopo         text,
  p_empresa_id     uuid,
  p_categoria_id   uuid,
  p_fornecedor_id  uuid,
  p_descricao      text,
  p_valor_centavos bigint,
  p_vencimento     date,
  p_codigo_barras  text,
  p_observacao     text,
  p_status         text
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_alvo public.lancamentos;
  v_qtd  integer := 0;
begin
  if p_escopo not in ('este', 'proximos', 'todos') then
    raise exception 'Escopo inválido.' using errcode = '22023';
  end if;
  if p_status not in ('pendente', 'pago') then
    raise exception 'Status inválido.' using errcode = '22023';
  end if;

  select * into v_alvo from public.lancamentos b where b.id = p_id for update;
  if not found then
    raise exception 'Boleto não encontrado.' using errcode = 'P0002';
  end if;
  if v_alvo.cartao_id is not null then
    raise exception 'Faturas de cartão são alteradas pela tela da fatura.' using errcode = '22023';
  end if;

  if v_alvo.serie_id is not null and p_escopo <> 'este' then
    update public.lancamentos b
       set empresa_id     = p_empresa_id,
           categoria_id   = p_categoria_id,
           fornecedor_id  = p_fornecedor_id,
           descricao      = p_descricao,
           valor_centavos = p_valor_centavos,
           observacao     = p_observacao,
           vencimento     = case
                              when p_vencimento is distinct from v_alvo.vencimento
                                then (p_vencimento + make_interval(months => b.parcela - v_alvo.parcela))::date
                              else b.vencimento
                            end
     where b.serie_id = v_alvo.serie_id
       and (p_escopo = 'todos' or b.parcela >= v_alvo.parcela);
    get diagnostics v_qtd = row_count;
  else
    update public.lancamentos b
       set empresa_id     = p_empresa_id,
           categoria_id   = p_categoria_id,
           fornecedor_id  = p_fornecedor_id,
           descricao      = p_descricao,
           valor_centavos = p_valor_centavos,
           observacao     = p_observacao,
           vencimento     = p_vencimento
     where b.id = p_id;
    v_qtd := 1;
  end if;

  update public.lancamentos b
     set codigo_barras = p_codigo_barras,
         status        = p_status,
         pago_em       = case when p_status = 'pago' then coalesce(b.pago_em, now()) else null end
   where b.id = p_id;

  return v_qtd;
end;
$$;

create or replace function public.excluir_lancamento(p_id uuid, p_escopo text)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_alvo public.lancamentos;
  v_qtd  integer := 0;
begin
  if p_escopo not in ('este', 'proximos', 'todos') then
    raise exception 'Escopo inválido.' using errcode = '22023';
  end if;

  select * into v_alvo from public.lancamentos b where b.id = p_id for update;
  if not found then
    raise exception 'Boleto não encontrado.' using errcode = 'P0002';
  end if;

  if v_alvo.cartao_id is not null and exists (
    select 1 from public.parcelas_cartao p
     where p.cartao_id = v_alvo.cartao_id and p.fatura_mes = v_alvo.fatura_mes
  ) then
    raise exception 'Esta fatura tem compras. Exclua ou mova as compras antes.' using errcode = '22023';
  end if;

  if v_alvo.serie_id is null or p_escopo = 'este' then
    delete from public.lancamentos b where b.id = p_id;
    v_qtd := 1;
  else
    delete from public.lancamentos b
     where b.serie_id = v_alvo.serie_id
       and (p_escopo = 'todos' or b.parcela >= v_alvo.parcela);
    get diagnostics v_qtd = row_count;
  end if;

  return v_qtd;
end;
$$;

revoke all on function public.atualizar_lancamento(uuid, text, uuid, uuid, uuid, text, bigint, date, text, text, text) from public, anon;
revoke all on function public.registrar_compra_cartao(uuid, uuid, text, date, bigint, int, text, text) from public, anon;
revoke all on function public.atualizar_compra_cartao(uuid, uuid, uuid, text, date, bigint, int, text, text) from public, anon;
revoke all on function public.excluir_compra_cartao(uuid) from public, anon;
revoke all on function public.definir_ajuste_fatura(uuid, bigint, text) from public, anon;
revoke all on function public.sincronizar_fatura(uuid, text) from public, anon;

grant execute on function public.atualizar_lancamento(uuid, text, uuid, uuid, uuid, text, bigint, date, text, text, text) to authenticated;
grant execute on function public.registrar_compra_cartao(uuid, uuid, text, date, bigint, int, text, text) to authenticated;
grant execute on function public.atualizar_compra_cartao(uuid, uuid, uuid, text, date, bigint, int, text, text) to authenticated;
grant execute on function public.excluir_compra_cartao(uuid) to authenticated;
grant execute on function public.definir_ajuste_fatura(uuid, bigint, text) to authenticated;
-- Usadas pelos gatilhos (executam com as permissões do usuário; RLS aplicada).
grant execute on function public.sincronizar_fatura(uuid, text) to authenticated;
revoke all on function public.fatura_esta_paga(uuid, text) from public, anon;
grant execute on function public.fatura_esta_paga(uuid, text) to authenticated;
