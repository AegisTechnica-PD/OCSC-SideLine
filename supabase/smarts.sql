-- Soccer Smarts homework tracking. Run once in the Supabase SQL editor.

create table if not exists smarts_sessions (
  id           bigserial primary key,
  jersey       text not null,
  player_name  text not null default '',
  position     text not null,
  week_epoch   int not null,
  week_label   text not null,
  score        int not null,
  best_streak  int not null default 0,
  principles   jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists smarts_sessions_week_idx on smarts_sessions(week_epoch, jersey);

alter table smarts_sessions enable row level security;

drop policy if exists smarts_public_insert on smarts_sessions;
drop policy if exists smarts_coach_read on smarts_sessions;
drop policy if exists smarts_coach_delete on smarts_sessions;

-- Players are not signed in: they may write a result but never read anyone's.
create policy smarts_public_insert on smarts_sessions for insert to anon, authenticated with check (true);
create policy smarts_coach_read    on smarts_sessions for select to authenticated using (true);
create policy smarts_coach_delete  on smarts_sessions for delete to authenticated using (true);
