create extension if not exists pgcrypto with schema extensions;

create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  owner uuid references auth.users not null,
  title text not null,
  slug text not null unique,
  password_hash text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists boards_set_updated_at on public.boards;
create trigger boards_set_updated_at
before update on public.boards
for each row execute function public.set_updated_at();

alter table public.boards enable row level security;

drop policy if exists "boards_owner_select" on public.boards;
create policy "boards_owner_select"
on public.boards for select
using (auth.uid() = owner);

drop policy if exists "boards_owner_insert" on public.boards;
create policy "boards_owner_insert"
on public.boards for insert
with check (auth.uid() = owner);

drop policy if exists "boards_owner_update" on public.boards;
create policy "boards_owner_update"
on public.boards for update
using (auth.uid() = owner)
with check (auth.uid() = owner);

drop policy if exists "boards_owner_delete" on public.boards;
create policy "boards_owner_delete"
on public.boards for delete
using (auth.uid() = owner);

create or replace function public.create_board(
  board_title text,
  board_slug text,
  board_password text,
  board_data jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.boards (owner, title, slug, password_hash, data)
  values (
    auth.uid(),
    board_title,
    board_slug,
    extensions.crypt(board_password, extensions.gen_salt('bf')),
    board_data
  )
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.get_board(
  board_slug text,
  board_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  board_record public.boards;
begin
  select * into board_record
  from public.boards
  where slug = board_slug
    and password_hash = extensions.crypt(board_password, password_hash);

  if not found then
    return null;
  end if;

  return board_record.data;
end;
$$;

create or replace function public.save_board(
  board_slug text,
  board_password text,
  board_title text,
  board_data jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.boards
  set title = board_title,
      data = board_data
  where slug = board_slug
    and password_hash = extensions.crypt(board_password, password_hash);

  return found;
end;
$$;

create or replace function public.list_boards()
returns table (
  id uuid,
  title text,
  slug text,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select id, title, slug, updated_at
  from public.boards
  where owner = auth.uid()
  order by updated_at desc;
$$;

create or replace function public.get_board_owner(
  board_slug text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  board_record public.boards;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into board_record
  from public.boards
  where slug = board_slug
    and owner = auth.uid();

  if not found then
    return null;
  end if;

  return board_record.data;
end;
$$;

create or replace function public.save_board_owner(
  board_slug text,
  board_title text,
  board_data jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.boards
  set title = board_title,
      data = board_data
  where slug = board_slug
    and owner = auth.uid();

  return found;
end;
$$;

create or replace function public.set_board_password(
  board_slug text,
  board_password text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.boards
  set password_hash = extensions.crypt(board_password, extensions.gen_salt('bf'))
  where slug = board_slug
    and owner = auth.uid();

  return found;
end;
$$;

create or replace function public.delete_board(
  board_slug text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.boards
  where slug = board_slug
    and owner = auth.uid();

  return found;
end;
$$;
