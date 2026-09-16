begin;
select plan(11);

select has_table('public', 'jobs', 'jobs table exists');
select has_column('public', 'jobs', 'id', 'jobs has id');
select col_is_pk('public', 'jobs', 'id', 'jobs id is the primary key');
select has_index(
  'public', 'jobs', 'jobs_saved_at_id_desc_idx',
  'jobs has newest-first index'
);
select ok(
  (select c.relrowsecurity
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'jobs'),
  'jobs has RLS enabled'
);
select ok(
  not has_table_privilege('anon', 'public.jobs', 'select,insert,update,delete'),
  'anon has no jobs access'
);
select ok(
  not has_table_privilege('authenticated', 'public.jobs', 'select,insert,update,delete'),
  'authenticated has no jobs access'
);
select ok(
  has_table_privilege('service_role', 'public.jobs', 'select,insert,delete'),
  'service role has required jobs access'
);
select ok(
  not has_table_privilege('service_role', 'public.jobs', 'update'),
  'service role cannot update jobs'
);
select lives_ok(
  $$insert into public.jobs (company, title, url)
    values ('Point72', 'Quantitative Developer Intern', 'https://jobs.example/point72')$$,
  'valid job inserts'
);
select throws_ok(
  $$insert into public.jobs (company, title, url)
    values ('Point72', 'Duplicate', 'https://jobs.example/point72')$$,
  '23505',
  null,
  'duplicate exact URL is rejected'
);

select * from finish();
rollback;
