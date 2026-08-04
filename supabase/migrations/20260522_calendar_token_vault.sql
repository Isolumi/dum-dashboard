-- Store Google Calendar refresh tokens server-side only.
-- RLS is enabled with no browser policies: service-role server functions bypass RLS,
-- while anon/authenticated browser clients cannot read or write these tables directly.

create table if not exists calendar_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  encrypted_refresh_token text not null,
  scope text not null default 'https://www.googleapis.com/auth/calendar.readonly',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table calendar_connections enable row level security;
revoke all on calendar_connections from anon, authenticated;

create table if not exists calendar_oauth_states (
  state_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  redirect_uri text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table calendar_oauth_states enable row level security;
revoke all on calendar_oauth_states from anon, authenticated;

