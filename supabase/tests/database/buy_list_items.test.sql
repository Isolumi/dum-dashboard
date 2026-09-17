begin;
select no_plan();

select has_table('public', 'buy_list_items', 'Buy list table exists');
select col_is_pk('public', 'buy_list_items', 'id', 'UUID ID is the primary key');
select col_type_is('public', 'buy_list_items', 'id', 'uuid', 'ID is UUID');
select col_type_is('public', 'buy_list_items', 'created_at', 'timestamp with time zone', 'Creation time has timezone');
select col_not_null('public', 'buy_list_items', 'name', 'Name is required');
select col_not_null('public', 'buy_list_items', 'created_at', 'Creation time is required');
select has_index('public', 'buy_list_items', 'buy_list_items_created_at_id_desc_idx', 'Newest-first index exists');
select ok(
  (select indexdef like '%(created_at DESC, id DESC)%' from pg_indexes
   where schemaname = 'public' and indexname = 'buy_list_items_created_at_id_desc_idx'),
  'Index sorts creation time and ID descending'
);
select ok((select relrowsecurity from pg_class where oid = 'public.buy_list_items'::regclass), 'RLS is enabled');
select ok(not has_table_privilege('anon', 'public.buy_list_items', 'select,insert,update,delete'), 'Anonymous role has no direct access');
select ok(not has_table_privilege('authenticated', 'public.buy_list_items', 'select,insert,update,delete'), 'Authenticated role has no direct access');
select ok(
  has_table_privilege('service_role', 'public.buy_list_items', 'select')
  and has_table_privilege('service_role', 'public.buy_list_items', 'insert')
  and has_table_privilege('service_role', 'public.buy_list_items', 'update')
  and has_table_privilege('service_role', 'public.buy_list_items', 'delete'),
  'Service role has CRUD access'
);
select throws_ok($$insert into public.buy_list_items(name) values ('')$$, '23514', null, 'Empty name fails');
select throws_ok($$insert into public.buy_list_items(name) values ('   ')$$, '23514', null, 'Blank name fails');
select throws_ok($$insert into public.buy_list_items(name) values (' Milk ')$$, '23514', null, 'Untrimmed name fails');
select throws_ok($$insert into public.buy_list_items(name) values (repeat('a',301))$$, '23514', null, 'Overlong name fails');
select throws_ok($$insert into public.buy_list_items(name) values (null)$$, '23502', null, 'Null name fails');
select lives_ok($$insert into public.buy_list_items(name) values ('a'), (repeat('a',300))$$, 'Inclusive length limits succeed');
select ok((select bool_and(id is not null and created_at is not null) from public.buy_list_items), 'ID and creation time default automatically');

set local role anon;
select throws_ok($$select * from public.buy_list_items$$, '42501', null, 'Anonymous SELECT is denied');
select throws_ok($$insert into public.buy_list_items(name) values ('Milk')$$, '42501', null, 'Anonymous INSERT is denied');
reset role;
set local role authenticated;
select throws_ok($$update public.buy_list_items set name = 'Bread'$$, '42501', null, 'Authenticated UPDATE is denied');
select throws_ok($$delete from public.buy_list_items$$, '42501', null, 'Authenticated DELETE is denied');
reset role;

set local role service_role;
select lives_ok(
  $$insert into public.buy_list_items(id,name,created_at)
    values ('11111111-1111-4111-8111-111111111111','Milk','2026-09-17T12:00:00Z')$$,
  'Service role inserts'
);
select is((select name from public.buy_list_items where id = '11111111-1111-4111-8111-111111111111'), 'Milk', 'Service role reads');
select lives_ok($$update public.buy_list_items set name = 'Bread' where id = '11111111-1111-4111-8111-111111111111'$$, 'Service role renames');
select is((select name from public.buy_list_items where id = '11111111-1111-4111-8111-111111111111'), 'Bread', 'Rename is saved');
select is((select created_at from public.buy_list_items where id = '11111111-1111-4111-8111-111111111111'), '2026-09-17T12:00:00Z'::timestamptz, 'Rename preserves creation time');
select lives_ok($$delete from public.buy_list_items where id = '11111111-1111-4111-8111-111111111111'$$, 'Service role deletes');
select is((select count(*) from public.buy_list_items where id = '11111111-1111-4111-8111-111111111111'), 0::bigint, 'Deleted row is absent');
reset role;

select * from finish();
rollback;
