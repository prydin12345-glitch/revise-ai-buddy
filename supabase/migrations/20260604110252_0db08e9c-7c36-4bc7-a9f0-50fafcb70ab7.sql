
alter table public.ai_tutor_messages
  add column if not exists session_id uuid;

create index if not exists ai_tutor_messages_session_idx
  on public.ai_tutor_messages(session_id, created_at asc);

create table if not exists public.ai_tutor_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  preview text,
  selected_exam_id text,
  selected_set_id text,
  selected_title text,
  message_count integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_tutor_sessions_user_idx
  on public.ai_tutor_sessions(user_id, updated_at desc);

grant select, insert, update, delete on public.ai_tutor_sessions to authenticated;
grant all on public.ai_tutor_sessions to service_role;

alter table public.ai_tutor_sessions enable row level security;

create policy "Users manage own ai tutor sessions"
  on public.ai_tutor_sessions for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
