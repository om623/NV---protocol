/*
  # Global Radar schema

  Prepared structure for storing the Radar's directory and its sourced data in a
  database (Supabase / Bolt Database). The app does NOT depend on it yet: today it runs
  from a versioned seed plus live public sources, and keeps favorites / history on the
  user's device. Nothing here is applied automatically.

  1. Reference tables (public read, written only by the service role)
     - radar_countries, radar_sectors, radar_data_sources, radar_companies
  2. Sourced data (public read, written only by the service role)
     - radar_indicators   one value + its source, date and status (available / stale /
                          unavailable / not_disclosed). Never overwritten: history is kept.
     - radar_news         headlines with source and publication date
     - radar_company_history  dated corporate events with a source
     - radar_updates      refresh log per source (what ran, when, how many rows, errors)
  3. User tables (RLS on, owner-only)
     - radar_user_favorites, radar_user_queries
     They need authenticated users (auth.uid()). NV has no database auth wired yet, so
     until that exists these tables stay unreachable from the client by design.

  Security
     - RLS is enabled on every table.
     - Reference / sourced tables: SELECT for anon + authenticated, no write policies.
     - User tables: each policy restricts rows to auth.uid() = user_id.
*/

create table if not exists radar_countries (
  code2        text primary key check (char_length(code2) = 2),
  iso_numeric  integer,
  name_en      text not null,
  continent    text not null check (continent in ('NA','SA','EU','AS','AF','OC','ME','AN'))
);

create table if not exists radar_sectors (
  id         text primary key,
  sort_order integer not null default 0
);

create table if not exists radar_data_sources (
  id         text primary key,
  name       text not null,
  url        text not null,
  status     text not null check (status in ('live','needs-config','planned')),
  requires   text,
  license    text
);

create table if not exists radar_companies (
  id            text primary key,
  name          text not null,
  country_code  text not null references radar_countries(code2),
  city          text not null,
  lat           double precision not null check (lat between -90 and 90),
  lon           double precision not null check (lon between -180 and 180),
  sector_id     text not null references radar_sectors(id),
  size_class    text not null check (size_class in ('mega','large','growth')),
  listed        boolean not null default false,
  ticker        text,
  exchange      text,
  yahoo_symbol  text,
  sec_ticker    text,
  wikidata_qid  text check (wikidata_qid is null or wikidata_qid ~ '^Q[0-9]+$'),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists radar_companies_country_idx on radar_companies (country_code);
create index if not exists radar_companies_sector_idx  on radar_companies (sector_id);

create table if not exists radar_indicators (
  id            bigserial primary key,
  subject_type  text not null check (subject_type in ('company','country')),
  subject_id    text not null,
  metric        text not null,
  value         numeric,
  currency      text,
  unit          text,
  as_of         date,
  status        text not null check (status in ('available','stale','unavailable','not_disclosed')),
  source_id     text not null references radar_data_sources(id),
  source_url    text,
  retrieved_at  timestamptz not null default now(),
  unique (subject_type, subject_id, metric, as_of, source_id)
);
create index if not exists radar_indicators_subject_idx on radar_indicators (subject_type, subject_id, metric, as_of desc);

create table if not exists radar_news (
  id            bigserial primary key,
  subject_type  text not null check (subject_type in ('company','country','sector')),
  subject_id    text not null,
  title         text not null,
  url           text not null unique,
  domain        text,
  language      text,
  published_at  timestamptz,
  source_id     text not null references radar_data_sources(id),
  retrieved_at  timestamptz not null default now()
);
create index if not exists radar_news_subject_idx on radar_news (subject_type, subject_id, published_at desc);

create table if not exists radar_company_history (
  id           bigserial primary key,
  company_id   text not null references radar_companies(id) on delete cascade,
  kind         text not null check (kind in ('founded','rename','acquisition','merger','expansion','investment','regulatory','other')),
  occurred_on  date,
  description  text not null,
  source_id    text not null references radar_data_sources(id),
  source_url   text
);
create index if not exists radar_company_history_idx on radar_company_history (company_id, occurred_on desc);

create table if not exists radar_updates (
  id           bigserial primary key,
  source_id    text not null references radar_data_sources(id),
  scope        text not null,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  status       text not null check (status in ('running','ok','partial','failed')),
  rows_written integer not null default 0,
  error        text
);

create table if not exists radar_user_favorites (
  user_id     uuid not null,
  company_id  text not null references radar_companies(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, company_id)
);

create table if not exists radar_user_queries (
  id          bigserial primary key,
  user_id     uuid not null,
  kind        text not null check (kind in ('search','company','country')),
  value       text not null,
  created_at  timestamptz not null default now()
);
create index if not exists radar_user_queries_idx on radar_user_queries (user_id, created_at desc);

-- Row level security -----------------------------------------------------------------

alter table radar_countries       enable row level security;
alter table radar_sectors         enable row level security;
alter table radar_data_sources    enable row level security;
alter table radar_companies       enable row level security;
alter table radar_indicators      enable row level security;
alter table radar_news            enable row level security;
alter table radar_company_history enable row level security;
alter table radar_updates         enable row level security;
alter table radar_user_favorites  enable row level security;
alter table radar_user_queries    enable row level security;

do $$
declare t text;
begin
  foreach t in array array['radar_countries','radar_sectors','radar_data_sources','radar_companies',
                           'radar_indicators','radar_news','radar_company_history','radar_updates']
  loop
    execute format('create policy %I on %I for select to anon, authenticated using (true)', t || '_public_read', t);
  end loop;
end $$;

create policy radar_user_favorites_select on radar_user_favorites for select to authenticated using (auth.uid() = user_id);
create policy radar_user_favorites_insert on radar_user_favorites for insert to authenticated with check (auth.uid() = user_id);
create policy radar_user_favorites_delete on radar_user_favorites for delete to authenticated using (auth.uid() = user_id);

create policy radar_user_queries_select on radar_user_queries for select to authenticated using (auth.uid() = user_id);
create policy radar_user_queries_insert on radar_user_queries for insert to authenticated with check (auth.uid() = user_id);
create policy radar_user_queries_delete on radar_user_queries for delete to authenticated using (auth.uid() = user_id);
