-- 0015_atomic_credits_uuid_cast
-- Fix for 0014: credit_transactions.ref_id is uuid but spend_credits/add_credits
-- passed a text expression, so the INSERT failed with
--   "column ref_id is of type uuid but expression is of type text"
-- which 500-ed every reserve/refund. Cast text -> uuid (null-safe) in the insert.

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
  if v_balance is null then
    return null;
  end if;
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
declare v_balance int;
begin
  update subscriptions
     set credits_remaining = greatest(0, credits_remaining + p_delta), updated_at = now()
   where user_id = p_user
  returning credits_remaining into v_balance;
  if v_balance is null then return null; end if;
  insert into credit_transactions (user_id, amount, reason, balance_after, ref_type, ref_id)
  values (p_user, p_delta, p_reason, v_balance, p_ref_type, nullif(p_ref_id, '')::uuid);
  return v_balance;
end;
$$;
