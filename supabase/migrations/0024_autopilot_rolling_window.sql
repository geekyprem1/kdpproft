-- Book Autopilot: switch the once-per-run cap from a calendar month to a rolling
-- 30-day window.
--
-- A calendar bucket (UNIQUE user_id, month_bucket) can't express "within the last
-- N days", so the atomic claim moves into a function guarded by a per-user advisory
-- lock: it serialises concurrent claims, checks the newest run's age, and inserts
-- only when the window has elapsed — race-free without a unique index.

-- The month bucket no longer gates anything.
drop index if exists public.autopilot_runs_user_month_uidx;

create or replace function public.autopilot_claim_run(
  p_user        uuid,
  p_niche       text,
  p_audience    text,
  p_author      text,
  p_words       integer,
  p_trim        text,
  p_angles      jsonb,
  p_window_days integer default 30
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last timestamptz;
  v_id   uuid;
begin
  -- One claim at a time per user, released at transaction end.
  perform pg_advisory_xact_lock(hashtext('autopilot_claim:' || p_user::text));

  select created_at into v_last
    from public.autopilot_runs
   where user_id = p_user
   order by created_at desc
   limit 1;

  if v_last is not null and v_last > now() - make_interval(days => p_window_days) then
    return jsonb_build_object(
      'outcome', 'locked',
      'next_at', v_last + make_interval(days => p_window_days)
    );
  end if;

  insert into public.autopilot_runs
    (user_id, niche, audience, author, words_per_book, trim_size, angles, status, month_bucket)
  values
    (p_user, p_niche, p_audience, p_author, p_words, p_trim,
     coalesce(p_angles, '[]'::jsonb), 'generating',
     to_char(now() at time zone 'utc', 'YYYY-MM'))
  returning id into v_id;

  return jsonb_build_object('outcome', 'ok', 'run_id', v_id);
end;
$$;

-- Callable only by the server (service role). Keep it off PostgREST for end users
-- so nobody can insert runs for another user id or probe the window directly.
revoke all on function public.autopilot_claim_run(uuid, text, text, text, integer, text, jsonb, integer) from public;
revoke all on function public.autopilot_claim_run(uuid, text, text, text, integer, text, jsonb, integer) from anon;
revoke all on function public.autopilot_claim_run(uuid, text, text, text, integer, text, jsonb, integer) from authenticated;
grant execute on function public.autopilot_claim_run(uuid, text, text, text, integer, text, jsonb, integer) to service_role;
