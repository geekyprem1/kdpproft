-- Security: the trigger runs handle_new_user() as the table owner regardless of
-- role EXECUTE grants, so revoke direct RPC access from clients.
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;
