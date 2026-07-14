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


## Admin PIN

The admin page is protected by a client-side six-digit PIN:

`231189`

The PIN is intentionally not stored. Reloading `/admin/` requires it again.

This is a discovery deterrent, not strong server-side authentication. Do not publish
the PIN if the admin area must remain private.

## iPhone landscape

The admin interface explicitly supports iPhone landscape mode. This does not change
the portrait-only behavior of the public Tattoo Dice app.


## Home Screen app behavior
The admin has its own PWA manifest, service worker and gold-gear icon.

On iPhone:
1. Open `https://www.tattoodice.com/admin/` in Safari.
2. Tap Share.
3. Choose **Add to Home Screen**.
4. Remove an older Dice Admin icon first if iOS still opens Safari tabs.
5. Open **Dice Admin** from the new icon.

It opens standalone without Safari tabs or the URL bar. Landscape is preferred.
