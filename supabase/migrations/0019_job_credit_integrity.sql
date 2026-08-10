-- Atomic job-attempt and credit lifecycle integrity.
-- Deploy this migration before deploying the application code that calls these RPCs.

alter table public.generation_jobs
  add column if not exists credit_cost integer not null default 0,
  add column if not exists credit_state text not null default 'reserved',
  add column if not exists attempt_no integer not null default 1,
  add column if not exists attempt_token uuid not null default gen_random_uuid(),
  add column if not exists lease_expires_at timestamptz;

alter table public.credit_transactions
  add column if not exists idempotency_key text;
create unique index if not exists credit_transactions_idempotency_idx
  on public.credit_transactions (idempotency_key)
  where idempotency_key is not null;

update public.generation_jobs
set credit_cost = case
  when input ->> '_cost' ~ '^[0-9]+$'
    then least(2147483647::numeric, (input ->> '_cost')::numeric)::integer
  else 0
end;

update public.generation_jobs
set credit_state = case
  when status = 'completed' then 'consumed'
  when credits_refunded then 'refunded'
  when status in ('failed', 'cancelled') and credit_cost = 0 then 'refunded'
  else 'reserved'
end;

alter table public.generation_jobs drop constraint if exists generation_jobs_credit_cost_check;
alter table public.generation_jobs add constraint generation_jobs_credit_cost_check check (credit_cost >= 0);
alter table public.generation_jobs drop constraint if exists generation_jobs_credit_state_check;
alter table public.generation_jobs add constraint generation_jobs_credit_state_check check (credit_state in ('reserved', 'consumed', 'refunded'));
alter table public.generation_jobs drop constraint if exists generation_jobs_attempt_no_check;
alter table public.generation_jobs add constraint generation_jobs_attempt_no_check check (attempt_no > 0);
alter table public.generation_jobs drop constraint if exists generation_jobs_progress_check;
alter table public.generation_jobs add constraint generation_jobs_progress_check check (progress between 0 and 100);
-- Preserve the public signatures while correcting a clamped negative adjustment's
-- ledger amount to the balance delta that was actually applied.
create or replace function public.spend_credits(
  p_user uuid, p_amount int, p_reason text default 'reserve',
  p_ref_type text default null, p_ref_id text default null
) returns int
language plpgsql security definer set search_path = public as $$
declare v_balance int;
begin
  if p_amount <= 0 then
    select credits_remaining into v_balance from subscriptions where user_id = p_user;
    return v_balance;
  end if;
  update subscriptions
     set credits_remaining = credits_remaining - p_amount, updated_at = now()
   where user_id = p_user and credits_remaining >= p_amount
  returning credits_remaining into v_balance;
  if v_balance is null then return null; end if;
  insert into credit_transactions (user_id, amount, reason, balance_after, ref_type, ref_id)
  values (p_user, -p_amount, p_reason, v_balance, p_ref_type, nullif(p_ref_id, '')::uuid);
  return v_balance;
end;
$$;

create or replace function public.add_credits(
  p_user uuid, p_delta int, p_reason text default 'grant',
  p_ref_type text default null, p_ref_id text default null
) returns int
language plpgsql security definer set search_path = public as $$
declare v_old int; v_balance int; v_applied int;
begin
  select credits_remaining into v_old from subscriptions where user_id = p_user for update;
  if v_old is null then return null; end if;
  v_balance := greatest(0::bigint, least(2147483647::bigint, v_old::bigint + p_delta::bigint))::integer;
  v_applied := v_balance - v_old;
  update subscriptions set credits_remaining = v_balance, updated_at = now() where user_id = p_user;
  insert into credit_transactions (user_id, amount, reason, balance_after, ref_type, ref_id)
  values (p_user, v_applied, p_reason, v_balance, p_ref_type, nullif(p_ref_id, '')::uuid);
  return v_balance;
end;
$$;

