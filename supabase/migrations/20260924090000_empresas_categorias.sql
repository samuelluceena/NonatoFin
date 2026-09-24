-- =============================================================================
-- NonatoFin — Migration 005: empresas (CNPJ) e categorias editáveis
-- Incremental: não altera o comportamento das tabelas existentes além de
-- acrescentar empresa e categoria aos lancamentos.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Validação de CNPJ (numérico e alfanumérico — IN RFB 2.229/2024).
-- Valor do caractere = ASCII − 48; módulo 11 com pesos 5..2,9..2 e 6..2,9..2.
-- -----------------------------------------------------------------------------
create or replace function public.cnpj_valido(p_cnpj text)
returns boolean
language plpgsql
immutable
parallel safe
set search_path = ''
as $$
declare
  v_pesos1 int[] := array[5,4,3,2,9,8,7,6,5,4,3,2];
  v_pesos2 int[] := array[6,5,4,3,2,9,8,7,6,5,4,3,2];
  v_soma int;
  v_resto int;
  v_dv1 int;
  v_dv2 int;
begin
  if p_cnpj is null or p_cnpj !~ '^[A-Z0-9]{12}[0-9]{2}$' or p_cnpj ~ '^(.)\1{13}$' then
    return false;
  end if;
  v_soma := 0;
  for i in 1..12 loop
    v_soma := v_soma + (ascii(substr(p_cnpj, i, 1)) - 48) * v_pesos1[i];
  end loop;
  v_resto := v_soma % 11;
  v_dv1 := case when v_resto < 2 then 0 else 11 - v_resto end;
  v_soma := 0;
  for i in 1..13 loop
    v_soma := v_soma + (ascii(substr(substr(p_cnpj, 1, 12) || v_dv1::text, i, 1)) - 48) * v_pesos2[i];
  end loop;
  v_resto := v_soma % 11;
  v_dv2 := case when v_resto < 2 then 0 else 11 - v_resto end;
  return substr(p_cnpj, 13, 2) = v_dv1::text || v_dv2::text;
end;
$$;

-- -----------------------------------------------------------------------------
-- EMPRESAS
-- -----------------------------------------------------------------------------
create table public.empresas (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  apelido             text not null,
  apelido_normalizado text generated always as (public.normalizar_nome(apelido)) stored,
  razao_social        text,
  cnpj                text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint empresas_apelido_tamanho check (char_length(btrim(apelido)) between 1 and 40),
  constraint empresas_razao_tamanho check (razao_social is null or char_length(razao_social) <= 150),
  -- CNPJ gravado só com [A-Z0-9], com dígitos verificadores corretos.
  constraint empresas_cnpj_valido check (cnpj is null or public.cnpj_valido(cnpj)),
  constraint empresas_id_user_unique unique (id, user_id),
  constraint empresas_apelido_unico unique (user_id, apelido_normalizado),
  constraint empresas_cnpj_unico unique (user_id, cnpj)
);

comment on table public.empresas is 'Empresas (CNPJ) cujas contas o usuário controla.';

create trigger empresas_updated_at
  before update on public.empresas
  for each row execute function public.definir_updated_at();

alter table public.empresas enable row level security;
revoke all on table public.empresas from anon;
grant select, insert, update, delete on table public.empresas to authenticated;

create policy empresas_select on public.empresas for select to authenticated
  using (user_id = (select auth.uid()) and (select public.usuario_autorizado()));
create policy empresas_insert on public.empresas for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.usuario_autorizado()));
create policy empresas_update on public.empresas for update to authenticated
  using (user_id = (select auth.uid()) and (select public.usuario_autorizado()))
  with check (user_id = (select auth.uid()) and (select public.usuario_autorizado()));
create policy empresas_delete on public.empresas for delete to authenticated
  using (user_id = (select auth.uid()) and (select public.usuario_autorizado()));

-- -----------------------------------------------------------------------------
-- CATEGORIAS (editáveis pelo usuário)
-- -----------------------------------------------------------------------------
create table public.categorias (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome             text not null,
  nome_normalizado text generated always as (public.normalizar_nome(nome)) stored,
  ordem            smallint not null default 100,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint categorias_nome_tamanho check (char_length(btrim(nome)) between 1 and 40),
  constraint categorias_id_user_unique unique (id, user_id),
  constraint categorias_nome_unico unique (user_id, nome_normalizado)
);

