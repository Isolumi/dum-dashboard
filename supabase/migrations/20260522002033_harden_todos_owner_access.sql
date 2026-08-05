-- Restrict direct Data API access to the single dashboard owner.
-- Server functions still use the service role, but every server function now
-- verifies the caller's Supabase access token before using that role.

alter table todos enable row level security;

drop policy if exists "Authenticated users can do everything" on todos;

revoke all on table todos from anon;
revoke insert, update, delete on table todos from authenticated;
grant select on table todos to authenticated;
grant select, insert, update, delete on table todos to service_role;

create policy "Owner can read todos"
  on todos
  for select
  to authenticated
  using ((select auth.uid()) = '38f7f27d-88fd-44ad-8be2-654f89c037ea'::uuid);
