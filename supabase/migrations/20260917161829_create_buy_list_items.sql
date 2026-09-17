create table public.buy_list_items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (name = btrim(name) and char_length(name) between 1 and 300),
  created_at timestamptz not null default now()
);
create index buy_list_items_created_at_id_desc_idx on public.buy_list_items (created_at desc, id desc);
alter table public.buy_list_items enable row level security;
revoke all on public.buy_list_items from anon, authenticated;
grant select, insert, update, delete on public.buy_list_items to service_role;
