begin;

-- RLS does not protect TRUNCATE, and older Supabase defaults granted more than
-- ordinary DML privileges to browser roles. Reset them before restoring the
-- owner's read-only access.
revoke all privileges on table public.todos from anon, authenticated;
grant select on table public.todos to authenticated;

commit;
