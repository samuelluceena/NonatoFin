-- =============================================================================
-- NonatoFin — Migration 007: contas bancárias e saldo
-- =============================================================================
-- Decisões (veja docs/REGRAS-DE-NEGOCIO.md, seção Contas bancárias):
--  * Cada conta pertence a UMA empresa. Um lançamento (ou cartão) só pode usar
--    conta da mesma empresa — garantido pela FK composta (conta_id, empresa_id, user_id).
--  * O saldo NUNCA é digitado: é a soma dos movimentos confirmados menos os
--    lançamentos pagos por aquela conta. A "conferência com o extrato" grava
--    um ajuste com a diferença entre o saldo do banco e o calculado.
--  * Movimentos: entrada (dinheiro que entrou; data futura = prevista),
--    transferência (par de movimentos com o mesmo transferencia_id) e
--    conferência (ajuste). Pagamentos NÃO viram movimento: vêm dos lançamentos.
--  * Guardamos só apelido, banco e os 4 últimos dígitos: nada de número
--    completo de conta, agência, senha ou chave.
-- =============================================================================

-- "Hoje" no fuso do app (America/Sao_Paulo) — o mesmo de lib/config.ts.
create or replace function public.hoje_app()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Sao_Paulo')::date
$$;
revoke all on function public.hoje_app() from public, anon;
grant execute on function public.hoje_app() to authenticated;

-- -----------------------------------------------------------------------------
-- CONTAS BANCÁRIAS
-- -----------------------------------------------------------------------------
create table public.contas_bancarias (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  empresa_id          uuid not null,
  apelido             text not null,
  apelido_normalizado text generated always as (public.normalizar_nome(apelido)) stored,
  banco               text not null,
  final               text,
  padrao              boolean not null default false,
  ativa               boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint contas_apelido_tamanho check (char_length(btrim(apelido)) between 1 and 40),
  constraint contas_banco_tamanho check (char_length(btrim(banco)) between 1 and 60),
  constraint contas_final_formato check (final is null or final ~ '^[0-9]{4}$'),
  constraint contas_padrao_ativa check (not padrao or ativa),
  constraint contas_id_user_unique unique (id, user_id),
  -- Alvo das FKs de lançamentos/cartões: garante conta da MESMA empresa.
  constraint contas_id_empresa_user_unique unique (id, empresa_id, user_id),
  constraint contas_apelido_unico unique (user_id, apelido_normalizado),
  constraint contas_empresa_fk foreign key (empresa_id, user_id)
    references public.empresas (id, user_id) on delete restrict
);

comment on table public.contas_bancarias is 'Contas bancárias de cada empresa (de onde saem os pagamentos).';

-- No máximo uma conta padrão por empresa.
create unique index contas_uma_padrao_por_empresa on public.contas_bancarias (empresa_id) where padrao;

create trigger contas_bancarias_updated_at
  before update on public.contas_bancarias
  for each row execute function public.definir_updated_at();

-- Ao marcar uma conta como padrão, desmarca a anterior da mesma empresa.
create or replace function public.contas_trocar_padrao()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.padrao then
    update public.contas_bancarias c
       set padrao = false
     where c.empresa_id = new.empresa_id and c.id <> new.id and c.padrao;
  end if;
  return new;
end;
$$;

create trigger contas_troca_padrao
  before insert or update of padrao, empresa_id on public.contas_bancarias
  for each row execute function public.contas_trocar_padrao();

-- -----------------------------------------------------------------------------
-- MOVIMENTOS (entradas, transferências e conferências)
-- -----------------------------------------------------------------------------
create table public.movimentos_conta (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  conta_id         uuid not null,
  tipo             text not null,
  data             date not null,
  -- Com sinal: + entra dinheiro, − sai dinheiro.
  valor_centavos   bigint not null,
  -- Conferência: o saldo que o banco mostrava (o valor é o ajuste).
  saldo_informado  bigint,
  descricao        text,
  -- Entrada com data futura nasce como prevista (confirmado = false).
  confirmado       boolean not null default true,
  transferencia_id uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint movimentos_tipo_valido check (tipo in ('entrada', 'transferencia', 'conferencia')),
  constraint movimentos_valor_faixa check (abs(valor_centavos) <= 100000000000),
  constraint movimentos_data_faixa check (data between date '2000-01-01' and date '2100-12-31'),
  constraint movimentos_descricao_tamanho check (descricao is null or char_length(descricao) <= 200),
  constraint movimentos_entrada check (tipo <> 'entrada' or valor_centavos > 0),
  constraint movimentos_transferencia check (
    tipo <> 'transferencia' or (transferencia_id is not null and valor_centavos <> 0 and confirmado)
  ),
  constraint movimentos_conferencia check (
    (tipo = 'conferencia') = (saldo_informado is not null) and (tipo <> 'conferencia' or confirmado)
  ),
  constraint movimentos_conta_fk foreign key (conta_id, user_id)
    references public.contas_bancarias (id, user_id) on delete cascade
);

