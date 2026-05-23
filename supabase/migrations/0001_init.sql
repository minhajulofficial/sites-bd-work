-- ============================================================================
-- PR-02: SITES.BD initial Supabase schema
--
-- Self-contained migration: assumes a blank Postgres database with the
-- Supabase `auth` schema present (i.e. running on a Supabase project) and
-- the `pgcrypto` extension available.
--
-- Every table:
--   * has `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`,
--   * has `created_at TIMESTAMPTZ DEFAULT now()` and
--     `updated_at TIMESTAMPTZ DEFAULT now()`,
--   * has a BEFORE UPDATE trigger calling `public.set_updated_at()`,
--   * has Row Level Security ENABLED with at least one explicit policy.
--
-- Multi-TLD awareness:
--   * `tlds` is the runtime source of truth (seeded from
--     `src/config/domains.json`).
--   * `domains.tld_id` + `domains.name` together form a UNIQUE key, so the
--     same prefix (e.g. `bdshop`) can be claimed once per TLD.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. Generic helper functions
-- ----------------------------------------------------------------------------

-- Bumps `updated_at` to NOW() on every UPDATE. Attached to every table.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Generates a unique customer id of the form `SB-XXXXX` (5 hex chars,
-- uppercased). Loops on collision; cryptographically generated via
-- `gen_random_uuid`. Declared as plpgsql so the reference to
-- `public.profiles` (declared further down) is resolved lazily on first
-- call, not at function-creation time.
create or replace function public.generate_customer_id()
returns text
language plpgsql
volatile
as $$
declare
  candidate text;
  attempts  int := 0;
begin
  loop
    candidate := 'SB-' || upper(
      substring(replace(gen_random_uuid()::text, '-', '') from 1 for 5)
    );
    if not exists (
      select 1 from public.profiles where customer_id = candidate
    ) then
      return candidate;
    end if;

    attempts := attempts + 1;
    if attempts > 100 then
      raise exception
        'generate_customer_id: exhausted attempts to produce unique id';
    end if;
  end loop;
end;
$$;

