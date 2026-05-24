-- AITradeX Phase6.2 Auth Foundation - optional standalone file
-- Safe to run multiple times. It prepares Supabase Auth mapping without breaking current frontend testing login.

alter table public.users add column if not exists auth_user_id uuid unique;
alter table public.users add column if not exists password_updated_at timestamptz;
alter table public.users add column if not exists password_updated_by text;

create table if not exists public.admin_roles (
  id text primary key,
  user_id text references public.users(id) on delete cascade,
  auth_user_id uuid,
  role text not null default 'admin',
  permissions jsonb not null default '{}'::jsonb,
  status text not null default 'ACTIVE',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.backend_action_queue (
  id text primary key,
  action_type text not null,
  status text not null default 'PENDING',
  requested_by text,
  target_user_id text,
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz default now(),
  processed_at timestamptz
);

create index if not exists users_auth_user_id_idx on public.users(auth_user_id);
create index if not exists admin_roles_user_id_idx on public.admin_roles(user_id);
create index if not exists backend_action_queue_status_idx on public.backend_action_queue(status, created_at desc);
