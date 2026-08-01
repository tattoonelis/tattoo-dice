-- Tattoo Dice Canon shared storage.
-- Run once in the same Supabase project used by /admin/.

create table if not exists public.canon_subjects (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists canon_subjects_updated_at_idx
  on public.canon_subjects (updated_at desc);

alter table public.canon_subjects enable row level security;

drop policy if exists "Canon read" on public.canon_subjects;
create policy "Canon read" on public.canon_subjects for select to anon using (true);

drop policy if exists "Canon insert" on public.canon_subjects;
create policy "Canon insert" on public.canon_subjects for insert to anon with check (true);

drop policy if exists "Canon update" on public.canon_subjects;
create policy "Canon update" on public.canon_subjects for update to anon using (true) with check (true);

drop policy if exists "Canon delete" on public.canon_subjects;
create policy "Canon delete" on public.canon_subjects for delete to anon using (true);