-- Admin-check helper used by every RLS policy that grants admin overrides.
-- SECURITY DEFINER so the policy check itself does not recurse through the
-- `profiles` RLS policies.
create or replace function public.is_admin(uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if uid is null then
    return false;
  end if;
  return exists (
    select 1 from public.profiles where id = uid and is_admin = true
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. ENUM types (one per status-style column)
-- ----------------------------------------------------------------------------

create type public.profile_status as enum (
  'pending_otp', 'pre_verified', 'profile_verified', 'suspended'
);

create type public.otp_purpose as enum (
  'registration', 'forgot_password'
);

create type public.domain_operational_status as enum (
  'pending', 'active', 'suspend', 'issue', 'expired'
);

create type public.domain_verification_status as enum (
  'waiting', 'verified'
);

create type public.domain_dns_mode as enum (
  'name_server', 'manual_dns'
);

create type public.dns_record_type as enum (
  'A', 'CNAME', 'MX', 'TXT'
);

create type public.dns_record_source as enum (
  'user_manual', 'auto_txt', 'admin', 'system'
);

create type public.txt_review_status as enum (
  'pending', 'approved', 'rejected'
);

create type public.cart_hosting_type as enum (
  'premium', 'free', 'custom_ns', 'custom_ip'
);

create type public.order_status as enum (
  'pending_payment', 'active', 'cancelled'
);

create type public.invoice_status as enum (
  'pending_payment', 'paid', 'cancelled'
);

create type public.service_type as enum (
  'hosting_premium', 'hosting_free', 'hosting_custom', 'addon'
);

create type public.service_status_renewal as enum (
  'pending', 'processing', 'active', 'expired', 'suspended'
);

create type public.service_status_onetime as enum (
  'waiting', 'processing', 'complete', 'cancel'
);

create type public.ticket_category as enum (
  'technical', 'payment', 'general'
);

create type public.ticket_status as enum (
  'open', 'awaiting_user', 'awaiting_admin', 'resolved', 'closed'
);

create type public.ticket_message_sender as enum (
  'user', 'admin'
);

create type public.audit_actor_type as enum (
  'user', 'admin', 'system'
);

-- ============================================================================
-- 3. Tables
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 3.1 tlds — multi-TLD root registry. Created first so `domains` can FK it.
-- ----------------------------------------------------------------------------
create table public.tlds (
  id                  uuid primary key default gen_random_uuid(),
  slug                text unique not null,
  name                text unique not null,
  env_prefix          text not null,
  cloudflare_zone_id  text not null,
  enabled             boolean not null default true,
  is_primary          boolean not null default false,
  display_order       int not null default 0,
  label               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index tlds_enabled_idx on public.tlds (enabled);
create index tlds_display_order_idx on public.tlds (display_order);

-- Only one TLD may be the primary one.
create unique index tlds_single_primary_idx
  on public.tlds (is_primary)
  where is_primary = true;

create trigger trg_tlds_set_updated_at
  before update on public.tlds
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 3.2 profiles — per-user metadata, mirrors `auth.users` 1:1.
-- ----------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key
               references auth.users(id) on delete cascade,
  customer_id  text unique not null,
  full_name    text,
  email        text unique not null,
  mobile       text unique not null,
  address      text,
  status       public.profile_status not null default 'pending_otp',
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index profiles_status_idx on public.profiles (status);
create index profiles_is_admin_idx on public.profiles (is_admin) where is_admin = true;

create trigger trg_profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-fill customer_id when caller leaves it null.
create or replace function public.profiles_set_customer_id()
returns trigger
language plpgsql
as $$
begin
  if new.customer_id is null then
    new.customer_id := public.generate_customer_id();
  end if;
  return new;
end;
$$;

create trigger trg_profiles_set_customer_id
  before insert on public.profiles
  for each row execute function public.profiles_set_customer_id();

-- Immutability: once status is `profile_verified`, neither `email` nor
-- `mobile` can be changed unless the caller is the service role.
create or replace function public.profiles_enforce_immutability()
returns trigger
language plpgsql
as $$
begin
  if current_user = 'service_role' then
    return new;
  end if;
  if old.status = 'profile_verified' then
    if new.email is distinct from old.email then
      raise exception
        'profiles.email is immutable once status=profile_verified';
    end if;
    if new.mobile is distinct from old.mobile then
      raise exception
        'profiles.mobile is immutable once status=profile_verified';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_profiles_enforce_immutability
  before update on public.profiles
  for each row execute function public.profiles_enforce_immutability();

-- ----------------------------------------------------------------------------
-- 3.3 otp_codes — registration / forgot-password OTPs (hashed at rest).
-- ----------------------------------------------------------------------------
create table public.otp_codes (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  code_hash    text not null,
  purpose      public.otp_purpose not null,
  expires_at   timestamptz not null default (now() + interval '5 minutes'),
  consumed_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index otp_codes_email_purpose_idx on public.otp_codes (email, purpose);
create index otp_codes_expires_at_idx on public.otp_codes (expires_at);

create trigger trg_otp_codes_set_updated_at
  before update on public.otp_codes
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 3.4 domains — one claimed subdomain on a specific TLD.
-- ----------------------------------------------------------------------------
create table public.domains (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null
                        references public.profiles(id) on delete cascade,
  tld_id                uuid not null
                        references public.tlds(id) on delete restrict,
  name                  text not null,
  full_domain           text not null,
  operational_status    public.domain_operational_status not null default 'pending',
  verification_status   public.domain_verification_status not null default 'waiting',
  dns_mode              public.domain_dns_mode not null default 'name_server',
  custom_ns             text[],
  cloudflare_record_id  text,
  registered_at         timestamptz not null default now(),
  expires_at            timestamptz not null default (now() + interval '1 year'),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (tld_id, name),
  unique (full_domain)
);

create index domains_tld_id_idx on public.domains (tld_id);
create index domains_user_id_idx on public.domains (user_id);
create index domains_expires_at_idx on public.domains (expires_at);
create index domains_operational_status_idx on public.domains (operational_status);

create trigger trg_domains_set_updated_at
  before update on public.domains
  for each row execute function public.set_updated_at();

-- `full_domain` is computed as `name.tld_name`. Postgres GENERATED columns
-- cannot subquery, so we maintain it via a BEFORE INSERT/UPDATE trigger.
create or replace function public.domains_compose_full_domain()
returns trigger
language plpgsql
as $$
declare
  tld_name text;
begin
  select t.name into tld_name from public.tlds t where t.id = new.tld_id;
  if tld_name is null then
    raise exception
      'domains.tld_id % does not reference an existing tlds row', new.tld_id;
  end if;
  new.full_domain := lower(new.name) || '.' || tld_name;
  return new;
end;
$$;

create trigger trg_domains_compose_full_domain
  before insert or update of name, tld_id on public.domains
  for each row execute function public.domains_compose_full_domain();

-- ----------------------------------------------------------------------------
-- 3.5 dns_records — per-domain Cloudflare records.
-- ----------------------------------------------------------------------------
create table public.dns_records (
  id                   uuid primary key default gen_random_uuid(),
  domain_id            uuid not null
                       references public.domains(id) on delete cascade,
  tld_id               uuid not null
                       references public.tlds(id) on delete restrict,
  type                 public.dns_record_type not null,
  name                 text not null,
  content              text not null,
  ttl                  int not null default 3600,
  priority             int,
  cloudflare_record_id text,
  source               public.dns_record_source not null default 'user_manual',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index dns_records_domain_id_idx on public.dns_records (domain_id);
create index dns_records_tld_id_idx on public.dns_records (tld_id);

create trigger trg_dns_records_set_updated_at
  before update on public.dns_records
  for each row execute function public.set_updated_at();

-- `dns_records.tld_id` is denormalised for fast multi-TLD queries — enforce
-- that it always matches the parent domain's tld_id (or auto-fill when
-- omitted).
create or replace function public.dns_records_assert_tld_match()
returns trigger
language plpgsql
as $$
declare
  parent_tld uuid;
begin
  select d.tld_id into parent_tld
    from public.domains d
   where d.id = new.domain_id;

  if parent_tld is null then
    raise exception
      'dns_records.domain_id % does not reference an existing domain',
      new.domain_id;
  end if;

  if new.tld_id is null then
    new.tld_id := parent_tld;
  elsif new.tld_id <> parent_tld then
    raise exception
      'dns_records.tld_id (%) must match parent domain.tld_id (%)',
      new.tld_id, parent_tld;
  end if;

  return new;
end;
$$;

create trigger trg_dns_records_assert_tld_match
  before insert or update of domain_id, tld_id on public.dns_records
  for each row execute function public.dns_records_assert_tld_match();

-- ----------------------------------------------------------------------------
-- 3.6 txt_review_queue — TXT records flagged for admin review.
-- ----------------------------------------------------------------------------
create table public.txt_review_queue (
  id            uuid primary key default gen_random_uuid(),
  domain_id     uuid not null
                references public.domains(id) on delete cascade,
  user_id       uuid not null
                references public.profiles(id) on delete cascade,
  name          text not null,
  content       text not null,
  reason        text,
  status        public.txt_review_status not null default 'pending',
  reviewed_by   uuid references public.profiles(id) on delete set null,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index txt_review_queue_user_id_idx on public.txt_review_queue (user_id);
create index txt_review_queue_status_idx on public.txt_review_queue (status);

create trigger trg_txt_review_queue_set_updated_at
  before update on public.txt_review_queue
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 3.7 cart_items — pre-claim cart, supports authenticated + guest carts.
-- ----------------------------------------------------------------------------
create table public.cart_items (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references public.profiles(id) on delete cascade,
  session_token     text,
  tld_id            uuid not null
                    references public.tlds(id) on delete cascade,
  domain_name       text not null,
  full_domain       text not null,
  hosting_plan_id   text,
  hosting_type      public.cart_hosting_type,
  custom_ns_values  text[],
  custom_ip_value   text,
  addons            jsonb not null default '[]'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint cart_items_owner_xor
    check ((user_id is not null) <> (session_token is not null))
);

create index cart_items_user_id_idx on public.cart_items (user_id);
create index cart_items_session_token_idx on public.cart_items (session_token);
create index cart_items_tld_id_idx on public.cart_items (tld_id);

create trigger trg_cart_items_set_updated_at
  before update on public.cart_items
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 3.8 orders — checkout snapshot of one cart submission.
-- ----------------------------------------------------------------------------
create table public.orders (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null
                references public.profiles(id) on delete cascade,
  order_number  text unique not null,
  status        public.order_status not null default 'pending_payment',
  total_bdt     numeric(10, 2) not null default 0,
  items         jsonb not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index orders_user_id_idx on public.orders (user_id);
create index orders_status_idx on public.orders (status);

create trigger trg_orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 3.9 invoices — one invoice per order; admin marks paid.
-- ----------------------------------------------------------------------------
create table public.invoices (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null
                  references public.orders(id) on delete cascade,
  user_id         uuid not null
                  references public.profiles(id) on delete cascade,
  invoice_number  text unique not null,
  amount_bdt      numeric(10, 2) not null,
  status          public.invoice_status not null default 'pending_payment',
  paid_at         timestamptz,
  paid_by_admin   uuid references public.profiles(id) on delete set null,
  internal_notes  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index invoices_user_id_idx on public.invoices (user_id);
create index invoices_order_id_idx on public.invoices (order_id);
create index invoices_status_idx on public.invoices (status);

create trigger trg_invoices_set_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 3.10 services — hosting + addon entitlements provisioned to a user.
-- ----------------------------------------------------------------------------
create table public.services (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null
                              references public.profiles(id) on delete cascade,
  domain_id                   uuid references public.domains(id) on delete set null,
  type                        public.service_type not null,
  plan_id                     text,
  status_renewal              public.service_status_renewal,
  status_onetime              public.service_status_onetime,
  access_url                  text,
  access_username_encrypted   text,
  access_password_encrypted   text,
  internal_notes              text,
  expires_at                  timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index services_user_id_idx on public.services (user_id);
create index services_domain_id_idx on public.services (domain_id);
create index services_type_idx on public.services (type);

create trigger trg_services_set_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 3.11 tickets — support ticket header.
-- ----------------------------------------------------------------------------
create table public.tickets (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null
                   references public.profiles(id) on delete cascade,
  ticket_number    text unique not null,
  category         public.ticket_category not null,
  whatsapp_number  text not null,
  subject          text not null,
  status           public.ticket_status not null default 'open',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index tickets_user_id_idx on public.tickets (user_id);
create index tickets_status_idx on public.tickets (status);

create trigger trg_tickets_set_updated_at
  before update on public.tickets
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 3.12 ticket_messages — message thread under a ticket.
-- ----------------------------------------------------------------------------
create table public.ticket_messages (
  id           uuid primary key default gen_random_uuid(),
  ticket_id    uuid not null
               references public.tickets(id) on delete cascade,
  sender       public.ticket_message_sender not null,
  sender_id    uuid,
  body         text not null,
  attachments  jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index ticket_messages_ticket_id_idx on public.ticket_messages (ticket_id);

create trigger trg_ticket_messages_set_updated_at
  before update on public.ticket_messages
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 3.13 banners — admin-controlled dashboard banner slider.
-- ----------------------------------------------------------------------------
create table public.banners (
  id              uuid primary key default gen_random_uuid(),
  image_url       text not null,
  link_url        text,
  display_order   int not null default 0,
  active          boolean not null default true,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index banners_active_order_idx on public.banners (active, display_order);

create trigger trg_banners_set_updated_at
  before update on public.banners
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 3.14 audit_log — append-only audit trail.
-- ----------------------------------------------------------------------------
create table public.audit_log (
  id            uuid primary key default gen_random_uuid(),
  actor_id      uuid,
  actor_type    public.audit_actor_type not null,
  action        text not null,
  target_table  text,
  target_id     uuid,
  payload       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index audit_log_actor_id_idx on public.audit_log (actor_id);
create index audit_log_target_idx on public.audit_log (target_table, target_id);

create trigger trg_audit_log_set_updated_at
  before update on public.audit_log
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 4. Row Level Security — enable on every table and write explicit policies.
-- ============================================================================

-- 4.1 tlds ---------------------------------------------------------------------
alter table public.tlds enable row level security;

create policy tlds_public_select_enabled
  on public.tlds
  for select
  to anon, authenticated
  using (enabled = true);

create policy tlds_admin_select_all
  on public.tlds
  for select
  to authenticated
  using (public.is_admin(auth.uid()));

create policy tlds_admin_insert
  on public.tlds
  for insert
  to authenticated
  with check (public.is_admin(auth.uid()));

create policy tlds_admin_update
  on public.tlds
  for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy tlds_admin_delete
  on public.tlds
  for delete
  to authenticated
  using (public.is_admin(auth.uid()));

-- 4.2 profiles -----------------------------------------------------------------
alter table public.profiles enable row level security;

create policy profiles_self_select
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

create policy profiles_self_update
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy profiles_admin_select
  on public.profiles
  for select
  to authenticated
  using (public.is_admin(auth.uid()));

create policy profiles_admin_update
  on public.profiles
  for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy profiles_admin_insert
  on public.profiles
  for insert
  to authenticated
  with check (public.is_admin(auth.uid()));

create policy profiles_admin_delete
  on public.profiles
  for delete
  to authenticated
  using (public.is_admin(auth.uid()));

-- 4.3 otp_codes ----------------------------------------------------------------
-- Mutated exclusively via server actions running with the service role key.
-- RLS is enabled with no anon/authenticated policies, so all client-side
-- reads/writes are denied by default.
alter table public.otp_codes enable row level security;

create policy otp_codes_admin_select
  on public.otp_codes
  for select
  to authenticated
  using (public.is_admin(auth.uid()));

-- 4.4 domains ------------------------------------------------------------------
alter table public.domains enable row level security;

create policy domains_user_select
  on public.domains
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy domains_user_insert
  on public.domains
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy domains_user_update
  on public.domains
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy domains_user_delete
  on public.domains
  for delete
  to authenticated
  using (auth.uid() = user_id);

create policy domains_admin_select
  on public.domains
  for select
  to authenticated
  using (public.is_admin(auth.uid()));

create policy domains_admin_insert
  on public.domains
  for insert
  to authenticated
  with check (public.is_admin(auth.uid()));

create policy domains_admin_update
  on public.domains
  for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy domains_admin_delete
  on public.domains
  for delete
  to authenticated
  using (public.is_admin(auth.uid()));

-- 4.5 dns_records --------------------------------------------------------------
alter table public.dns_records enable row level security;

create policy dns_records_user_select
  on public.dns_records
  for select
  to authenticated
  using (
    exists (
      select 1 from public.domains d
       where d.id = dns_records.domain_id and d.user_id = auth.uid()
    )
  );

create policy dns_records_user_insert
  on public.dns_records
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.domains d
       where d.id = dns_records.domain_id and d.user_id = auth.uid()
    )
  );

create policy dns_records_user_update
  on public.dns_records
  for update
  to authenticated
  using (
    exists (
      select 1 from public.domains d
       where d.id = dns_records.domain_id and d.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.domains d
       where d.id = dns_records.domain_id and d.user_id = auth.uid()
    )
  );

create policy dns_records_user_delete
  on public.dns_records
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.domains d
       where d.id = dns_records.domain_id and d.user_id = auth.uid()
    )
  );

create policy dns_records_admin_all_select
  on public.dns_records
  for select
  to authenticated
  using (public.is_admin(auth.uid()));

create policy dns_records_admin_all_insert
  on public.dns_records
  for insert
  to authenticated
  with check (public.is_admin(auth.uid()));

create policy dns_records_admin_all_update
  on public.dns_records
  for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy dns_records_admin_all_delete
  on public.dns_records
  for delete
  to authenticated
  using (public.is_admin(auth.uid()));

-- 4.6 txt_review_queue ---------------------------------------------------------
alter table public.txt_review_queue enable row level security;

create policy txt_review_queue_user_select_pending
  on public.txt_review_queue
  for select
  to authenticated
  using (user_id = auth.uid() and status = 'pending');

create policy txt_review_queue_admin_select
  on public.txt_review_queue
  for select
  to authenticated
  using (public.is_admin(auth.uid()));

create policy txt_review_queue_admin_insert
  on public.txt_review_queue
  for insert
  to authenticated
  with check (public.is_admin(auth.uid()));

create policy txt_review_queue_admin_update
  on public.txt_review_queue
  for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy txt_review_queue_admin_delete
  on public.txt_review_queue
  for delete
  to authenticated
  using (public.is_admin(auth.uid()));

-- 4.7 cart_items ---------------------------------------------------------------
alter table public.cart_items enable row level security;

create policy cart_items_user_select
  on public.cart_items
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy cart_items_user_insert
  on public.cart_items
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy cart_items_user_update
  on public.cart_items
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy cart_items_user_delete
  on public.cart_items
  for delete
  to authenticated
  using (auth.uid() = user_id);

create policy cart_items_admin_all_select
  on public.cart_items
  for select
  to authenticated
  using (public.is_admin(auth.uid()));

create policy cart_items_admin_all_insert
  on public.cart_items
  for insert
  to authenticated
  with check (public.is_admin(auth.uid()));

create policy cart_items_admin_all_update
  on public.cart_items
  for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy cart_items_admin_all_delete
  on public.cart_items
  for delete
  to authenticated
  using (public.is_admin(auth.uid()));

-- 4.8 orders -------------------------------------------------------------------
alter table public.orders enable row level security;

create policy orders_user_select
  on public.orders
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy orders_user_insert
  on public.orders
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy orders_admin_select
  on public.orders
  for select
  to authenticated
  using (public.is_admin(auth.uid()));

create policy orders_admin_update
  on public.orders
  for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy orders_admin_delete
  on public.orders
  for delete
  to authenticated
  using (public.is_admin(auth.uid()));

-- 4.9 invoices -----------------------------------------------------------------
alter table public.invoices enable row level security;

create policy invoices_user_select
  on public.invoices
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy invoices_admin_select
  on public.invoices
  for select
  to authenticated
  using (public.is_admin(auth.uid()));

create policy invoices_admin_insert
  on public.invoices
  for insert
  to authenticated
  with check (public.is_admin(auth.uid()));

create policy invoices_admin_update
  on public.invoices
  for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy invoices_admin_delete
  on public.invoices
  for delete
  to authenticated
  using (public.is_admin(auth.uid()));

-- 4.10 services ----------------------------------------------------------------
alter table public.services enable row level security;

create policy services_user_select
  on public.services
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy services_admin_select
  on public.services
  for select
  to authenticated
  using (public.is_admin(auth.uid()));

create policy services_admin_insert
  on public.services
  for insert
  to authenticated
  with check (public.is_admin(auth.uid()));

create policy services_admin_update
  on public.services
  for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy services_admin_delete
  on public.services
  for delete
  to authenticated
  using (public.is_admin(auth.uid()));

-- 4.11 tickets -----------------------------------------------------------------
alter table public.tickets enable row level security;

create policy tickets_user_select
  on public.tickets
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy tickets_user_insert
  on public.tickets
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy tickets_user_update
  on public.tickets
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy tickets_admin_select
  on public.tickets
  for select
  to authenticated
  using (public.is_admin(auth.uid()));

create policy tickets_admin_update
  on public.tickets
  for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy tickets_admin_delete
  on public.tickets
  for delete
  to authenticated
  using (public.is_admin(auth.uid()));

-- 4.12 ticket_messages ---------------------------------------------------------
alter table public.ticket_messages enable row level security;

create policy ticket_messages_user_select
  on public.ticket_messages
  for select
  to authenticated
  using (
    exists (
      select 1 from public.tickets t
       where t.id = ticket_messages.ticket_id and t.user_id = auth.uid()
    )
  );

create policy ticket_messages_user_insert
  on public.ticket_messages
  for insert
  to authenticated
  with check (
    sender = 'user'
    and exists (
      select 1 from public.tickets t
       where t.id = ticket_messages.ticket_id and t.user_id = auth.uid()
    )
  );

create policy ticket_messages_admin_select
  on public.ticket_messages
  for select
  to authenticated
  using (public.is_admin(auth.uid()));

create policy ticket_messages_admin_insert
  on public.ticket_messages
  for insert
  to authenticated
  with check (public.is_admin(auth.uid()));

create policy ticket_messages_admin_update
  on public.ticket_messages
  for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy ticket_messages_admin_delete
  on public.ticket_messages
  for delete
  to authenticated
  using (public.is_admin(auth.uid()));

-- 4.13 banners -----------------------------------------------------------------
alter table public.banners enable row level security;

create policy banners_authenticated_select_active
  on public.banners
  for select
  to authenticated
  using (active = true);

create policy banners_admin_select
  on public.banners
  for select
  to authenticated
  using (public.is_admin(auth.uid()));

create policy banners_admin_insert
  on public.banners
  for insert
  to authenticated
  with check (public.is_admin(auth.uid()));

create policy banners_admin_update
  on public.banners
  for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy banners_admin_delete
  on public.banners
  for delete
  to authenticated
  using (public.is_admin(auth.uid()));

-- 4.14 audit_log ---------------------------------------------------------------
-- Written by server actions via service-role key only. Admins may read.
alter table public.audit_log enable row level security;

create policy audit_log_admin_select
  on public.audit_log
  for select
  to authenticated
  using (public.is_admin(auth.uid()));
