-- User courses: full Course JSON persisted per authenticated user.
create table if not exists public.courses (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  prebuilt_test_id text,
  added_at bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists courses_user_id_added_at_idx
  on public.courses (user_id, added_at desc);

create unique index if not exists courses_user_prebuilt_unique
  on public.courses (user_id, prebuilt_test_id)
  where prebuilt_test_id is not null;

alter table public.courses enable row level security;

create policy "Users can read own courses"
  on public.courses
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own courses"
  on public.courses
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own courses"
  on public.courses
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own courses"
  on public.courses
  for delete
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.set_courses_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.user_id := auth.uid();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists courses_set_metadata on public.courses;
create trigger courses_set_metadata
  before insert or update on public.courses
  for each row
  execute function public.set_courses_metadata();
