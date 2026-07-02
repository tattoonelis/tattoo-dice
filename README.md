# Tattoo Dice v1.5.1

Supabase counter release.

Changes from v1.5:
- Cleaner Supabase counter handling.
- No Netlify Blobs.
- No Netlify Functions needed.
- Counter falls back cleanly if Supabase is temporarily unreachable.
- Header sits a little lower.
- Space between logo and slogan is smaller.

Before deploying:
Run this SQL in Supabase if you have not already done so:

alter table roll_counter enable row level security;

drop policy if exists "Anyone can read roll counter" on roll_counter;

create policy "Anyone can read roll counter"
on roll_counter
for select
to anon
using (true);

create or replace function increment_roll_counter()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_total bigint;
begin
  update roll_counter
  set total = total + 1
  where id = 1
  returning total into new_total;

  return coalesce(new_total, 0);
end;
$$;

grant execute on function increment_roll_counter() to anon;