comment on table public.categorias is 'Categorias de lançamentos (editáveis).';

create trigger categorias_updated_at
  before update on public.categorias
  for each row execute function public.definir_updated_at();

alter table public.categorias enable row level security;
revoke all on table public.categorias from anon;
grant select, insert, update, delete on table public.categorias to authenticated;

create policy categorias_select on public.categorias for select to authenticated
  using (user_id = (select auth.uid()) and (select public.usuario_autorizado()));
create policy categorias_insert on public.categorias for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.usuario_autorizado()));
create policy categorias_update on public.categorias for update to authenticated
  using (user_id = (select auth.uid()) and (select public.usuario_autorizado()))
  with check (user_id = (select auth.uid()) and (select public.usuario_autorizado()));
create policy categorias_delete on public.categorias for delete to authenticated
  using (user_id = (select auth.uid()) and (select public.usuario_autorizado()));

-- Categorias iniciais para um usuário (idempotente).
create or replace function public.inserir_categorias_padrao(p_user_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.categorias (user_id, nome, ordem)
  values (p_user_id, 'Boleto de fornecedor', 1),
         (p_user_id, 'Empréstimo', 2),
         (p_user_id, 'Despesa fixa', 3),
         (p_user_id, 'Despesa variada', 4),
         (p_user_id, 'Cartão de crédito', 5)
  on conflict (user_id, nome_normalizado) do nothing;
$$;
revoke all on function public.inserir_categorias_padrao(uuid) from public, anon, authenticated;

-- Chamado pelo app no login: cria as categorias padrão se o usuário não tiver nenhuma.
-- Devolve as categorias (evita uma 2ª leitura idêntica, que o Next.js
-- reaproveitaria da mesma renderização).
create or replace function public.garantir_categorias_padrao()
returns table (id uuid, nome text, ordem smallint)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (select 1 from public.categorias c where c.user_id = (select auth.uid())) then
    insert into public.categorias (nome, ordem)
    values ('Boleto de fornecedor', 1), ('Empréstimo', 2), ('Despesa fixa', 3),
           ('Despesa variada', 4), ('Cartão de crédito', 5)
    on conflict (user_id, nome_normalizado) do nothing;
  end if;
  return query
    select c.id, c.nome, c.ordem from public.categorias c
     where c.user_id = (select auth.uid())
     order by c.ordem, c.nome_normalizado;
end;
$$;
revoke all on function public.garantir_categorias_padrao() from public, anon;
grant execute on function public.garantir_categorias_padrao() to authenticated;

-- Usuários já autorizados recebem as categorias padrão.
select public.inserir_categorias_padrao(ua.user_id) from public.usuarios_autorizados ua;

-- -----------------------------------------------------------------------------
-- BOLETOS: empresa e categoria (obrigatórias)
-- -----------------------------------------------------------------------------
alter table public.lancamentos
  add column empresa_id   uuid,
  add column categoria_id uuid;

-- Bases que já tinham lancamentos: cria "Empresa principal" e usa a categoria
-- "Boleto de fornecedor" (o usuário pode reclassificar depois).
insert into public.empresas (user_id, apelido)
select distinct b.user_id, 'Empresa principal'
  from public.lancamentos b
 where not exists (select 1 from public.empresas e where e.user_id = b.user_id);

select public.inserir_categorias_padrao(u.user_id)
  from (select distinct user_id from public.lancamentos) u;

update public.lancamentos b
   set empresa_id = (select e.id from public.empresas e where e.user_id = b.user_id order by e.created_at limit 1),
       categoria_id = (select c.id from public.categorias c
                        where c.user_id = b.user_id and c.nome_normalizado = 'boleto de fornecedor')
 where b.empresa_id is null or b.categoria_id is null;

alter table public.lancamentos
  alter column empresa_id set not null,
  alter column categoria_id set not null,
  add constraint lancamentos_empresa_fk foreign key (empresa_id, user_id)
    references public.empresas (id, user_id) on delete restrict,
  add constraint lancamentos_categoria_fk foreign key (categoria_id, user_id)
    references public.categorias (id, user_id) on delete restrict;

create index lancamentos_user_empresa_vencimento_idx on public.lancamentos (user_id, empresa_id, vencimento);
create index lancamentos_categoria_idx on public.lancamentos (categoria_id);
