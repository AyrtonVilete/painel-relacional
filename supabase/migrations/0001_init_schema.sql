-- ============================================================================
-- 0001_init_schema.sql
-- Core multi-tenant schema for the ticket/helpdesk board system.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------

create type membership_role as enum ('admin', 'approver', 'member');
create type ticket_urgency as enum ('low', 'medium', 'high', 'critical');

-- ----------------------------------------------------------------------------
-- organizations
-- ----------------------------------------------------------------------------

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  plan text not null default 'free',
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ----------------------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- memberships
-- ----------------------------------------------------------------------------

create table memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role membership_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index memberships_organization_id_idx on memberships (organization_id);
create index memberships_user_id_idx on memberships (user_id);

-- ----------------------------------------------------------------------------
-- clients
-- ----------------------------------------------------------------------------

create table clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index clients_organization_id_idx on clients (organization_id);

-- ----------------------------------------------------------------------------
-- boards
-- ----------------------------------------------------------------------------

create table boards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index boards_organization_id_idx on boards (organization_id);

-- ----------------------------------------------------------------------------
-- statuses (kanban columns, configurable per board)
-- ----------------------------------------------------------------------------

create table statuses (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references boards (id) on delete cascade,
  name text not null,
  "order" integer not null default 0,
  created_at timestamptz not null default now()
);

create index statuses_board_id_idx on statuses (board_id);

-- ----------------------------------------------------------------------------
-- ticket_types (configurable per organization)
-- ----------------------------------------------------------------------------

create table ticket_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index ticket_types_organization_id_idx on ticket_types (organization_id);

-- ----------------------------------------------------------------------------
-- sprints
-- ----------------------------------------------------------------------------

create table sprints (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references boards (id) on delete cascade,
  name text not null,
  start_date date,
  end_date date,
  created_at timestamptz not null default now()
);

create index sprints_board_id_idx on sprints (board_id);

-- ----------------------------------------------------------------------------
-- tickets
-- ----------------------------------------------------------------------------

create table tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  board_id uuid not null references boards (id) on delete cascade,
  client_id uuid references clients (id) on delete set null,
  type_id uuid references ticket_types (id) on delete set null,
  status_id uuid not null references statuses (id) on delete restrict,
  sprint_id uuid references sprints (id) on delete set null,
  title text not null,
  description text,
  urgency ticket_urgency not null default 'medium',
  deadline date,
  approved boolean not null default false,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create index tickets_organization_id_idx on tickets (organization_id);
create index tickets_board_id_idx on tickets (board_id);
create index tickets_status_id_idx on tickets (status_id);
create index tickets_sprint_id_idx on tickets (sprint_id);
create index tickets_client_id_idx on tickets (client_id);

-- ----------------------------------------------------------------------------
-- ticket_history
-- Append-only log of every move between statuses/sprints. Never updated.
-- ----------------------------------------------------------------------------

create table ticket_history (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets (id) on delete cascade,
  from_status_id uuid references statuses (id) on delete set null,
  to_status_id uuid references statuses (id) on delete set null,
  from_sprint_id uuid references sprints (id) on delete set null,
  to_sprint_id uuid references sprints (id) on delete set null,
  moved_by uuid not null references auth.users (id),
  moved_at timestamptz not null default now()
);

create index ticket_history_ticket_id_idx on ticket_history (ticket_id);
create index ticket_history_moved_at_idx on ticket_history (moved_at);

-- ----------------------------------------------------------------------------
-- layout_preferences (per user, per board)
-- ----------------------------------------------------------------------------

create table layout_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  board_id uuid not null references boards (id) on delete cascade,
  layout_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id, board_id)
);

create index layout_preferences_board_id_idx on layout_preferences (board_id);
