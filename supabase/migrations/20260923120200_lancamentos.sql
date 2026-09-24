-- =============================================================================
-- NonatoFin — Migration 003: lancamentos
-- =============================================================================
-- Decisões importantes:
--  * "Lançamento" = qualquer conta a pagar: boleto, fatura de cartão, empréstimo,
--    despesa fixa ou variada. Na interface a lista se chama "Boletos".
--  * valor_centavos (bigint): dinheiro em centavos inteiros, sem ponto flutuante.
--  * vencimento (date): é uma DATA, não um instante. Sem fuso horário.
--  * status armazenado: 'pendente' | 'pago'. "Atrasado" é DERIVADO
--    (pendente + vencimento < hoje) e calculado na aplicação, pois depende da
--    data atual e ficaria desatualizado se fosse gravado.
--  * Séries (vários meses): serie_id agrupa; parcela/total_parcelas numeram.
-- =============================================================================

create table public.lancamentos (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fornecedor_id  uuid not null,
  descricao      text not null,
  valor_centavos bigint not null,
  vencimento     date not null,
  codigo_barras  text,
  observacao     text,
  status         text not null default 'pendente',
  pago_em        timestamptz,
  serie_id       uuid,
  parcela        smallint,
  total_parcelas smallint,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- O fornecedor precisa pertencer ao MESMO usuário (evita IDOR entre contas).
  constraint lancamentos_fornecedor_fk
    foreign key (fornecedor_id, user_id)
    references public.fornecedores (id, user_id)
    on delete restrict,

  constraint lancamentos_descricao_tamanho
    check (char_length(btrim(descricao)) between 1 and 200),
  -- Até R$ 1.000.000.000,00 por lançamento.
  constraint lancamentos_valor_positivo
    check (valor_centavos > 0 and valor_centavos <= 100000000000),
  constraint lancamentos_vencimento_faixa
    check (vencimento between date '2000-01-01' and date '2100-12-31'),
  -- Somente dígitos: 44 (código de barras), 47 (linha digitável de boleto)
  -- ou 48 (linha digitável de convênio/concessionária).
  constraint lancamentos_codigo_formato
    check (codigo_barras is null or codigo_barras ~ '^([0-9]{44}|[0-9]{47}|[0-9]{48})$'),
  constraint lancamentos_observacao_tamanho
    check (observacao is null or char_length(observacao) <= 1000),
  constraint lancamentos_status_valido
    check (status in ('pendente', 'pago')),
  -- pago <=> pago_em preenchido
  constraint lancamentos_pagamento_consistente
    check ((status = 'pago') = (pago_em is not null)),
  constraint lancamentos_serie_consistente
    check (
      (serie_id is null and parcela is null and total_parcelas is null)
      or (
        serie_id is not null
        and total_parcelas between 1 and 360
        and parcela between 1 and total_parcelas
      )
    ),
  constraint lancamentos_serie_parcela_unica unique (serie_id, parcela)
);

comment on table public.lancamentos is 'Lançamentos a pagar: boletos, faturas de cartão, empréstimos e despesas.';
comment on column public.lancamentos.valor_centavos is 'Valor em centavos (R$ 2.995,00 = 299500).';
comment on column public.lancamentos.vencimento is 'Data de vencimento (sem hora e sem fuso).';
comment on column public.lancamentos.status is 'pendente | pago. Atrasado é derivado na aplicação.';
comment on column public.lancamentos.serie_id is 'Agrupa lançamentos criados juntos (vários meses).';

create index lancamentos_user_vencimento_idx on public.lancamentos (user_id, vencimento);
create index lancamentos_user_status_vencimento_idx on public.lancamentos (user_id, status, vencimento);
create index lancamentos_fornecedor_idx on public.lancamentos (fornecedor_id);
create index lancamentos_pago_em_idx on public.lancamentos (user_id, pago_em) where pago_em is not null;
-- (serie_id, parcela) já é indexado pela constraint unique.

create trigger lancamentos_updated_at
  before update on public.lancamentos
  for each row execute function public.definir_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.lancamentos enable row level security;

revoke all on table public.lancamentos from anon;
grant select, insert, update, delete on table public.lancamentos to authenticated;

create policy lancamentos_select on public.lancamentos
  for select to authenticated
  using (user_id = (select auth.uid()) and (select public.usuario_autorizado()));

create policy lancamentos_insert on public.lancamentos
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.usuario_autorizado()));

create policy lancamentos_update on public.lancamentos
  for update to authenticated
  using (user_id = (select auth.uid()) and (select public.usuario_autorizado()))
  with check (user_id = (select auth.uid()) and (select public.usuario_autorizado()));

create policy lancamentos_delete on public.lancamentos
  for delete to authenticated
  using (user_id = (select auth.uid()) and (select public.usuario_autorizado()));
