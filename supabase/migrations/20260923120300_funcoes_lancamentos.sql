-- =============================================================================
-- NonatoFin — Migration 004: funções (RPC) de lancamentos
-- Todas SECURITY INVOKER: executam com as permissões do usuário e respeitam RLS.
-- Cada função é uma transação: ou altera tudo, ou nada.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Marca como pago (p_pago = true) ou desfaz o pagamento (p_pago = false).
-- Idempotente: marcar pago duas vezes mantém o pago_em original.
-- -----------------------------------------------------------------------------
create or replace function public.definir_pagamento(p_id uuid, p_pago boolean)
returns public.lancamentos
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lancamento public.lancamentos;
begin
  update public.lancamentos b
     set status  = case when p_pago then 'pago' else 'pendente' end,
         pago_em = case when p_pago then coalesce(b.pago_em, now()) else null end
   where b.id = p_id
  returning b.* into v_lancamento;

  if not found then
    raise exception 'Boleto não encontrado.' using errcode = 'P0002';
  end if;

  return v_lancamento;
end;
$$;

-- -----------------------------------------------------------------------------
-- Atualiza um lançamento e, se pertencer a uma série, opcionalmente a série.
--
-- p_escopo:
--   'este'     -> somente o lançamento informado
--   'proximos' -> o lançamento informado e as parcelas seguintes (parcela >=)
--   'todos'    -> todas as parcelas da série
--
-- Campos aplicados ao escopo: fornecedor, descrição, valor, observação e
-- vencimento. Se o vencimento mudar, cada parcela recebe:
--   novo_vencimento + (parcela - parcela_editada) meses
-- A soma de meses do Postgres é feita a partir de UMA data-âncora e ajusta
-- para o último dia do mês quando necessário (31/01 + 1 mês = 28/02;
-- 31/01 + 2 meses = 31/03), preservando o dia escolhido — mesma regra de
-- src/lib/domain/recorrencia.ts (validada em teste de integração).
--
-- Código de barras e status são SEMPRE aplicados somente ao lançamento editado,
-- pois o código normalmente muda a cada mês e o pagamento é individual.
--
-- Retorna a quantidade de lancamentos alterados.
-- -----------------------------------------------------------------------------
create or replace function public.atualizar_lancamento(
  p_id             uuid,
  p_escopo         text,
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

  select * into v_alvo
    from public.lancamentos b
   where b.id = p_id
     for update;

  if not found then
    raise exception 'Boleto não encontrado.' using errcode = 'P0002';
  end if;

  if v_alvo.serie_id is not null and p_escopo <> 'este' then
    update public.lancamentos b
       set fornecedor_id  = p_fornecedor_id,
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
       set fornecedor_id  = p_fornecedor_id,
           descricao      = p_descricao,
           valor_centavos = p_valor_centavos,
           observacao     = p_observacao,
           vencimento     = p_vencimento
     where b.id = p_id;

    v_qtd := 1;
  end if;

  -- Código e status: somente no lançamento editado.
  update public.lancamentos b
     set codigo_barras = p_codigo_barras,
         status        = p_status,
         pago_em       = case
                           when p_status = 'pago' then coalesce(b.pago_em, now())
                           else null
                         end
   where b.id = p_id;

  return v_qtd;
end;
$$;

-- -----------------------------------------------------------------------------
-- Exclui um lançamento ou parte de sua série. Mesmo significado de p_escopo.
-- Retorna a quantidade de lancamentos excluídos.
-- -----------------------------------------------------------------------------
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

  select * into v_alvo
    from public.lancamentos b
   where b.id = p_id
     for update;

  if not found then
    raise exception 'Boleto não encontrado.' using errcode = 'P0002';
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

revoke all on function public.definir_pagamento(uuid, boolean) from public, anon;
revoke all on function public.atualizar_lancamento(uuid, text, uuid, text, bigint, date, text, text, text) from public, anon;
revoke all on function public.excluir_lancamento(uuid, text) from public, anon;

grant execute on function public.definir_pagamento(uuid, boolean) to authenticated;
grant execute on function public.atualizar_lancamento(uuid, text, uuid, text, bigint, date, text, text, text) to authenticated;
grant execute on function public.excluir_lancamento(uuid, text) to authenticated;
