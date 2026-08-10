-- Functional verification of the job/credit integrity RPCs (migration 0019).
-- Runs against a restored copy of production. Everything happens inside one
-- transaction and is rolled back, so no data is modified.
--
--   docker exec kdp-restore-test psql -U postgres -d restorecheck -f /tmp/verify.sql

begin;

\set ON_ERROR_STOP on
\pset pager off

-- Work against a real restored user so FKs behave exactly as in production.
create temporary table t_user as
select user_id from subscriptions limit 1;

update subscriptions set credits_remaining = 100
where user_id = (select user_id from t_user);

\echo '=== 1. create + reserve is atomic (cost 10 of 100) ==='
select
  (public.job_create_with_reservation(
    (select user_id from t_user), 'word_search', 'word_search', 'Verify A',
    '{"theme":"Dinosaurs","_cost":10}'::jsonb, 10
  ) ->> 'outcome') as outcome,
  (select credits_remaining from subscriptions where user_id = (select user_id from t_user)) as balance_now;

create temporary table t_job as
select id from generation_jobs
where user_id = (select user_id from t_user) and title = 'Verify A';

\echo '=== 2. cancel refunds the reserved credits exactly once ==='
select public.job_cancel((select id from t_job), (select user_id from t_user)) ->> 'outcome' as first_cancel,
       (select credits_remaining from subscriptions where user_id = (select user_id from t_user)) as balance_after_cancel;

select public.job_cancel((select id from t_job), (select user_id from t_user)) ->> 'outcome' as second_cancel,
       (select credits_remaining from subscriptions where user_id = (select user_id from t_user)) as balance_unchanged;

\echo '=== 3. retry re-reserves once; a second retry is rejected while queued ==='
select public.job_retry((select id from t_job), (select user_id from t_user)) ->> 'outcome' as retry_1,
       (select credits_remaining from subscriptions where user_id = (select user_id from t_user)) as balance_after_retry;

select public.job_retry((select id from t_job), (select user_id from t_user)) ->> 'outcome' as retry_2_rejected,
       (select credits_remaining from subscriptions where user_id = (select user_id from t_user)) as balance_still;

\echo '=== 4. claim fences the attempt; a stale token cannot complete it ==='
create temporary table t_claim as
select public.job_claim((select id from t_job), 600) as claim;

select (select claim ->> 'attempt_no' from t_claim) as attempt_no,
       (select claim ->> 'credit_cost' from t_claim) as credit_cost;

select public.job_complete(
  (select id from t_job),
  '00000000-0000-4000-8000-000000000000'::uuid,   -- wrong/stale token
  null
) as stale_complete_must_be_false;

\echo '=== 5. cancelling a processing attempt refunds, and completion cannot override it ==='
select public.job_cancel((select id from t_job), (select user_id from t_user)) ->> 'outcome' as cancel_processing,
       (select credits_remaining from subscriptions where user_id = (select user_id from t_user)) as balance_after;

select public.job_complete(
  (select id from t_job),
  (select (claim ->> 'attempt_token')::uuid from t_claim),
  null
) as complete_after_cancel_must_be_false;

select status, credit_state from generation_jobs where id = (select id from t_job);

\echo '=== 6. insufficient credits is rejected without creating a job ==='
select public.job_create_with_reservation(
  (select user_id from t_user), 'word_search', 'word_search', 'Verify B',
  '{"_cost":999999}'::jsonb, 999999
) ->> 'outcome' as must_be_insufficient_credits;

select count(*) as verify_b_jobs from generation_jobs
where user_id = (select user_id from t_user) and title = 'Verify B';

\echo '=== 7. add_credits ledger records the applied delta when clamped at zero ==='
update subscriptions set credits_remaining = 3 where user_id = (select user_id from t_user);
select public.add_credits((select user_id from t_user), -10, 'verify_clamp') as balance_after;
select amount as ledger_amount_must_be_minus_3
from credit_transactions
where user_id = (select user_id from t_user) and reason = 'verify_clamp';

\echo '=== 8. an unsettled/active job cannot be hard-deleted directly ==='
select public.job_create_with_reservation(
  (select user_id from t_user), 'sudoku', 'sudoku', 'Verify C',
  '{"_cost":0}'::jsonb, 0
) ->> 'outcome' as created;

do $$
begin
  delete from generation_jobs
  where user_id = (select user_id from t_user) and title = 'Verify C';
  raise exception 'FAIL: direct delete of an active job was allowed';
exception
  when sqlstate 'P0001' then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise notice 'OK: direct delete blocked (%)', sqlerrm;
end $$;

rollback;
