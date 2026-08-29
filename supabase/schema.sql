-- OCSC Sideline — run once in Supabase SQL editor.

create table if not exists players (
  id          uuid primary key default gen_random_uuid(),
  number      text not null,
  name        text not null default '',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists games (
  id               uuid primary key default gen_random_uuid(),
  opponent         text not null default '',
  played_on        date not null default current_date,
  home             boolean not null default true,
  half_length_min  int not null default 25,
  -- clock: elapsed seconds banked while paused, plus a running start timestamp
  elapsed_seconds  int not null default 0,
  clock_started_at timestamptz,
  half             int not null default 1,
  goals_for        int not null default 0,
  goals_against    int not null default 0,
  finished         boolean not null default false,
  notes            text not null default '',
  created_at       timestamptz not null default now()
);

-- One source of truth for everything that happens in a game.
-- type: on | off | move | goal | assist | opp_goal | save | card | half | final
create table if not exists game_events (
  id          bigserial primary key,
  game_id     uuid not null references games(id) on delete cascade,
  player_id   uuid references players(id) on delete set null,
  type        text not null,
  position    text,            -- canonical position label for on/move
  second      int not null,    -- game clock in seconds when it happened
  half        int not null default 1,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists game_events_game_idx on game_events(game_id, second, id);

-- Row level security: any signed-in coach can read/write everything.
alter table players     enable row level security;
alter table games       enable row level security;
alter table game_events enable row level security;

drop policy if exists coaches_players on players;
drop policy if exists coaches_games on games;
drop policy if exists coaches_events on game_events;

create policy coaches_players on players     for all to authenticated using (true) with check (true);
create policy coaches_games   on games       for all to authenticated using (true) with check (true);
create policy coaches_events  on game_events for all to authenticated using (true) with check (true);

-- Realtime so both phones see the same lineup during a game.
alter publication supabase_realtime add table games;
alter publication supabase_realtime add table game_events;
