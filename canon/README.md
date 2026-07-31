# Tattoo Dice Canon

Internal landscape curation sheet at `/canon/`.

## Deliberately simple

Canon mirrors the Excel master: Word, Score, automatic Weight, Main, Detail, Effect, Family and Notes. The active theme is selected at the top. New theme lists can be added to the seed later without changing the workflow.

Testing does not happen in Canon. All combination ranking remains in the existing `/admin/` workflow.

## Data and storage

- `canon-seed.json` contains the 86 Excel subjects plus Dog, which copies Wolf's editable profile.
- Every edit is written to a local safety copy immediately.
- Shared cross-device sync uses the existing Supabase project. Run `canon/setup.sql` once to enable it.
- Data controls provide current-theme JSON export, full backup import/export and manual full cloud sync.

## Theme isolation

The theme exporter creates one runtime-compatible deck file at a time. It includes only active subjects assigned to the selected theme and expands them to one record per selected Main, Detail or Effect column. Paid theme lists therefore do not need to ship together in a future App Store binary.

The PIN is a client-side discovery deterrent, not server-side authentication.
