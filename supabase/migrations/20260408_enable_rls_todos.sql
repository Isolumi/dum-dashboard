-- Enable RLS on todos table to stop security warning emails.
-- Server functions use the service role key (supabaseAdmin) which bypasses RLS,
-- so this policy only applies to browser client queries (none currently).
alter table todos enable row level security;

-- Allow any authenticated user to perform all operations.
-- This is a personal app — only one person will ever authenticate.
create policy "Authenticated users can do everything"
  on todos
  for all
  to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
