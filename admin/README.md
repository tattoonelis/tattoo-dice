# Tattoo Dice Admin Panel

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

This is a PIN-protected internal panel. The PIN remains a client-side discovery deterrent rather than server-side authentication.


## Admin PIN

The admin page is protected by a client-side six-digit PIN:

`231189`

The unlock is retained only for the current browser-tab session so Testversie, Ranking and Canon can be opened without entering the PIN repeatedly.

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


## v3.2.4
- Landscape-only mobile experience with rotate-device screen in portrait.
- All rating controls fit in one fixed screen.
- One full-width porcelain result bar replaces separate cards.
- Compact, aligned controls and rating panel.
- Open green progress meter with percentage centered over it.


## v3.3.0 rebuild
- Rebuilt the admin as a focused one-screen training game.
- All existing PIN, Supabase, ranking, notes, export and stats features remain.
- Compact porcelain dice-slab keeps the Tattoo Dice feel without dominating the screen.
- Theme progress switches immediately between Classic and Fantasy.
- Goal remains 3000 ratings per theme.


## v3.4.0 portrait rebuild
- Admin is portrait-only on mobile.
- Desktop renders the same portrait app inside a centered phone-width frame with black side bars.
- Landscape shows a rotate-device message.
- Existing PIN, Supabase, stats, notes, CSV and progress features remain.


## v3.5.0
- Removed separate Roll, Skip and neutral-rating controls from the main flow.
- Animated Tattoo Dice-style dice return to the center stage.
- F*CK NO and H*LL YES save the rating and immediately generate the next roll.
- All existing PIN, Supabase, stats, notes, progress and export features remain.


## v3.5.1
- Dice now roll in place instead of falling in from above.
- Removed the redundant combination question.
- Fixed note-field and verdict-button overlap.
- Preserved all PIN, Supabase, stats, progress, notes and export functionality.


## v3.5.3
- Fixed the missing Admin WebGL dice initialization.
- Added a delete button to Combination Rankings.
- Deleting a ranking removes every stored vote for that combination.
- Run the updated `admin/setup.sql` once more in Supabase to enable deletes.

## v3.6.0
- Branding swapped.
- Added MEH rating.
- Added 5% milestone overlays.
- Public tips dismiss anywhere.
- Run updated admin/setup.sql once.

## v3.6.1
- Milestone overlay is now hidden until an actual 5% milestone is reached.
- Admin Ranking subtitle is forced red.
- F*CK NO, MEH? and H*LL YES remain on one row.
- Verified MEH save, stats and ranking support.

## V0.2.53 Admin ranking refresh
- Admin access and ranking use the supplied Tattoo Dice Admin header.
- UI colors, rounded font, dice materials and Roll motion match the generator build.
- The ranking workflow now exposes only 2-dice and 3-dice testing.
- Targets are tracked per theme and per count: 500 two-dice tests and 1200 three-dice tests.

## V0.2.56 Shared ranking intelligence

- Admin Ranking, Public and Generator now use the same shared selection module.
- Admin now applies the same slot, weight, duplicate, family, `requires` and `blockedWith` checks as Public.
- Existing rankings create conservative pair multipliers: weak relationships become less likely, proven strong relationships receive only a small bonus.
- Individual subject weights are never reduced because of a weak partner.
- New Admin ratings update the Admin model after saving; Public and Generator load the same current ranking model on startup and theme changes.
- Existing Supabase records, ranking math and `tattoo-dice-admin-rankings.csv` remain compatible.
- Standout combinations use the Tattoo Dice heart interaction and are exported separately as `tattoo-dice-admin-highlights.csv`.
- Public root remains untouched; internal tools now live together under `/admin/`.

### Clean testing workspace
- Ranking always tests Random combinations; fixed Main selection is intentionally hidden.
- The primary screen contains the dice, standout heart, optional note, three verdicts and one compact Menu / 1–2–3 / Roll row.
- One die remains visible but disabled.
- Theme selection, statistics, rankings and exports live in the Admin menu.
- Progress and V0.2.53 use the same footer positions as the Tattoo Dice counter and credits.

## V0.2.57 Live Canon

- Admin Ranking loads the complete live deck published by Canon from Supabase.
- The bundled theme JSON remains the safe fallback.
- Returning to an already-open Admin page automatically refreshes Canon before subsequent rolls.
- Canon controls the available deck; rankings continue to control relationship probabilities.

## V0.2.58 Unified Admin Panel

- `/admin/` is the central home with Live App, Testversie, Ranking and Canon.
- Ranking moved to `/admin/ranking/`, Testversie to `/admin/generator/` and Canon to `/admin/canon/`.
- Each internal tool has a fixed route back to Admin Panel.
- Canon can create a new theme by selecting existing word names; complete subject profiles are inherited automatically.
- The shared Supabase theme catalog makes new themes available in Testversie and Ranking without code changes.

## V0.2.59 Public theme locks

- The public Live App now reads the same theme catalog as Canon, Testversie and Ranking.
- Every newly created theme starts locked for public use.
- Open a theme in Canon and use `UNLOCK FOR PUBLIC` or `LOCK FOR PUBLIC` in its Data screen.
- Classic is always public. Fantasy keeps the existing `2311` tester PIN.
- Locked themes remain available without restriction in Testversie and Ranking.
- Live checks access when opened or resumed, when the theme menu opens, and after each completed roll.
- If a theme is locked while somebody is rolling, that roll finishes and the following roll is stopped.
- This uses the existing `canon_subjects` table and needs no new Supabase setup.

## V0.2.60 Native Live and automatic public sync

- The Live App card opens `/admin/live/`: a full-screen, app-like view of the exact public app with an Admin return button.
- This remains inside the installed Admin PWA instead of opening a separate-looking management screen.
- Public sessions refresh Canon and Ranking on startup, theme changes, app return, every minute while active and after rolls when a full refresh is due.
- Theme access is still checked after every roll.
- Main selection is derived live from the current deck and shows only active Main entries with score exactly 3.
- A new score-3 Main is added automatically. Lowering it to 2, removing its Main slot or removing it from the theme removes it automatically.

## V0.2.61 Independent theme profiles

- A subject has one shared name but a separate score, slots, family, notes and hard-rule profile for every theme.
- New themes copy selected Classic profiles once and then diverge independently.
- Fantasy contains the 147 supplied word names. Existing Classic matches inherit the live Classic profile; new names start empty at score 0.
- An incomplete entry has no slot or family. It is visible in Canon as `UNASSIGNED` but cannot enter a published deck or ranking roll.
- Choosing at least one slot and a family makes an entry publishable automatically.
- Public OPEN / LOCK controls are available directly beside each theme tab.
- This V3 payload continues using `canon_subjects`; no Supabase migration is required.
- Secure purchases, promotions and event entitlements are a later server-side phase and must not rely on the current visual lock alone.
