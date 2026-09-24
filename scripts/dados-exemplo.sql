-- =============================================================================
-- Dados de EXEMPLO para desenvolvimento local (NÃO execute em produção).
-- Uso: psql "$DATABASE_URL" -v email="'dono@nonatofin.local'" -f scripts/dados-exemplo.sql
-- Datas relativas a "hoje" (America/Sao_Paulo).
-- =============================================================================
begin;

create temporary table _ctx on commit drop as
select u.id as uid, (now() at time zone 'America/Sao_Paulo')::date as hoje
from auth.users u where u.email = :email;

insert into public.fornecedores (user_id, nome)
select uid, n from _ctx, unnest(array['Via da Moda', 'Bradesco', 'Enel', 'Malwee', 'Aluguel Loja Centro']) n
on conflict (user_id, nome_normalizado) do nothing;

create temporary table _f on commit drop as
select f.nome, f.id, f.user_id from public.fornecedores f join _ctx on f.user_id = _ctx.uid;

-- Série da Via da Moda (5x R$ 2.995,00), 2 já pagas
with s as (select gen_random_uuid() as sid)
insert into public.lancamentos (user_id, fornecedor_id, descricao, valor_centavos, vencimento, codigo_barras, status, pago_em, serie_id, parcela, total_parcelas)
select _f.user_id, _f.id, 'Compra coleção agosto', 299500,
       ((select hoje from _ctx) - interval '2 months' + make_interval(months => g - 1))::date,
       case when g = 3 then '00190000090123456789012345678901234567890123456' end,
       case when g <= 2 then 'pago' else 'pendente' end,
       case when g <= 2 then now() - make_interval(days => (3 - g) * 30) end,
       s.sid, g, 5
from _f, s, generate_series(1, 5) g where _f.nome = 'Via da Moda';

insert into public.lancamentos (user_id, fornecedor_id, descricao, valor_centavos, vencimento, codigo_barras, status, pago_em, observacao)
select _f.user_id, _f.id, d.descricao, d.valor, (select hoje from _ctx) + d.dias, d.codigo, d.status,
       case when d.status = 'pago' then now() end, d.obs
from _f join (values
  ('Bradesco', 'Empréstimo contrato 12345', 184320, 0, '23793381286000000000123456789012345678901234567', 'pendente', null),
  ('Enel', 'Energia Loja Iguatu', 45678, 0, '836200000005667800481000180975657313001589636081', 'pendente', 'Conta de agosto'),
  ('Malwee', 'Pedido 8841', 512000, 1, null, 'pendente', null),
  ('Aluguel Loja Centro', 'Aluguel', 350000, 4, '10499123450000100000000123456789012345678901234', 'pendente', null),
  ('Enel', 'Energia Depósito', 18990, -3, '836700000001899000481000180975657313001589636082', 'pendente', null),
  ('Bradesco', 'Tarifa conta PJ', 8990, -1, null, 'pago', null),
  ('Malwee', 'Pedido 8910', 275000, 20, null, 'pendente', null),
  ('Aluguel Loja Centro', 'Aluguel próximo mês', 350000, 34, null, 'pendente', null)
) as d(fornecedor, descricao, valor, dias, codigo, status, obs) on d.fornecedor = _f.nome;

commit;
