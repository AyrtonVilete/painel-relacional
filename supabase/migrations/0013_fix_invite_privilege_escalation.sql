-- ============================================================================
-- 0013_fix_invite_privilege_escalation.sql
-- handle_new_user() granted membership straight from
-- new.raw_user_meta_data ->> 'organization_id'/'role'. Supabase's public
-- signUp() lets any caller set arbitrary options.data, which lands in that
-- same field an admin invite uses — nothing distinguished a real invite
-- from a self-service signup that simply guessed/knew an org's UUID and
-- asked to be made 'admin' of it. Fix: only grant membership from a
-- pending_invites row that an authenticated org admin actually created
-- (via inviteMember's RLS-checked insert), matched by email at signup
-- time — never from client-supplied auth metadata.
-- ============================================================================

create table pending_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  email text not null,
  role membership_role not null default 'member',
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index pending_invites_email_idx on pending_invites (lower(email));
create index pending_invites_organization_id_idx on pending_invites (organization_id);

alter table pending_invites enable row level security;

create policy "org admins can view pending invites"
  on pending_invites for select
  using (is_org_admin(organization_id));

create policy "org admins can create pending invites"
  on pending_invites for insert
  with check (is_org_admin(organization_id));

create policy "org admins can delete pending invites"
  on pending_invites for delete
  using (is_org_admin(organization_id));

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invite record;
begin
  insert into profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  for invite in
    select * from pending_invites where lower(email) = lower(new.email)
  loop
    insert into memberships (organization_id, user_id, role)
    values (invite.organization_id, new.id, invite.role)
    on conflict (organization_id, user_id) do nothing;
  end loop;

  delete from pending_invites where lower(email) = lower(new.email);

  return new;
end;
$$;

-- Same PUBLIC-RPC lockdown as every other trigger-only function in this
-- project (see 0005/0006/0008/0009) — not meant to be callable directly.
revoke all on function handle_new_user() from public, anon, authenticated;
