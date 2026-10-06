-- ============================================================================
-- Run in the Supabase SQL editor, step by step. Drops what is left of the old
-- personal-finance app (fin_* tables, its auth.users trigger, functions and
-- types) that shared this project.
--
-- The DATA is already gone: on 2026-10-06, with Ayrton's approval, every row
-- of the fin_* tables and the two finance-only logins were deleted through
-- the API, after confirming nothing in the Painel's tables referenced them
-- (all Painel row counts were identical before and after). One account that
-- looked finance-only was kept because it carries an old invite to the
-- Nexus organization. What remains are empty tables plus a trigger that
-- still creates a fin_profiles row for every new signup, which is why this
-- script is still worth running. Irreversible.
-- ============================================================================

-- STEP 1 (read-only): every trigger on auth.users. Expect the Painel's own
-- (handle_new_user) and one belonging to the finance app. Check the list
-- before going on: STEP 2 drops every trigger here whose function name
-- contains "fin", and a signup would break if a finance trigger were left
-- pointing at a dropped table.
select t.tgname as trigger_name, p.proname as function_name
from pg_trigger t
join pg_proc p on p.oid = t.tgfoid
where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal
order by 1;

-- STEP 2: drop the finance triggers, tables, functions and types.
begin;

do $$
declare r record;
begin
  for r in
    select t.tgname
    from pg_trigger t
    join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'auth.users'::regclass
      and not t.tgisinternal
      and p.proname ilike '%fin%'
  loop
    execute format('drop trigger %I on auth.users', r.tgname);
  end loop;
end $$;

drop table if exists
  fin_transaction_items,
  fin_transactions,
  fin_categories,
  fin_household_members,
  fin_households,
  fin_profiles
cascade;

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname ilike '%fin%'
      and p.proname not in ('create_organization_with_admin', 'move_ticket')
  loop
    execute format('drop function %s cascade', r.signature);
  end loop;
end $$;

drop type if exists fin_category_kind, fin_risk_profile, fin_transaction_kind;

commit;

-- STEP 3 (read-only): nothing finance-related should be left.
select 'tables' as kind, table_name as name from information_schema.tables
  where table_schema = 'public' and table_name like 'fin\_%'
union all
select 'functions', proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and proname ilike '%fin%';
