-- Reverts the leaderboard function to plain quiz points (no video bonus),
-- since the drill-video feature has been removed. Run once.

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
      sum(s.score)::int as points
    from s
    group by s.jersey
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
    agg.weeks, agg.plays, agg.best, agg.points
  from agg
  left join players p on p.number = agg.jersey
  order by agg.points desc;
$$;

grant execute on function public_homework_leaderboard() to anon, authenticated;

-- Optional cleanup — only run these if you want the dead tables gone entirely.
-- Safe either way: nothing in the app references them anymore.
-- drop table if exists video_clicks;
-- drop table if exists drill_links;
