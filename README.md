# Tattoo Dice v3.1.3 – Auto Roll + Main Reset

## Combined preview release V0.2.53

- The public root remains the approved v2.52.24 app.
- The current development build is isolated under `/generator/`.
- `/generator/` is protected by the same six-digit PIN as Admin and Admin Test.
- The public root contains no Favorites or Generator controls from the development build.
- This remains a preview release until the product owner explicitly approves V1.0.0.

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

## v2.52.24 — Responsive tablet/desktop canvas + live tour controls

- The app background now fills the complete tablet/desktop viewport while the approved UI column remains centred.
- The WebGL render surface alone receives extra horizontal room on larger screens, preventing the two support dice from being clipped.
- Render height still uses the established phone-tested height formula, so dice size, controls, footer and animation timing do not change.
- The tablet/desktop header offset is reduced to restore safe visual space above the dice without changing the phone layout.
- The help tour now shows the actual live responsive controls instead of reconstructed copies, keeping button fonts and proportions identical at every screen size.

## Sidequest v2.51 — Header, Reset & Guided Help

- The supplied illustrated logo is used in the app header; the loading screen keeps its existing logo.
- The supplied red guide remains invisible and drives a maximum of two random light flares.
- The supplied blue marker has one permanent, gently breathing star flare.
- Reset returns to Classic, Random and 3 dice through the existing Fall → Drop lifecycle.
- Reset does not increment the roll counter and preserves the Shake setting.
- Menu close controls are visually reduced to a loose white cross.
- A footer help control opens a five-step guided tour in the existing overlay style.


## Protected Test Route

- `/admin/test/` opens a PIN-protected test entry using the same six-digit PIN as `/admin/`.
- After unlocking, the current root Tattoo Dice build is loaded at the test URL.
- The gate is client-side, matching the existing Admin protection model.


## Sidequest v2.47 — Square Shadow + Shake Control

- Removed the separate round shadow layer.
- Kept the dice-shaped square shadow and added a transparent feather extending 20% beyond every side.
- Kept all existing drop, idle, roll and fall shadow timing.
- Replaced the former shake text with one full-width `TOGGLE SHAKE` button below the main controls.
- The shake indicator is red when off and green when on.
- CLASSIC, ROLL and RANDOM now use one matching label height.
- Added the protected `/admin/test/` route for live HTTPS sensor testing.


## Sidequest v2.48 — Soft Shadow + Physical Shake Settle

- Rounded the dice-shaped contact shadows and replaced visible feather steps with twenty progressively transparent bands.
- Preserved the approved total shadow footprint and the existing Drop, Idle, Roll and Fall timing.
- Moved the compact 1/2/3 selector below the main controls, beside `TOGGLE SHAKE`.
- The selector matches one main-button column; the Shake control fills the remaining two columns.
- The Shake control now derives its height and internal typography from the compact selector dice.
- Stopping a shake no longer starts the ordinary Roll animation.
- Shaken dice now use a short, shortest-path settle into the valid canonical landing face without extra full spins.


## Sidequest v2.49 — Pre-GitHub Polish

- Kept the full 3D dice composition inside the width of the primary control row on portrait phones by scaling it uniformly.
- Restored perfectly square 1/2/3 selector dice and aligned them with `TOGGLE SHAKE`.
- Standardized every selector pip to the same size and optically balanced the 1, 2 and 3 patterns.
- Made Shake shadows follow the live moving and rotating dice, including the settle phase.
- Kept the fixed-Main notice in one centered message slot directly above the primary controls.
- Raised all menus above live dice, Drop/Fall snapshots and transition layers.
- Reduced the corner radius of the primary and Shake controls to an app-icon-like curve.
- Preserved the existing Roll, Main, VFX, composition and timing behavior.


## Sidequest v2.50 — Forward Shake Settle

- Commits the predetermined Shake result while every affected die is still moving.
- Removes the late visible word swap near the end of the landing motion.
- Continues each die briefly in its live Shake direction before easing into its exact canonical result face.
- Keeps the existing per-die delay and duration differences so the dice do not stop mechanically in sync.
- Rebuilds every contact shadow as one continuously blurred rounded-square projection with no alpha cutoff, contour bands or hard polygon edge.
- Shows a centered notice when Shake to Roll is unsupported, requires HTTPS or lacks motion permission.
- Leaves the ordinary Roll, Main, VFX, controls, compositions and shadow lifecycle/timing unchanged.


## Sidequest v2.52.15 — Final Responsive Polish

- Fits the complete header, dice, controls and footer inside one invisible proportional mobile shell.
- Uses both the available device width and stable viewport height so Safari and installed iOS/Android PWAs keep the same composition.
- Removes the old nested stage sizing that could push utility controls behind the footer.
- Keeps the complete 1/2/3 dice composition centered and smaller through the
  portrait camera, without shrinking its animation area or changing canonical poses.
- Starts on a black background before the loading UI and external styles are available.
- Restores the landscape rotation screen for touch iPads as well as phones.
- Matches RESET typography to TOGGLE SHAKE.
- Refines header flares into softly glowing, sharp four-point stars.
- Reduces the header aura to 75% of its former footprint and colours it with
  the same blue used by the Theme button.
- Keeps TOGGLE SHAKE and the dynamic Main/Random label on a single line at
  narrow mobile widths.
- Uses one identical font size, weight and line height for TOGGLE SHAKE and RESET.
- Scales every control label, button height, gap, selector die and pip from the
  actual controls width, preventing clipped text in mobile Safari and PWAs.
- Prevents automatic iOS text inflation from changing the approved proportions.
- Raises the complete live header group and its splash-flight destination.
- Mirrors header sparkles and gives travelling flares a longer smooth fade.
- Restores the earlier neon Main VFX colours (`#35FF83` / `#38D879`) while
  preserving the current brand green on buttons and loading UI.
- Enlarges and strengthens the blue header aura.
- Copies guided-tour targets at their exact computed position, size and finish
  instead of rebuilding them inside a second layout grid.
- Keeps a safe top and side margin around the complete header on short mobile
  browser windows while moving its artwork, aura and flares as one group.
- Paints the document and loading gate black inline before external CSS or
  JavaScript can load, eliminating the white pre-loading frame.
- Lets RESET interrupt an active Main/count drop immediately and hand control
  straight to one clean opening reset, without revealing an idle Main between
  the interrupted animation and the reset.
- Moves the complete header group downward into the approved safe zone.
- Limits travelling header sparkles to three and gives each one a slower,
  longer fade-in and fade-out.
- Adds TOGGLE SHAKE to the guided tour and keeps the complete live header
  unblurred above the tour overlay.
- Keeps the enlarged sparkles elegant with a narrow centre and long needle points.
- Carries the blue header aura into the loading screen and matches its background
  to the app for a seamless handoff.
- Reduces header sparkles to 65%, slows their complete rhythm and prevents
  simultaneous sparkles from clustering on the same part of the logo.
- Keeps the footer question-mark glyph at the same responsive letter height as
  the counter.
- Prevents the portrait iPad stage track from exceeding its 430px app shell,
  keeping the complete header, dice and control rows centred and usable.
- Uses one shared blue header-aura configuration during loading and idle, so
  the glow no longer loses intensity at the handoff.
- Lets a selected Main gently wobble around its local front/back axis during
  Shake to Roll, then eases it back to its exact canonical idle pose.
