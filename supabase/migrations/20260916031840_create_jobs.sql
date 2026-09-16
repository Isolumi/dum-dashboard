create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  company text not null check (
    company = btrim(company) and char_length(company) between 1 and 200
  ),
  title text not null check (
    title = btrim(title) and char_length(title) between 1 and 300
  ),
  url text not null unique check (
    url = btrim(url)
    and char_length(url) between 1 and 2048
    and url ~* '^https?://'
  ),
  saved_at timestamptz not null default now()
);

create index jobs_saved_at_id_desc_idx
  on public.jobs (saved_at desc, id desc);

alter table public.jobs enable row level security;
revoke all on table public.jobs from anon, authenticated;
grant select, insert, delete on table public.jobs to service_role;
