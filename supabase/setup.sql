create extension if not exists pgcrypto;

create table if not exists public.bid_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text not null,
  role text not null check (role in ('owner', 'manager', 'writer')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.bid_users add column if not exists email text;
update public.bid_users as bid
set email = auth_user.email
from auth.users as auth_user
where bid.user_id = auth_user.id and bid.email is null and auth_user.email is not null;
create unique index if not exists bid_users_email_unique on public.bid_users(lower(email)) where email is not null;

create table if not exists public.company_profile (
  id integer primary key check (id = 1),
  profile_json jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 240),
  funder text not null check (char_length(funder) between 1 and 190),
  funder_type text not null default '',
  sector text not null default '',
  country text not null default '',
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  value numeric(15,2) not null default 0 check (value >= 0),
  deadline date,
  stage text not null default 'Discovered'
    check (stage in ('Discovered','GoNoGo','Drafting','Review','Submitted','Won','Lost','NoGo')),
  requirements text not null default '',
  owner text not null default '',
  notes text not null default '',
  fit_score integer not null default 0 check (fit_score between 0 and 100),
  fit_json jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists opportunities_stage_deadline on public.opportunities(stage, deadline);
create index if not exists opportunities_updated on public.opportunities(updated_at desc);

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null unique references public.opportunities(id) on delete cascade,
  sections_json jsonb not null,
  interview_json jsonb,
  status text not null default 'Draft' check (status in ('Draft','In review','Approved')),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null unique references public.opportunities(id) on delete cascade,
  project_manager text not null default '',
  start_date date,
  status text not null default 'Mobilising' check (status in ('Mobilising','Active','At risk','Complete','Paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  due_date date,
  status text not null default 'Not started' check (status in ('Not started','In progress','Done','At risk')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  detail_json jsonb,
  created_at timestamptz not null default now()
);
create index if not exists bid_audit_created on public.audit_log(created_at desc);

create table if not exists public.login_rate_limit (
  identity_hash text not null check (identity_hash ~ '^[a-f0-9]{64}$'),
  window_start timestamptz not null,
  hits integer not null check (hits > 0),
  primary key (identity_hash, window_start)
);

create or replace function public.afc_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists company_profile_updated_at on public.company_profile;
create trigger company_profile_updated_at before update on public.company_profile
for each row execute function public.afc_set_updated_at();
drop trigger if exists opportunities_updated_at on public.opportunities;
create trigger opportunities_updated_at before update on public.opportunities
for each row execute function public.afc_set_updated_at();
drop trigger if exists proposals_updated_at on public.proposals;
create trigger proposals_updated_at before update on public.proposals
for each row execute function public.afc_set_updated_at();
drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at before update on public.projects
for each row execute function public.afc_set_updated_at();
drop trigger if exists milestones_updated_at on public.milestones;
create trigger milestones_updated_at before update on public.milestones
for each row execute function public.afc_set_updated_at();

alter table public.bid_users enable row level security;
alter table public.company_profile enable row level security;
alter table public.opportunities enable row level security;
alter table public.proposals enable row level security;
alter table public.projects enable row level security;
alter table public.milestones enable row level security;
alter table public.audit_log enable row level security;
alter table public.login_rate_limit enable row level security;

revoke all on public.bid_users, public.company_profile, public.opportunities, public.proposals,
  public.projects, public.milestones, public.audit_log, public.login_rate_limit from anon, authenticated;
grant all on public.bid_users, public.company_profile, public.opportunities, public.proposals,
  public.projects, public.milestones, public.audit_log, public.login_rate_limit to service_role;
grant usage, select on sequence public.audit_log_id_seq to service_role;

create or replace function public.afc_record_login_hit(p_identity_hash text, p_limit integer default 10)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start timestamptz;
  v_hits integer;
begin
  if p_identity_hash !~ '^[a-f0-9]{64}$' or p_limit < 1 or p_limit > 100 then
    raise exception 'Invalid rate-limit arguments';
  end if;
  v_start := to_timestamp(floor(extract(epoch from now()) / 900) * 900);
  insert into public.login_rate_limit(identity_hash, window_start, hits)
  values (p_identity_hash, v_start, 1)
  on conflict (identity_hash, window_start)
  do update set hits = public.login_rate_limit.hits + 1
  returning hits into v_hits;
  if random() < 0.02 then
    delete from public.login_rate_limit where window_start < now() - interval '1 day';
  end if;
  return v_hits;
end;
$$;
revoke all on function public.afc_record_login_hit(text, integer) from public, anon, authenticated;
grant execute on function public.afc_record_login_hit(text, integer) to service_role;
revoke all on function public.afc_set_updated_at() from public, anon, authenticated;
