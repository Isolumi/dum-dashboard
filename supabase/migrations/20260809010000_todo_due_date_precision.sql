begin;

alter table public.todos
  add column if not exists due_date_has_time boolean not null default false;

notify pgrst, 'reload schema';

commit;
