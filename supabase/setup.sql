create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.organizations add column if not exists active boolean not null default true;

create table if not exists public.bid_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id),
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

create table if not exists public.organization_profiles (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  profile_json jsonb not null default '{}'::jsonb,
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
  source_name text,
  source_url text,
  source_published_at timestamptz,
  discovered_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.opportunities add column if not exists source_name text;
alter table public.opportunities add column if not exists source_url text;
alter table public.opportunities add column if not exists source_published_at timestamptz;
alter table public.opportunities add column if not exists discovered_at timestamptz;
alter table public.opportunities alter column created_by drop not null;
create unique index if not exists opportunities_source_url_unique
  on public.opportunities(source_url) where source_url is not null;
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

create table if not exists public.discovery_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null check (status in ('running', 'completed', 'failed')),
  sources_json jsonb not null default '[]'::jsonb,
  searches_count integer not null default 0 check (searches_count >= 0),
  candidates_count integer not null default 0 check (candidates_count >= 0),
  added_count integer not null default 0 check (added_count >= 0),
  error_message text
);
create index if not exists discovery_runs_started on public.discovery_runs(started_at desc);

alter table public.bid_users add column if not exists organization_id uuid references public.organizations(id);
alter table public.opportunities add column if not exists organization_id uuid references public.organizations(id);
alter table public.proposals add column if not exists organization_id uuid references public.organizations(id);
alter table public.projects add column if not exists organization_id uuid references public.organizations(id);
alter table public.milestones add column if not exists organization_id uuid references public.organizations(id);
alter table public.audit_log add column if not exists organization_id uuid references public.organizations(id);
alter table public.discovery_runs add column if not exists organization_id uuid references public.organizations(id);

do $$
declare
  v_org_id uuid;
  v_org_name text;
begin
  select nullif(btrim(profile_json->>'legal_name'), '')
    into v_org_name
    from public.company_profile
    where id = 1;
  v_org_name := coalesce(v_org_name, 'NEXA BidOps Customer');
  select id into v_org_id from public.organizations order by created_at, id limit 1;
  if v_org_id is null then
    insert into public.organizations (name)
    values (v_org_name)
    returning id into v_org_id;
  end if;

  update public.bid_users set organization_id = v_org_id where organization_id is null;
  update public.opportunities set organization_id = v_org_id where organization_id is null;
  update public.projects set organization_id = v_org_id where organization_id is null;
  update public.proposals set organization_id = v_org_id where organization_id is null;
  update public.milestones set organization_id = v_org_id where organization_id is null;
  update public.audit_log set organization_id = v_org_id where organization_id is null;
  update public.discovery_runs set organization_id = v_org_id where organization_id is null;

  if not exists (select 1 from public.organization_profiles where organization_id = v_org_id) then
    insert into public.organization_profiles (organization_id, profile_json)
    select v_org_id, profile_json || jsonb_build_object('onboarding_complete', false)
    from public.company_profile where id = 1
    on conflict (organization_id) do nothing;
  end if;
end;
$$;

alter table public.bid_users alter column organization_id set not null;
alter table public.opportunities alter column organization_id set not null;
alter table public.proposals alter column organization_id set not null;
alter table public.projects alter column organization_id set not null;
alter table public.milestones alter column organization_id set not null;
alter table public.audit_log alter column organization_id set not null;
alter table public.discovery_runs alter column organization_id set not null;

create index if not exists bid_users_organization on public.bid_users(organization_id, created_at);
create index if not exists opportunities_organization_deadline on public.opportunities(organization_id, deadline);
create index if not exists projects_organization_updated on public.projects(organization_id, updated_at desc);
create index if not exists proposals_organization_updated on public.proposals(organization_id, updated_at desc);
create index if not exists milestones_organization_project on public.milestones(organization_id, project_id);
create index if not exists audit_log_organization_created on public.audit_log(organization_id, created_at desc);
create index if not exists discovery_runs_organization_started on public.discovery_runs(organization_id, started_at desc);

drop index if exists public.opportunities_source_url_unique;
create unique index if not exists opportunities_organization_source_url_unique
  on public.opportunities(organization_id, source_url) where source_url is not null;

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
drop trigger if exists organization_profiles_updated_at on public.organization_profiles;
create trigger organization_profiles_updated_at before update on public.organization_profiles
for each row execute function public.afc_set_updated_at();
drop trigger if exists organizations_updated_at on public.organizations;
create trigger organizations_updated_at before update on public.organizations
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
alter table public.organizations enable row level security;
alter table public.company_profile enable row level security;
alter table public.organization_profiles enable row level security;
alter table public.opportunities enable row level security;
alter table public.proposals enable row level security;
alter table public.projects enable row level security;
alter table public.milestones enable row level security;
alter table public.audit_log enable row level security;
alter table public.login_rate_limit enable row level security;
alter table public.discovery_runs enable row level security;

revoke all on public.organizations, public.bid_users, public.company_profile, public.organization_profiles, public.opportunities, public.proposals,
  public.projects, public.milestones, public.audit_log, public.login_rate_limit, public.discovery_runs from anon, authenticated;
