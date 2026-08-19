create table if not exists public.jobs (
  id text primary key,
  number text not null,
  title text not null,
  client text not null default '',
  description text not null default '',
  status text not null check (status in ('active', 'planned', 'completed')),
  deadline date,
  estimated_minutes integer not null default 0 check (estimated_minutes >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id text primary key,
  job_id text not null references public.jobs(id) on delete cascade,
  title text not null,
  estimated_minutes integer not null default 0 check (estimated_minutes >= 0),
  status text not null check (status in ('todo', 'in-progress', 'done')),
  created_at timestamptz not null default now()
);

create table if not exists public.time_sessions (
  id text primary key,
  task_id text not null references public.tasks(id) on delete cascade,
  started_at timestamptz not null,
  stopped_at timestamptz not null,
  duration_seconds integer not null check (duration_seconds >= 0)
);

create table if not exists public.active_timer (
  id text primary key default 'current' check (id = 'current'),
  task_id text not null references public.tasks(id) on delete cascade,
  started_at timestamptz not null
);

alter table public.jobs enable row level security;
alter table public.tasks enable row level security;
alter table public.time_sessions enable row level security;
alter table public.active_timer enable row level security;

-- MVP single-workshop mode: the browser client can read/write shared workshop data.
-- For production/customer data, replace these policies with authenticated workspace ownership.
drop policy if exists "machina anon all jobs" on public.jobs;
create policy "machina anon all jobs" on public.jobs
  for all to anon
  using (true)
  with check (true);

drop policy if exists "machina anon all tasks" on public.tasks;
create policy "machina anon all tasks" on public.tasks
  for all to anon
  using (true)
  with check (true);

drop policy if exists "machina anon all time sessions" on public.time_sessions;
create policy "machina anon all time sessions" on public.time_sessions
  for all to anon
  using (true)
  with check (true);

drop policy if exists "machina anon all active timer" on public.active_timer;
create policy "machina anon all active timer" on public.active_timer
  for all to anon
  using (true)
  with check (true);

grant select, insert, update, delete on table public.jobs to anon;
grant select, insert, update, delete on table public.tasks to anon;
grant select, insert, update, delete on table public.time_sessions to anon;
grant select, insert, update, delete on table public.active_timer to anon;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'jobs'
  ) then
    alter publication supabase_realtime add table public.jobs;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tasks'
  ) then
    alter publication supabase_realtime add table public.tasks;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'time_sessions'
  ) then
    alter publication supabase_realtime add table public.time_sessions;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'active_timer'
  ) then
    alter publication supabase_realtime add table public.active_timer;
  end if;
end $$;
