# Tattoo Dice Canon

Internal mobile curation tool at `/canon/`.

## Data and storage

- `canon-seed.json` contains the 86 Excel subjects plus Dog, which copies Wolf's profile.
- Local storage is written immediately on every edit.
- Shared cross-device sync uses the existing Supabase project. Run `canon/setup.sql` once to enable it.
- Admin rankings are read from the existing `admin_rankings` table when available.
- Ranking and highlight CSV files can also be imported without changing the public app.

## Theme isolation

The theme exporter creates one runtime-compatible deck file at a time. An exported theme includes only active subjects assigned to that theme, expanded to one record per Main, Detail or Effect slot. The full canon remains an internal backup and does not need to ship in a future App Store binary.

## Targeted testing

- New subject: 30 targeted rolls.
- Changed slot/theme/availability: 24 targeted rolls.
- Other profile change: 12 targeted rolls.
- Removed subject: 10 regression rolls from the remaining pool.

The target subject is forced into every eligible test roll. Existing unchanged subjects are used as partners, so a new or changed theme does not require repeating the complete 500/1000-roll ranking run.

The PIN is the same client-side discovery deterrent used by Admin. It is not server-side authentication.
