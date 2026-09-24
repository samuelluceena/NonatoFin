-- =============================================================================
-- NonatoFin — Migration 001: base
-- Funções utilitárias, lista de usuários autorizados e função de autorização.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Atualiza automaticamente a coluna updated_at em qualquer UPDATE.
-- -----------------------------------------------------------------------------
create or replace function public.definir_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Normaliza nomes para comparação: sem acentos, minúsculo, espaços únicos.
-- "  VIA  da Móda " -> "via da moda"
-- IMMUTABLE para poder ser usada em coluna gerada e índice único.
-- -----------------------------------------------------------------------------
create or replace function public.normalizar_nome(p_nome text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(
    regexp_replace(
      btrim(
        translate(
          p_nome,
          'ÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑÝáàâãäåéèêëíìîïóòôõöúùûüçñýÿ',
          'AAAAAAEEEEIIIIOOOOOUUUUCNYaaaaaaeeeeiiiiooooouuuucnyy'
        )
      ),
      '\s+', ' ', 'g'
    )
  );
$$;

-- -----------------------------------------------------------------------------
-- Usuários autorizados a usar o NonatoFin.
-- Defesa em profundidade: mesmo que alguém consiga criar uma conta no Auth
-- (ex.: cadastro público reativado por engano), não terá acesso a nenhum dado
-- sem estar nesta tabela. A tabela NÃO é acessível pela API (sem policies).
-- Inserção: somente via SQL Editor / service role (script scripts/criar-usuario.ts).
-- -----------------------------------------------------------------------------
create table public.usuarios_autorizados (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.usuarios_autorizados enable row level security;
revoke all on table public.usuarios_autorizados from anon, authenticated;

comment on table public.usuarios_autorizados is
  'Lista de usuários com acesso ao NonatoFin. Sem policies: inacessível pela API pública.';

-- -----------------------------------------------------------------------------
-- Retorna true se o usuário autenticado atual está autorizado.
-- SECURITY DEFINER para poder ler usuarios_autorizados (que não tem policies).
-- -----------------------------------------------------------------------------
create or replace function public.usuario_autorizado()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.usuarios_autorizados ua
    where ua.user_id = (select auth.uid())
  );
$$;

revoke all on function public.usuario_autorizado() from public, anon;
grant execute on function public.usuario_autorizado() to authenticated;
