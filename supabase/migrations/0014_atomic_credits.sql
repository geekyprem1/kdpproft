-- 0014_atomic_credits
-- Atomic credit spend/add to prevent read-then-write double-spend under concurrency.
-- Applied to the KDP project via MCP; this file keeps the repo in sync.

-- Conditional decrement: only succeeds if the balance covers the cost.
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
    return null; -- insufficient balance or no subscription row
  end if;
  insert into credit_transactions (user_id, amount, reason, balance_after, ref_type, ref_id)
  values (p_user, -p_amount, p_reason, v_balance, p_ref_type, p_ref_id);
  return v_balance;
end;
$$;

-- Unconditional add (refund/grant/admin). Floors at 0 for negative deltas.
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
  values (p_user, p_delta, p_reason, v_balance, p_ref_type, p_ref_id);
  return v_balance;
end;
$$;

-- Lock down: only the service role (admin client) may call these.
revoke all on function public.spend_credits(uuid,int,text,text,text) from public, anon, authenticated;
revoke all on function public.add_credits(uuid,int,text,text,text) from public, anon, authenticated;
grant execute on function public.spend_credits(uuid,int,text,text,text) to service_role;
grant execute on function public.add_credits(uuid,int,text,text,text) to service_role;
