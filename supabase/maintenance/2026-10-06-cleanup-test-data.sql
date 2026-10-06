-- ============================================================================
-- Run in the Supabase SQL editor. Removes the throwaway data created while
-- testing the access-approval gate (2026-10-06):
--   * organization "Org criada via API direta" (made by calling the RPC
--     directly with an unapproved account, to prove the 0032 backstop is needed)
--   * the test account ayrton.vilete3101+portao1@gmail.com
--
-- Why this can't be done through the API: memberships has a "never remove
-- the last admin of an organization" trigger, and it also fires when an
-- organization or user is deleted (cascade), so a test org that has an admin
-- can't be deleted from the outside. The trigger is switched off for this one
-- transaction only; foreign-key cascades stay active.
-- ============================================================================

-- 1) Look first: this should list exactly the test org(s) and nothing else.
select id, name, created_at from organizations
where name in ('Org criada via API direta', 'Empresa Teste Portao');

-- 2) Then delete.
begin;
alter table memberships disable trigger memberships_prevent_last_admin_removal;
delete from organizations where name in ('Org criada via API direta', 'Empresa Teste Portao');
delete from auth.users where email = 'ayrton.vilete3101+portao1@gmail.com';
alter table memberships enable trigger memberships_prevent_last_admin_removal;
commit;