grant all on public.organizations, public.bid_users, public.company_profile, public.organization_profiles, public.opportunities, public.proposals,
  public.projects, public.milestones, public.audit_log, public.login_rate_limit, public.discovery_runs to service_role;
grant usage, select on sequence public.audit_log_id_seq to service_role;

create or replace function public.nexa_record_login_hit(p_identity_hash text, p_limit integer default 10)
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
revoke all on function public.nexa_record_login_hit(text, integer) from public, anon, authenticated;
grant execute on function public.nexa_record_login_hit(text, integer) to service_role;
drop function if exists public.afc_record_login_hit(text, integer);
revoke all on function public.afc_set_updated_at() from public, anon, authenticated;

alter table public.bid_users
  add column if not exists phone text,
  add column if not exists marketing_consent boolean not null default false,
  add column if not exists marketing_consent_at timestamptz,
  add column if not exists last_sign_in_at timestamptz;

create table if not exists public.subscriptions (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  plan text not null default 'pro' check (plan in ('pro', 'premium', 'enterprise')),
  status text not null default 'trialing' check (status in ('trialing', 'active', 'past_due', 'canceled', 'expired')),
  trial_started_at timestamptz not null default now(),
  trial_ends_at timestamptz not null default (now() + interval '7 days'),
  current_period_start timestamptz,
  current_period_end timestamptz,
  provider text check (provider in ('stripe', 'mpesa', 'manual')),
  provider_customer_id text,
  provider_subscription_id text,
  selected_at timestamptz not null default now(),
  activated_at timestamptz,
  expired_at timestamptz,
  last_reminder_day integer check (last_reminder_day between 0 and 3),
  returning_client boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subscriptions_status_trial_end
  on public.subscriptions(status, trial_ends_at);
insert into public.subscriptions (organization_id, plan, status, trial_started_at, trial_ends_at, activated_at)
select id, 'pro', 'active', now(), now() + interval '7 days', now()
from public.organizations
on conflict (organization_id) do nothing;

create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  plan text check (plan in ('pro', 'premium', 'enterprise')),
  provider text,
  provider_event_id text unique,
  detail_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists subscription_events_org_created
  on public.subscription_events(organization_id, created_at desc);

create table if not exists public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan text not null check (plan in ('pro', 'premium', 'enterprise')),
  provider text not null check (provider in ('stripe', 'mpesa')),
  provider_checkout_id text unique,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed')),
  detail_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payment_attempts_org_created
  on public.payment_attempts(organization_id, created_at desc);

create table if not exists public.bid_learnings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_opportunity_id uuid references public.opportunities(id) on delete set null,
  title text not null,
  learning_text text not null,
  status text not null default 'draft' check (status in ('draft', 'reviewed', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bid_learnings_org_created
  on public.bid_learnings(organization_id, created_at desc);

create table if not exists public.nexa_platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.nexa_platform_admin_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  target_organization_id text,
  event_type text not null,
  detail_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists nexa_platform_admin_events_created
  on public.nexa_platform_admin_events(created_at desc);

create table if not exists public.support_requests (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete set null,
  name text not null,
  email text not null,
  phone text,
  subject text not null,
  message text not null,
  marketing_consent boolean not null default false,
  marketing_consent_at timestamptz,
  status text not null default 'new' check (status in ('new', 'in_progress', 'resolved')),
  created_at timestamptz not null default now()
);
create index if not exists support_requests_created on public.support_requests(created_at desc);
create index if not exists bid_users_marketing_consent on public.bid_users(marketing_consent, created_at desc);

drop trigger if exists subscriptions_updated_at on public.subscriptions;
create trigger subscriptions_updated_at before update on public.subscriptions
for each row execute function public.afc_set_updated_at();
drop trigger if exists payment_attempts_updated_at on public.payment_attempts;
create trigger payment_attempts_updated_at before update on public.payment_attempts
for each row execute function public.afc_set_updated_at();
drop trigger if exists bid_learnings_updated_at on public.bid_learnings;
create trigger bid_learnings_updated_at before update on public.bid_learnings
for each row execute function public.afc_set_updated_at();

alter table public.subscriptions enable row level security;
alter table public.subscription_events enable row level security;
alter table public.payment_attempts enable row level security;
alter table public.bid_learnings enable row level security;
alter table public.nexa_platform_admins enable row level security;
alter table public.nexa_platform_admin_events enable row level security;
alter table public.support_requests enable row level security;
revoke all on public.subscriptions, public.subscription_events, public.payment_attempts, public.bid_learnings, public.nexa_platform_admins, public.nexa_platform_admin_events, public.support_requests from anon, authenticated;
grant all on public.subscriptions, public.subscription_events, public.payment_attempts, public.bid_learnings, public.nexa_platform_admins, public.nexa_platform_admin_events, public.support_requests to service_role;
grant usage, select on sequence public.support_requests_id_seq to service_role;
grant usage, select on sequence public.nexa_platform_admin_events_id_seq to service_role;
