# Tattoo Dice Admin Ranking Beta

Open locally at:

`http://127.0.0.1:5500/admin/`

When deployed at the root of tattoodice.com, it will be available at:

`https://www.tattoodice.com/admin/`

## Shared storage

The page uses the existing Supabase project already configured in Tattoo Dice.

Before cross-device saving works:

1. Open Supabase.
2. Go to **SQL Editor**.
3. Open `admin/setup.sql`.
4. Paste its contents into a new query.
5. Run it once.

Until the table exists, the admin automatically falls back to local browser storage.

## Data model

Every judgement is saved as a separate row:

- theme
- dice count
- selected Main
- rolled words
- canonical combination key
- rating: `up`, `down`, or `open`
- optional note
- timestamp

Repeated combinations are aggregated in the dashboard. Positive and negative
ratings are counted; whichever count is higher becomes the current verdict.
A tie remains Open.

## Important

This is an admin/test interface, but it does not yet include authentication.
Do not share the `/admin` URL publicly if only you should submit rankings.
