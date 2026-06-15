-- ============================================================================
-- ai_prospect — Migration 0001: schema, índices, RLS, realtime, settings
-- Fonte da verdade: specs/02-data-model.md (contrato C3)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type lead_status as enum (
    'novo','pontuado','pronto','aprovado','enviado','respondeu','fechou','descartado','nao_perturbe'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type job_status as enum ('pending','running','done','error');
exception when duplicate_object then null; end $$;

do $$ begin
  create type send_status as enum ('agendado','enviado','falhou','cancelado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type niche_tier as enum ('quente','morno','frio');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Trigger util: updated_at
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- scrape_jobs — fila de mapeamento (ponte web <-> agente local)
-- ---------------------------------------------------------------------------
create table if not exists scrape_jobs (
  id            uuid primary key default gen_random_uuid(),
  status        job_status   not null default 'pending',
  niche         text         not null,
  city          text         not null,
  target_count  int          not null default 50,
  found_count   int          not null default 0,
  error_message text,
  created_at    timestamptz  not null default now(),
  started_at    timestamptz,
  finished_at   timestamptz
);
create index if not exists idx_scrape_jobs_status on scrape_jobs (status, created_at);

-- ---------------------------------------------------------------------------
-- leads
-- ---------------------------------------------------------------------------
create table if not exists leads (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid references scrape_jobs(id) on delete set null,
  name            text not null,
  phone           text,                         -- E.164 (ex.: 5585999999999) — base do dedupe
  raw_phone       text,
  address         text,
  category_maps   text,
  niche           text,
  niche_tier      niche_tier,
  rating          numeric(2,1),
  num_reviews     int,
  has_instagram   boolean not null default false,
  instagram_url   text,
  maps_url        text,
  has_website     boolean not null default false,
  score           int,
  reasoning_score text,
  status          lead_status not null default 'novo',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
-- dedupe por telefone (ignora nulos — leads sem telefone não são inseridos pelo agente)
create unique index if not exists uq_leads_phone on leads (phone) where phone is not null;
create index if not exists idx_leads_status     on leads (status);
create index if not exists idx_leads_score       on leads (score desc);
create index if not exists idx_leads_niche_tier  on leads (niche_tier);
create index if not exists idx_leads_created_at  on leads (created_at);

drop trigger if exists trg_leads_updated_at on leads;
create trigger trg_leads_updated_at before update on leads
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------
create table if not exists messages (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid not null references leads(id) on delete cascade,
  text          text not null,
  justification text not null default '',
  model_used    text,
  approved      boolean not null default false,
  approved_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists idx_messages_lead     on messages (lead_id);
create index if not exists idx_messages_approved on messages (approved);

-- ---------------------------------------------------------------------------
-- sends — fila de envio com throttle
-- ---------------------------------------------------------------------------
create table if not exists sends (
  id              uuid primary key default gen_random_uuid(),
  lead_id         uuid not null references leads(id) on delete cascade,
  message_id      uuid not null references messages(id) on delete cascade,
  scheduled_at    timestamptz not null,
  sent_at         timestamptz,
  status          send_status not null default 'agendado',
  uazapi_response jsonb,
  error_message   text,
  responded       boolean not null default false,
  responded_at    timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists idx_sends_status_sched on sends (status, scheduled_at);
create index if not exists idx_sends_lead         on sends (lead_id);
-- 1 envio por mensagem (idempotência RN-05 do F04)
create unique index if not exists uq_sends_message on sends (message_id);

-- ---------------------------------------------------------------------------
-- settings — config operacional (singleton)
-- ---------------------------------------------------------------------------
create table if not exists settings (
  id                    int primary key default 1 check (id = 1),
  send_interval_minutes int  not null default 3,
  daily_send_limit      int  not null default 6,
  default_niches        text[] not null default '{}',
  default_city          text,
  message_signature     text not null default '',
  price_text            text not null default 'R$ 797 à vista ou 10x sem juros',
  updated_at            timestamptz not null default now()
);
insert into settings (id) values (1) on conflict (id) do nothing;

drop trigger if exists trg_settings_updated_at on settings;
create trigger trg_settings_updated_at before update on settings
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Realtime: front assina UPDATE em scrape_jobs (contador ao vivo)
-- ---------------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table scrape_jobs;
exception when duplicate_object then null; end $$;

-- ============================================================================
-- RLS — todas as tabelas. service_role faz bypass natural.
-- anon (frontend): select em tudo; insert em scrape_jobs;
--                  update restrito (colunas) em messages e leads.
-- ============================================================================
alter table scrape_jobs enable row level security;
alter table leads       enable row level security;
alter table messages    enable row level security;
alter table sends       enable row level security;
alter table settings    enable row level security;

-- SELECT para anon em todas
drop policy if exists anon_select_scrape_jobs on scrape_jobs;
create policy anon_select_scrape_jobs on scrape_jobs for select to anon using (true);
drop policy if exists anon_select_leads on leads;
create policy anon_select_leads       on leads       for select to anon using (true);
drop policy if exists anon_select_messages on messages;
create policy anon_select_messages    on messages    for select to anon using (true);
drop policy if exists anon_select_sends on sends;
create policy anon_select_sends       on sends       for select to anon using (true);
drop policy if exists anon_select_settings on settings;
create policy anon_select_settings    on settings    for select to anon using (true);

-- INSERT de job de mapeamento pelo front
drop policy if exists anon_insert_scrape_jobs on scrape_jobs;
create policy anon_insert_scrape_jobs on scrape_jobs for insert to anon with check (true);

-- UPDATE pelo front: aprovar mensagem / mudar status do lead (restrição de coluna via GRANT abaixo)
drop policy if exists anon_update_messages on messages;
create policy anon_update_messages on messages for update to anon using (true) with check (true);
drop policy if exists anon_update_leads on leads;
create policy anon_update_leads    on leads    for update to anon using (true) with check (true);

-- Restrição de COLUNA (RLS controla linha; GRANT controla coluna)
revoke update on messages from anon;
grant  update (approved, approved_at) on messages to anon;
revoke update on leads from anon;
grant  update (status) on leads to anon;

-- Garantir que anon NÃO escreve onde não deve (sem policy de insert/update/delete = negado)
-- (leads insert, sends *, settings update ficam só para service_role)
