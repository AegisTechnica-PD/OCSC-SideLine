-- Drill links, practice attendance, and season awards. Run once.

-- ---- Drill links: coach-managed, publicly readable (players are unauthenticated) ----
create table if not exists drill_links (
  id          bigserial primary key,
  position    text not null,   -- one of the 9 position labels, or 'All'
  title       text not null,
  url         text not null,
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);
alter table drill_links enable row level security;
drop policy if exists drill_links_public_read on drill_links;
drop policy if exists drill_links_coach_write on drill_links;
create policy drill_links_public_read on drill_links for select to anon, authenticated using (true);
create policy drill_links_coach_write on drill_links for all to authenticated using (true) with check (true);

-- ---- Practices & attendance: coach-only ----
create table if not exists practices (
  id           uuid primary key default gen_random_uuid(),
  season_id    uuid references seasons(id) on delete cascade default active_season(),
  practice_on  date not null default current_date,
  notes        text not null default '',
  created_at   timestamptz not null default now()
);
create table if not exists attendance (
  id           bigserial primary key,
  practice_id  uuid not null references practices(id) on delete cascade,
  player_id    uuid not null references players(id) on delete cascade,
  present      boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (practice_id, player_id)
);
alter table practices  enable row level security;
alter table attendance enable row level security;
drop policy if exists coaches_practices  on practices;
drop policy if exists coaches_attendance on attendance;
create policy coaches_practices  on practices  for all to authenticated using (true) with check (true);
create policy coaches_attendance on attendance for all to authenticated using (true) with check (true);
create index if not exists practices_season_idx on practices(season_id);
create index if not exists attendance_practice_idx on attendance(practice_id);

-- ---- Awards: free-text season awards a coach records alongside the auto stats ----
create table if not exists awards (
  id          bigserial primary key,
  season_id   uuid references seasons(id) on delete cascade default active_season(),
  title       text not null,
  winner      text not null,
  created_at  timestamptz not null default now()
);
alter table awards enable row level security;
drop policy if exists coaches_awards on awards;
create policy coaches_awards on awards for all to authenticated using (true) with check (true);
create index if not exists awards_season_idx on awards(season_id);
