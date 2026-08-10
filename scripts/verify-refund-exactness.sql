-- Money-critical check: a reserved attempt is refunded exactly once, and a
-- retry re-reserves exactly once. Balances are read in separate statements so
-- no single-statement snapshot can hide a double credit. Rolled back at the end.

begin;
\set ON_ERROR_STOP on
\pset pager off

create temporary table t_user as select user_id from subscriptions limit 1;
update subscriptions set credits_remaining = 100 where user_id = (select user_id from t_user);

create temporary table t_bal (label text, balance int);
create temporary table t_job (id uuid);

insert into t_bal
select 'start', credits_remaining from subscriptions where user_id = (select user_id from t_user);

-- reserve 10
insert into t_job
select (public.job_create_with_reservation(
  (select user_id from t_user), 'word_search', 'word_search', 'Refund Exactness',
  '{"_cost":10}'::jsonb, 10) ->> 'job_id')::uuid;

insert into t_bal
select 'after_reserve', credits_remaining from subscriptions where user_id = (select user_id from t_user);

-- cancel (refund #1)
select public.job_cancel((select id from t_job), (select user_id from t_user));
insert into t_bal
select 'after_cancel_1', credits_remaining from subscriptions where user_id = (select user_id from t_user);

-- cancel again (must NOT refund again)
select public.job_cancel((select id from t_job), (select user_id from t_user));
insert into t_bal
select 'after_cancel_2', credits_remaining from subscriptions where user_id = (select user_id from t_user);

-- retry (re-reserve once)
select public.job_retry((select id from t_job), (select user_id from t_user));
insert into t_bal
select 'after_retry_1', credits_remaining from subscriptions where user_id = (select user_id from t_user);

-- retry again while queued (must be rejected, no extra debit)
select public.job_retry((select id from t_job), (select user_id from t_user));
insert into t_bal
select 'after_retry_2', credits_remaining from subscriptions where user_id = (select user_id from t_user);

\echo '=== balance timeline (expected 100, 90, 100, 100, 90, 90) ==='
select label, balance from t_bal;

\echo '=== ledger for this job: exactly one reserve per attempt, one refund per settled attempt ==='
select amount, reason from credit_transactions
where ref_id = (select id from t_job) order by created_at, amount;

\echo '=== duplicate idempotency keys (must be 0 rows) ==='
select idempotency_key, count(*)
from credit_transactions
where ref_id = (select id from t_job) and idempotency_key is not null
group by 1 having count(*) > 1;

rollback;
