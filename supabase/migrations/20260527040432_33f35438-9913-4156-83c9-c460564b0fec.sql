
create table if not exists public.ai_tutor_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_tutor_messages_user_created
  on public.ai_tutor_messages(user_id, created_at desc);

create table if not exists public.ai_tutor_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  message_count integer not null default 0,
  primary key (user_id, date)
);

grant select, insert, update, delete on public.ai_tutor_messages to authenticated;
grant all on public.ai_tutor_messages to service_role;
grant select, insert, update, delete on public.ai_tutor_rate_limits to authenticated;
grant all on public.ai_tutor_rate_limits to service_role;

alter table public.ai_tutor_messages enable row level security;
alter table public.ai_tutor_rate_limits enable row level security;

create policy "Users see own messages"
  on public.ai_tutor_messages for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users see own rate limit"
  on public.ai_tutor_rate_limits for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