comment on table public.movimentos_conta is 'Entradas, transferências e conferências de saldo das contas bancárias.';

create index movimentos_conta_data_idx on public.movimentos_conta (conta_id, data);
create index movimentos_transferencia_idx on public.movimentos_conta (transferencia_id) where transferencia_id is not null;

create trigger movimentos_conta_updated_at
  before update on public.movimentos_conta
  for each row execute function public.definir_updated_at();

-- RLS: mesmo padrão das demais tabelas.
do $$
declare
  t text;
begin
  foreach t in array array['contas_bancarias', 'movimentos_conta'] loop
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
-- CONTA DE DÉBITO em lançamentos e cartões (opcional)
-- -----------------------------------------------------------------------------
alter table public.lancamentos
  add column conta_id uuid,
  add constraint lancamentos_conta_fk foreign key (conta_id, empresa_id, user_id)
    references public.contas_bancarias (id, empresa_id, user_id) on delete restrict;

create index lancamentos_conta_idx on public.lancamentos (conta_id, status) where conta_id is not null;

alter table public.cartoes
  add column conta_id uuid,
  add constraint cartoes_conta_fk foreign key (conta_id, empresa_id, user_id)
    references public.contas_bancarias (id, empresa_id, user_id) on delete restrict;

-- -----------------------------------------------------------------------------
-- SALDO
-- -----------------------------------------------------------------------------
-- Saldo atual de cada conta = movimentos confirmados − lançamentos pagos pela conta.
create or replace function public.saldos_contas()
returns table (conta_id uuid, saldo_centavos bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.id,
         coalesce((select sum(m.valor_centavos) from public.movimentos_conta m
                    where m.conta_id = c.id and m.confirmado), 0)::bigint
       - coalesce((select sum(l.valor_centavos) from public.lancamentos l
                    where l.conta_id = c.id and l.status = 'pago'), 0)::bigint
    from public.contas_bancarias c
$$;

-- Conferência com o extrato: grava o ajuste (saldo do banco − saldo calculado).
-- Calculado no banco, na mesma transação, para não haver corrida.
create or replace function public.conferir_saldo(p_conta_id uuid, p_saldo_informado bigint)
returns public.movimentos_conta
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_saldo bigint;
  v_mov   public.movimentos_conta;
begin
  select s.saldo_centavos into v_saldo from public.saldos_contas() s where s.conta_id = p_conta_id;
  if not found then
    raise exception 'Conta não encontrada.' using errcode = 'P0002';
  end if;
  if abs(p_saldo_informado) > 100000000000 then
    raise exception 'Saldo fora do permitido.' using errcode = '22023';
  end if;

  insert into public.movimentos_conta (conta_id, tipo, data, valor_centavos, saldo_informado, descricao)
  values (p_conta_id, 'conferencia', public.hoje_app(), p_saldo_informado - v_saldo, p_saldo_informado, null)
  returning * into v_mov;
  return v_mov;
end;
$$;

-- Transferência entre duas contas do usuário: dois movimentos ligados.
create or replace function public.transferir_entre_contas(
  p_origem_id  uuid,
  p_destino_id uuid,
  p_valor      bigint,
  p_data       date,
  p_descricao  text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  if p_origem_id = p_destino_id then
    raise exception 'Escolha contas diferentes para a transferência.' using errcode = '22023';
  end if;
  if p_valor is null or p_valor <= 0 then
    raise exception 'Informe um valor maior que zero.' using errcode = '22023';
  end if;
  if p_data > public.hoje_app() then
    raise exception 'A transferência não pode ter data futura.' using errcode = '22023';
  end if;
  if (select count(*) from public.contas_bancarias c where c.id in (p_origem_id, p_destino_id)) <> 2 then
    raise exception 'Conta não encontrada.' using errcode = 'P0002';
  end if;

  insert into public.movimentos_conta (conta_id, tipo, data, valor_centavos, descricao, transferencia_id)
  values (p_origem_id, 'transferencia', p_data, -p_valor, p_descricao, v_id),
         (p_destino_id, 'transferencia', p_data, p_valor, p_descricao, v_id);
  return v_id;
end;
$$;

create or replace function public.excluir_transferencia(p_transferencia_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.movimentos_conta m where m.transferencia_id = p_transferencia_id;
  if not found then
    raise exception 'Transferência não encontrada.' using errcode = 'P0002';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- PAGAMENTO: agora pode informar a conta que pagou ("paguei pelo Bradesco").
-- -----------------------------------------------------------------------------
drop function if exists public.definir_pagamento(uuid, boolean);

create or replace function public.definir_pagamento(p_id uuid, p_pago boolean, p_conta_id uuid default null)
returns public.lancamentos
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lancamento public.lancamentos;
begin
  update public.lancamentos b
     set status   = case when p_pago then 'pago' else 'pendente' end,
         pago_em  = case when p_pago then coalesce(b.pago_em, now()) else null end,
         conta_id = case when p_pago and p_conta_id is not null then p_conta_id else b.conta_id end
   where b.id = p_id
  returning b.* into v_lancamento;

  if not found then
    raise exception 'Boleto não encontrado.' using errcode = 'P0002';
  end if;

  return v_lancamento;
end;
$$;

-- -----------------------------------------------------------------------------
-- EDIÇÃO de lançamento: agora com a conta de débito (mesmo escopo dos demais campos).
-- -----------------------------------------------------------------------------
drop function if exists public.atualizar_lancamento(uuid, text, uuid, uuid, uuid, text, bigint, date, text, text, text);

create or replace function public.atualizar_lancamento(
  p_id             uuid,
  p_escopo         text,
  p_empresa_id     uuid,
  p_categoria_id   uuid,
  p_conta_id       uuid,
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
           conta_id       = p_conta_id,
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
           conta_id       = p_conta_id,
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

-- -----------------------------------------------------------------------------
-- FATURAS herdam a conta do cartão.
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
      insert into public.lancamentos (user_id, empresa_id, categoria_id, conta_id, fornecedor_id, descricao,
                                      valor_centavos, vencimento, cartao_id, fatura_mes)
      values (v_cartao.user_id, v_cartao.empresa_id, v_cartao.categoria_fatura_id, v_cartao.conta_id,
              v_cartao.fornecedor_id,
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

create or replace function public.cartoes_propagar_faturas()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.lancamentos b
     set empresa_id    = new.empresa_id,
         conta_id      = new.conta_id,
         fornecedor_id = new.fornecedor_id,
         categoria_id  = new.categoria_fatura_id,
         descricao     = 'Fatura ' || new.nome || ' — ' || public.rotulo_competencia(b.fatura_mes),
         vencimento    = public.data_na_competencia(b.fatura_mes, new.dia_vencimento)
   where b.cartao_id = new.id and b.status = 'pendente';
  return null;
end;
$$;

drop trigger if exists cartoes_propaga_faturas on public.cartoes;
create trigger cartoes_propaga_faturas
  after update of empresa_id, conta_id, fornecedor_id, categoria_fatura_id, nome, dia_vencimento on public.cartoes
  for each row execute function public.cartoes_propagar_faturas();

-- -----------------------------------------------------------------------------
-- Permissões das funções
-- -----------------------------------------------------------------------------
revoke all on function public.contas_trocar_padrao() from public, anon;
revoke all on function public.saldos_contas() from public, anon;
revoke all on function public.conferir_saldo(uuid, bigint) from public, anon;
revoke all on function public.transferir_entre_contas(uuid, uuid, bigint, date, text) from public, anon;
revoke all on function public.excluir_transferencia(uuid) from public, anon;
revoke all on function public.definir_pagamento(uuid, boolean, uuid) from public, anon;
revoke all on function public.atualizar_lancamento(uuid, text, uuid, uuid, uuid, uuid, text, bigint, date, text, text, text) from public, anon;

grant execute on function public.saldos_contas() to authenticated;
grant execute on function public.conferir_saldo(uuid, bigint) to authenticated;
grant execute on function public.transferir_entre_contas(uuid, uuid, bigint, date, text) to authenticated;
grant execute on function public.excluir_transferencia(uuid) to authenticated;
grant execute on function public.definir_pagamento(uuid, boolean, uuid) to authenticated;
grant execute on function public.atualizar_lancamento(uuid, text, uuid, uuid, uuid, uuid, text, bigint, date, text, text, text) to authenticated;
