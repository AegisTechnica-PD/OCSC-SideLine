-- Extra credit for tapping a drill/video link. A click is a best-effort
-- signal (we can't know she actually watched it), so the bonus is modest
-- and capped once per distinct video per player per week. Run once.

create table if not exists video_clicks (
  id          bigserial primary key,
  season_id   uuid references seasons(id) on delete cascade default active_season(),
  jersey      text not null,
  week_epoch  int not null,
  label       text not null,   -- which link, e.g. "Watch: Left Defender basics"
  created_at  timestamptz not null default now(),
  unique (season_id, jersey, week_epoch, label)
);
alter table video_clicks enable row level security;
drop policy if exists video_clicks_public_insert on video_clicks;
drop policy if exists video_clicks_coach_read on video_clicks;
drop policy if exists video_clicks_coach_delete on video_clicks;
create policy video_clicks_public_insert on video_clicks for insert to anon, authenticated with check (true);
create policy video_clicks_coach_read   on video_clicks for select to authenticated using (true);
create policy video_clicks_coach_delete on video_clicks for delete to authenticated using (true);
create index if not exists video_clicks_season_idx on video_clicks(season_id);

-- Leaderboard RPC now folds in the video bonus (100 pts per distinct click,
-- kept in sync with VIDEO_CLICK_BONUS in src/lib/game.js).
create or replace function public_homework_leaderboard()
returns table (jersey text, display_name text, weeks int, plays int, best int, points int)
language sql
security definer
set search_path = public
stable
as $$
  with s as (
    select * from smarts_sessions where season_id = active_season()
  ),
  agg as (
    select
      s.jersey,
      count(distinct s.week_epoch)::int as weeks,
      count(*)::int as plays,
      max(s.score)::int as best,
      sum(s.score)::int as quiz_points
    from s
    group by s.jersey
  ),
  vids as (
    select jersey, count(*)::int as n
    from video_clicks
    where season_id = active_season()
    group by jersey
  )
  select
    agg.jersey,
    coalesce(
      nullif(trim(split_part(p.name, ' ', 1)), '') ||
      case when trim(split_part(p.name, ' ', 2)) <> ''
           then ' ' || left(trim(split_part(p.name, ' ', 2)), 1) || '.'
           else '' end,
      'Player #' || agg.jersey
    ) as display_name,
    agg.weeks, agg.plays, agg.best,
    (agg.quiz_points + coalesce(vids.n, 0) * 100)::int as points
  from agg
  left join players p on p.number = agg.jersey
  left join vids on vids.jersey = agg.jersey
  order by points desc;
$$;

grant execute on function public_homework_leaderboard() to anon, authenticated;
