-- Lets an unauthenticated player's device check how many times she's already
-- played THIS week's set at THIS position, without exposing raw session
-- rows (which stay coach-only). Used to cap the identical "official" set at
-- 3 plays before switching to a freshly shuffled mix. Run once.

create or replace function smarts_attempt_count(p_jersey text, p_week int, p_position text)
returns int
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::int
  from smarts_sessions
  where season_id = active_season()
    and jersey = p_jersey
    and week_epoch = p_week
    and position = p_position;
$$;

grant execute on function smarts_attempt_count(text, int, text) to anon, authenticated;