revoke all on function public.spend_credits(uuid,int,text,text,text) from public, anon, authenticated;
revoke all on function public.add_credits(uuid,int,text,text,text) from public, anon, authenticated;
grant execute on function public.spend_credits(uuid,int,text,text,text) to service_role;
grant execute on function public.add_credits(uuid,int,text,text,text) to service_role;
create or replace function public.job_create_with_reservation(
  p_user uuid, p_job_type text, p_book_type text, p_title text,
  p_input jsonb, p_credit_cost int
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_job uuid := gen_random_uuid(); v_balance int; v_cost int := greatest(0, p_credit_cost);
begin
  select credits_remaining into v_balance from subscriptions where user_id = p_user for update;
  if v_balance is null then raise exception 'subscription not found for user %', p_user; end if;
  if v_balance < v_cost then
    return jsonb_build_object('outcome', 'insufficient_credits', 'balance', v_balance);
  end if;

  insert into generation_jobs (
    id, user_id, job_type, book_type, title, input, status, progress,
    credit_cost, credit_state, attempt_no, attempt_token, credits_refunded
  ) values (
    v_job, p_user, p_job_type, p_book_type, p_title, coalesce(p_input, '{}'::jsonb),
    'queued', 0, v_cost, 'reserved', 1, gen_random_uuid(), false
  );

  if v_cost > 0 then
    v_balance := v_balance - v_cost;
    update subscriptions set credits_remaining = v_balance, updated_at = now() where user_id = p_user;
    insert into credit_transactions
      (user_id, amount, reason, balance_after, ref_type, ref_id, idempotency_key)
    values
      (p_user, -v_cost, 'reserve', v_balance, 'job', v_job,
       format('job:%s:attempt:1:reserve', v_job));
  end if;
  insert into billing_audit_log (user_id, action, detail)
  values (p_user, 'reserve', jsonb_build_object('cost', v_cost, 'refType', 'job', 'refId', v_job, 'attempt', 1));
  return jsonb_build_object('outcome', 'ok', 'job_id', v_job, 'balance', v_balance);
end;
$$;

create or replace function public.job_retry(p_job uuid, p_user uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_job generation_jobs%rowtype; v_balance int; v_next int;
begin
  select * into v_job from generation_jobs where id = p_job for update;
  if not found or (p_user is not null and v_job.user_id <> p_user) then
    return jsonb_build_object('outcome', 'not_found');
  end if;
  if v_job.status not in ('failed', 'cancelled') then
    return jsonb_build_object('outcome', 'invalid_state');
  end if;
  select credits_remaining into v_balance from subscriptions where user_id = v_job.user_id for update;
  if v_balance is null then raise exception 'subscription not found for user %', v_job.user_id; end if;

  -- Settle any legacy/incomplete attempt before reserving the next one.
  if v_job.credit_state = 'reserved' then
    v_balance := v_balance + v_job.credit_cost;
    update subscriptions set credits_remaining = v_balance, updated_at = now() where user_id = v_job.user_id;
    insert into credit_transactions
      (user_id, amount, reason, balance_after, ref_type, ref_id, idempotency_key)
    values
      (v_job.user_id, v_job.credit_cost, 'refund', v_balance, 'job', v_job.id,
       format('job:%s:attempt:%s:refund', v_job.id, v_job.attempt_no))
    on conflict (idempotency_key) where idempotency_key is not null do nothing;
    update generation_jobs set credit_state = 'refunded', credits_refunded = true where id = v_job.id;
    insert into billing_audit_log (user_id, action, detail)
    values (v_job.user_id, 'refund', jsonb_build_object('cost', v_job.credit_cost, 'refId', v_job.id, 'attempt', v_job.attempt_no, 'cause', 'retry_settlement'));
  end if;

  if v_balance < v_job.credit_cost then
    return jsonb_build_object('outcome', 'insufficient_credits', 'balance', v_balance);
  end if;
  v_next := v_job.attempt_no + 1;
  if v_job.credit_cost > 0 then
    v_balance := v_balance - v_job.credit_cost;
    update subscriptions set credits_remaining = v_balance, updated_at = now() where user_id = v_job.user_id;
    insert into credit_transactions
      (user_id, amount, reason, balance_after, ref_type, ref_id, idempotency_key)
    values
      (v_job.user_id, -v_job.credit_cost, 'reserve', v_balance, 'job', v_job.id,
       format('job:%s:attempt:%s:reserve', v_job.id, v_next));
  end if;
  update generation_jobs set
    status = 'queued', progress = 0, current_step = null, error_message = null,
    book_id = null, completed_at = null, started_at = null, updated_at = now(),
    credit_state = 'reserved', credits_refunded = false,
    attempt_no = v_next, attempt_token = gen_random_uuid(), lease_expires_at = null
  where id = v_job.id;
  insert into billing_audit_log (user_id, action, detail)
  values (v_job.user_id, 'reserve', jsonb_build_object('cost', v_job.credit_cost, 'refType', 'job', 'refId', v_job.id, 'attempt', v_next));
  return jsonb_build_object('outcome', 'ok', 'balance', v_balance);
end;
$$;

create or replace function public.job_claim(p_job uuid, p_lease_seconds int default 600)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_job generation_jobs%rowtype;
begin
  select * into v_job from generation_jobs where id = p_job for update;
  if not found or v_job.status <> 'queued' then return null; end if;
  if v_job.credit_state <> 'reserved' then
    raise exception 'queued job % has invalid credit state %', p_job, v_job.credit_state;
  end if;
  update generation_jobs set
    status = 'processing', progress = 5, current_step = 'Starting',
    started_at = now(), error_message = null, updated_at = now(),
    lease_expires_at = now() + make_interval(secs => greatest(30, p_lease_seconds))
  where id = p_job
  returning * into v_job;
  return jsonb_build_object(
    'id', v_job.id, 'user_id', v_job.user_id, 'job_type', v_job.job_type,
    'input', v_job.input, 'attempt_token', v_job.attempt_token,
    'attempt_no', v_job.attempt_no, 'credit_cost', v_job.credit_cost
  );
end;
$$;

create or replace function public.job_progress(
  p_job uuid, p_token uuid, p_step text, p_progress int, p_lease_seconds int default 600
) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_updated uuid;
begin
  update generation_jobs set
    current_step = left(p_step, 200), progress = greatest(0, least(99, p_progress)),
    updated_at = now(), lease_expires_at = now() + make_interval(secs => greatest(30, p_lease_seconds))
  where id = p_job and status = 'processing' and attempt_token = p_token
    and lease_expires_at > now()
  returning id into v_updated;
  return v_updated is not null;
end;
$$;
create or replace function public.job_complete(
  p_job uuid, p_token uuid, p_book uuid, p_meta jsonb default '{}'::jsonb
) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_job generation_jobs%rowtype;
begin
  select * into v_job from generation_jobs where id = p_job for update;
  if not found or v_job.status <> 'processing' or v_job.attempt_token <> p_token
     or v_job.lease_expires_at is null or v_job.lease_expires_at <= now() then
    return false;
  end if;
  update generation_jobs set
    status = 'completed', progress = 100, current_step = 'Complete', book_id = p_book,
    completed_at = now(), updated_at = now(), lease_expires_at = null,
    credit_state = 'consumed', credits_refunded = false
  where id = p_job;
  insert into usage_events (user_id, action, credits, status, ref_id, meta)
  values (v_job.user_id, v_job.job_type, v_job.credit_cost, 'completed', p_book, coalesce(p_meta, '{}'::jsonb));
  return true;
end;
$$;

create or replace function public.job_fail(
  p_job uuid, p_token uuid, p_message text, p_meta jsonb default '{}'::jsonb
) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_job generation_jobs%rowtype; v_balance int;
begin
  select * into v_job from generation_jobs where id = p_job for update;
  if not found or v_job.status <> 'processing' or v_job.attempt_token <> p_token then return false; end if;
  select credits_remaining into v_balance from subscriptions where user_id = v_job.user_id for update;
  if v_balance is null then raise exception 'subscription not found for user %', v_job.user_id; end if;
  if v_job.credit_state = 'reserved' and v_job.credit_cost > 0 then
    v_balance := v_balance + v_job.credit_cost;
    update subscriptions set credits_remaining = v_balance, updated_at = now() where user_id = v_job.user_id;
    insert into credit_transactions
      (user_id, amount, reason, balance_after, ref_type, ref_id, idempotency_key)
    values
      (v_job.user_id, v_job.credit_cost, 'refund', v_balance, 'job', v_job.id,
       format('job:%s:attempt:%s:refund', v_job.id, v_job.attempt_no))
    on conflict (idempotency_key) where idempotency_key is not null do nothing;
  end if;
  update generation_jobs set
    status = 'failed', current_step = 'Failed', error_message = left(p_message, 500),
    updated_at = now(), lease_expires_at = null, attempt_token = gen_random_uuid(),
    credit_state = 'refunded', credits_refunded = true
  where id = p_job;
  insert into billing_audit_log (user_id, action, detail)
  values (v_job.user_id, 'refund', jsonb_build_object('cost', v_job.credit_cost, 'refId', v_job.id, 'attempt', v_job.attempt_no));
  insert into usage_events (user_id, action, credits, status, ref_id, meta)
  values (v_job.user_id, v_job.job_type, v_job.credit_cost, 'failed', v_job.id, coalesce(p_meta, '{}'::jsonb));
  return true;
end;
$$;
create or replace function public.job_cancel(p_job uuid, p_user uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_job generation_jobs%rowtype; v_balance int;
begin
  select * into v_job from generation_jobs where id = p_job for update;
  if not found or v_job.user_id <> p_user then return jsonb_build_object('outcome', 'not_found'); end if;
  if v_job.status = 'cancelled' then return jsonb_build_object('outcome', 'ok'); end if;
  if v_job.status not in ('queued', 'processing') then return jsonb_build_object('outcome', 'invalid_state'); end if;
  select credits_remaining into v_balance from subscriptions where user_id = v_job.user_id for update;
  if v_balance is null then raise exception 'subscription not found for user %', v_job.user_id; end if;
  if v_job.credit_state = 'reserved' and v_job.credit_cost > 0 then
    v_balance := v_balance + v_job.credit_cost;
    update subscriptions set credits_remaining = v_balance, updated_at = now() where user_id = v_job.user_id;
    insert into credit_transactions
      (user_id, amount, reason, balance_after, ref_type, ref_id, idempotency_key)
    values
      (v_job.user_id, v_job.credit_cost, 'refund', v_balance, 'job', v_job.id,
       format('job:%s:attempt:%s:refund', v_job.id, v_job.attempt_no))
    on conflict (idempotency_key) where idempotency_key is not null do nothing;
  end if;
  update generation_jobs set
    status = 'cancelled', current_step = 'Cancelled', error_message = null,
    updated_at = now(), completed_at = now(), lease_expires_at = null,
    attempt_token = gen_random_uuid(), credit_state = 'refunded', credits_refunded = true
  where id = p_job;
  insert into billing_audit_log (user_id, action, detail)
  values (v_job.user_id, 'refund', jsonb_build_object('cost', v_job.credit_cost, 'refId', v_job.id, 'attempt', v_job.attempt_no, 'cause', 'cancel'));
  insert into usage_events (user_id, action, credits, status, ref_id, meta)
  values (v_job.user_id, v_job.job_type, v_job.credit_cost, 'refunded', v_job.id, jsonb_build_object('cause', 'cancel'));
  return jsonb_build_object('outcome', 'ok');
end;
$$;

create or replace function public.job_reclaim_stale(p_stale_seconds int default 600)
returns uuid[]
language plpgsql security definer set search_path = public as $$
declare v_job generation_jobs%rowtype; v_balance int; v_ids uuid[] := '{}'::uuid[];
begin
  for v_job in
    select * from generation_jobs
    where status = 'processing' and lease_expires_at < now()
      and updated_at < now() - make_interval(secs => greatest(30, p_stale_seconds))
    order by updated_at for update skip locked
  loop
    select credits_remaining into v_balance from subscriptions where user_id = v_job.user_id for update;
    if v_balance is null then raise exception 'subscription not found for user %', v_job.user_id; end if;
    if v_job.credit_state = 'reserved' and v_job.credit_cost > 0 then
      v_balance := v_balance + v_job.credit_cost;
      update subscriptions set credits_remaining = v_balance, updated_at = now() where user_id = v_job.user_id;
      insert into credit_transactions
        (user_id, amount, reason, balance_after, ref_type, ref_id, idempotency_key)
      values
        (v_job.user_id, v_job.credit_cost, 'refund', v_balance, 'job', v_job.id,
         format('job:%s:attempt:%s:refund', v_job.id, v_job.attempt_no))
      on conflict (idempotency_key) where idempotency_key is not null do nothing;
    end if;
    update generation_jobs set
      status = 'failed', current_step = 'Failed', error_message = 'Worker lease expired',
      updated_at = now(), lease_expires_at = null, attempt_token = gen_random_uuid(),
      credit_state = 'refunded', credits_refunded = true
    where id = v_job.id;
    insert into billing_audit_log (user_id, action, detail)
    values (v_job.user_id, 'refund', jsonb_build_object('cost', v_job.credit_cost, 'refId', v_job.id, 'attempt', v_job.attempt_no, 'cause', 'stale'));
    insert into usage_events (user_id, action, credits, status, ref_id, meta)
    values (v_job.user_id, v_job.job_type, v_job.credit_cost, 'failed', v_job.id, jsonb_build_object('cause', 'stale'));
    v_ids := array_append(v_ids, v_job.id);
  end loop;
  return v_ids;
end;
$$;

create or replace function public.job_delete(p_job uuid, p_user uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_job generation_jobs%rowtype; v_balance int;
begin
  select * into v_job from generation_jobs where id = p_job for update;
  if not found or v_job.user_id <> p_user then return jsonb_build_object('outcome', 'not_found'); end if;
  if v_job.status in ('queued', 'processing') then return jsonb_build_object('outcome', 'invalid_state'); end if;
  if v_job.credit_state = 'reserved' then
    select credits_remaining into v_balance from subscriptions where user_id = v_job.user_id for update;
    if v_balance is null then raise exception 'subscription not found for user %', v_job.user_id; end if;
    if v_job.credit_cost > 0 then
      v_balance := v_balance + v_job.credit_cost;
      update subscriptions set credits_remaining = v_balance, updated_at = now() where user_id = v_job.user_id;
      insert into credit_transactions
        (user_id, amount, reason, balance_after, ref_type, ref_id, idempotency_key)
      values
        (v_job.user_id, v_job.credit_cost, 'refund', v_balance, 'job', v_job.id,
         format('job:%s:attempt:%s:refund', v_job.id, v_job.attempt_no))
      on conflict (idempotency_key) where idempotency_key is not null do nothing;
    end if;
    insert into billing_audit_log (user_id, action, detail)
    values (v_job.user_id, 'refund', jsonb_build_object('cost', v_job.credit_cost, 'refId', v_job.id, 'attempt', v_job.attempt_no, 'cause', 'delete'));
  end if;
  update generation_jobs set credit_state = 'refunded', credits_refunded = true where id = p_job and credit_state = 'reserved';
  delete from generation_jobs where id = p_job;
  return jsonb_build_object('outcome', 'ok');
end;
$$;

revoke all on function public.job_create_with_reservation(uuid,text,text,text,jsonb,int) from public, anon, authenticated;
revoke all on function public.job_retry(uuid,uuid) from public, anon, authenticated;
revoke all on function public.job_claim(uuid,int) from public, anon, authenticated;
revoke all on function public.job_progress(uuid,uuid,text,int,int) from public, anon, authenticated;
revoke all on function public.job_complete(uuid,uuid,uuid,jsonb) from public, anon, authenticated;
revoke all on function public.job_fail(uuid,uuid,text,jsonb) from public, anon, authenticated;
revoke all on function public.job_cancel(uuid,uuid) from public, anon, authenticated;
revoke all on function public.job_reclaim_stale(int) from public, anon, authenticated;
revoke all on function public.job_delete(uuid,uuid) from public, anon, authenticated;
grant execute on function public.job_create_with_reservation(uuid,text,text,text,jsonb,int) to service_role;
grant execute on function public.job_retry(uuid,uuid) to service_role;
grant execute on function public.job_claim(uuid,int) to service_role;
grant execute on function public.job_progress(uuid,uuid,text,int,int) to service_role;
grant execute on function public.job_complete(uuid,uuid,uuid,jsonb) to service_role;
grant execute on function public.job_fail(uuid,uuid,text,jsonb) to service_role;
grant execute on function public.job_cancel(uuid,uuid) to service_role;
grant execute on function public.job_reclaim_stale(int) to service_role;
grant execute on function public.job_delete(uuid,uuid) to service_role;

-- Guard legacy/admin direct deletes: active or unsettled jobs must use the atomic RPC.
create or replace function public.protect_unsettled_job_delete()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status in ('queued', 'processing') or old.credit_state = 'reserved' then
    raise exception 'active or unsettled job % cannot be deleted directly', old.id;
  end if;
  return old;
end;
$$;
revoke all on function public.protect_unsettled_job_delete() from public, anon, authenticated;
drop trigger if exists protect_unsettled_job_delete on public.generation_jobs;
create trigger protect_unsettled_job_delete
before delete on public.generation_jobs
for each row execute function public.protect_unsettled_job_delete();
