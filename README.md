# Tattoo Dice v3.1.3 – Auto Roll + Main Reset

- Selecting a Main immediately closes the Main menu.
- A fresh roll starts immediately after the Main selection.
- Switching Theme resets Main to Random.
- The Main button updates immediately.
- Everything else remains unchanged.


## Admin Ranking Beta

A separate ranking interface is included at `/admin/`. See `admin/README.md` and run `admin/setup.sql` in Supabase for shared storage.


## v3.6.3 — Classic Multi-Slot Deck

- Rebuilt Classic from the completed multi-slot workbook.
- 86 unique Classic words generate 139 slot records.
- Words may exist as Main, Detail and/or Effect.
- The existing roll engine still prevents the same word from appearing twice in one roll.
- Battle Royale removed.
- Bones added.
- Wing is blocked from Butterfly, Eagle, Parrot, Raven and Swallow.
- No UI, animation, Admin, PIN, progress or formula code was changed.


## v3.6.4 — Icons, Social Preview & Dice Edge Fix

- Replaced the Tattoo Dice home-screen icon with the approved ivory five-pip icon.
- Replaced the Admin home-screen icon with the approved gold five-pip icon.
- Added the approved 1200×630 social-link preview artwork.
- Added Open Graph and Twitter preview metadata.
- Fixed the settled left/right dice being clipped, while leaving the intro/drop animation untouched.
- No deck, formula, rating, PIN, UI workflow or Admin functionality was changed.


## Animation revision
- Splash loading screen with green progress bar.
- Startup always begins in Random.
- Startup/theme/main use staggered left-right-main drops.
- Roll uses in-place rotation; selected Main stays still.
- Each shadow follows its die and fades with height.

## Acceptance-complete animation pass
See `ACCEPTANCE-CHECKLIST.md` for the exact implemented behavior.


## UX polish
- When a fixed Main is active, the 1-Dice selector remains visible but dimmed.
- Tapping it shows the inline hint “Select at least 2 Dice for a fixed Main.” for 1.5 seconds.


Current VFX iteration: v3.6.4-step-5.10.29 — Outer-shell plasma + pre-fall blink fix
