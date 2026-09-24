-- =============================================================================
-- NonatoFin — Migration 002: fornecedores
-- =============================================================================

create table public.fornecedores (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome             text not null,
  nome_normalizado text generated always as (public.normalizar_nome(nome)) stored,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint fornecedores_nome_tamanho
    check (char_length(btrim(nome)) between 1 and 120),
  -- Necessário para a FK composta de lancamentos (garante mesmo dono).
  constraint fornecedores_id_user_unique unique (id, user_id),
  -- "Via da Moda", "via da moda" e "VIA DA MODA" são o mesmo fornecedor.
  constraint fornecedores_nome_unico unique (user_id, nome_normalizado)
);

comment on table public.fornecedores is 'Fornecedores/credores (quem recebe o pagamento).';
comment on column public.fornecedores.nome_normalizado is
  'Gerado: nome sem acento, minúsculo e com espaços únicos. Garante unicidade sem diferenciar maiúsculas.';

create trigger fornecedores_updated_at
  before update on public.fornecedores
  for each row execute function public.definir_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.fornecedores enable row level security;

revoke all on table public.fornecedores from anon;
grant select, insert, update, delete on table public.fornecedores to authenticated;

create policy fornecedores_select on public.fornecedores
  for select to authenticated
  using (user_id = (select auth.uid()) and (select public.usuario_autorizado()));

create policy fornecedores_insert on public.fornecedores
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.usuario_autorizado()));

create policy fornecedores_update on public.fornecedores
  for update to authenticated
  using (user_id = (select auth.uid()) and (select public.usuario_autorizado()))
  with check (user_id = (select auth.uid()) and (select public.usuario_autorizado()));

create policy fornecedores_delete on public.fornecedores
  for delete to authenticated
  using (user_id = (select auth.uid()) and (select public.usuario_autorizado()));

-- -----------------------------------------------------------------------------
-- Obtém o id do fornecedor pelo nome (sem diferenciar maiúsculas/acentos),
-- criando-o se ainda não existir. Atômico e seguro contra corrida.
-- SECURITY INVOKER: respeita RLS.
-- -----------------------------------------------------------------------------
create or replace function public.obter_ou_criar_fornecedor(p_nome text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_nome text := regexp_replace(btrim(coalesce(p_nome, '')), '\s+', ' ', 'g');
  v_id   uuid;
begin
  if char_length(v_nome) = 0 then
    raise exception 'Informe o fornecedor.' using errcode = '22023';
  end if;

  insert into public.fornecedores (nome)
  values (v_nome)
  on conflict (user_id, nome_normalizado) do nothing
  returning id into v_id;

  if v_id is null then
    select f.id into v_id
    from public.fornecedores f
    where f.user_id = (select auth.uid())
      and f.nome_normalizado = public.normalizar_nome(v_nome);
  end if;

  if v_id is null then
    raise exception 'Não foi possível obter o fornecedor.' using errcode = '42501';
  end if;

  return v_id;
end;
$$;

revoke all on function public.obter_ou_criar_fornecedor(text) from public, anon;
grant execute on function public.obter_ou_criar_fornecedor(text) to authenticated;
