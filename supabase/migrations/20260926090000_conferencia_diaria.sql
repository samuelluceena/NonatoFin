-- =============================================================================
-- NonatoFin — Migration 008: conferência diária dos saldos
-- =============================================================================
-- No primeiro acesso de cada dia o app pede o saldo de cada conta ativa.
-- Uma conta está "conferida hoje" quando tem uma conferência com a data de
-- hoje (fuso de São Paulo). O cadastro da conta já conta como conferência.
-- =============================================================================

-- Contas ativas do usuário que ainda não foram conferidas hoje.
create or replace function public.contas_a_conferir_hoje()
returns setof uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select c.id
    from public.contas_bancarias c
   where c.ativa
     and not exists (
       select 1 from public.movimentos_conta m
        where m.conta_id = c.id and m.tipo = 'conferencia' and m.data = public.hoje_app()
     )
$$;

revoke all on function public.contas_a_conferir_hoje() from public, anon;
grant execute on function public.contas_a_conferir_hoje() to authenticated;

-- A consulta acima procura por (conta, tipo, data): índice próprio.
create index movimentos_conferencia_idx on public.movimentos_conta (conta_id, data) where tipo = 'conferencia';
