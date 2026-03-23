create extension if not exists pgcrypto;

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  author text,
  genre text,
  isbn text,
  status text not null default 'Da leggere',
  notes text,
  cover_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

DROP TRIGGER IF EXISTS trg_books_updated_at ON public.books;
create trigger trg_books_updated_at
before update on public.books
for each row
execute function public.handle_updated_at();

alter table public.books enable row level security;

create policy "Users can read own books"
on public.books
for select
using (auth.uid() = user_id);

create policy "Users can insert own books"
on public.books
for insert
with check (auth.uid() = user_id);

create policy "Users can update own books"
on public.books
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own books"
on public.books
for delete
using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('book-covers', 'book-covers', true)
on conflict (id) do nothing;

create policy "Public can view covers"
on storage.objects
for select
using (bucket_id = 'book-covers');

create policy "Authenticated users can upload own covers"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'book-covers' and
  (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Authenticated users can update own covers"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'book-covers' and
  (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'book-covers' and
  (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Authenticated users can delete own covers"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'book-covers' and
  (storage.foldername(name))[1] = auth.uid()::text
);
