-- Seasons: archive instead of wipe. Run once.

create table if not exists seasons (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  started_on  date not null default current_date,
  ended_on    date,
  active      boolean not null default false,
  created_at  timestamptz not null default now()
);
alter table seasons enable row level security;
drop policy if exists coaches_seasons on seasons;
create policy coaches_seasons on seasons for all to authenticated using (true) with check (true);
-- public app needs to resolve the active season for homework inserts
drop policy if exists public_seasons_read on seasons;
create policy public_seasons_read on seasons for select to anon using (true);

-- exactly one active season
create unique index if not exists seasons_one_active on seasons(active) where active;

create or replace function active_season() returns uuid
language sql stable security definer as $$
  select id from seasons where active limit 1
$$;

-- first season = everything that exists today
insert into seasons (name, active)
select 'Preseason 2026', true where not exists (select 1 from seasons);

alter table games add column if not exists season_id uuid references seasons(id) on delete cascade default active_season();
alter table smarts_sessions add column if not exists season_id uuid references seasons(id) on delete cascade default active_season();
update games set season_id = active_season() where season_id is null;
update smarts_sessions set season_id = active_season() where season_id is null;

create index if not exists games_season_idx on games(season_id);
create index if not exists smarts_season_idx on smarts_sessions(season_id);
