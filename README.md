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

## v2.54.32 — Generator polish, first-paint guard and unique rolls

- Replaced the Generator artwork with the supplied clown illustration and kept the complete drawing visible.
- The Generator title and its aura now fade out when the speech bubble enters.
- The splash logo image is attached only after it has fully decoded, preventing a white image placeholder before the loading screen.
- Short desktop layouts uniformly scale the approved phone composition without changing the phone layout.
- Roll selection now compares normalized subject names across every slot and when expanding from 1 to 2 or 3 dice.
- Added an accessible result label so complete rolls can be verified without changing the visible UI.


## UX polish
- When a fixed Main is active, the 1-Dice selector remains visible but dimmed.
- Tapping it shows the inline hint “Select at least 2 Dice for a fixed Main.” for 1.5 seconds.


Current VFX iteration: v3.6.4-step-5.10.29 — Outer-shell plasma + pre-fall blink fix

## v2.54.14 — Favorites deck and interaction polish

- Previous-roll dice now settle with a slower, readable horizontal swipe.
- Exact side-face words are preserved when restoring the previous roll.
- Starting a Roll or changing the 1/2/3 composition immediately resets the favorite heart.
- Favorites use an opaque, permanent playing-card deck with A/2/3 heart layouts.
- Favorite cards can be swiped forward and backward with matching deliberate timing.
- The completed Generator reveal now shows a red “I’LL DRAW IT MYSELF” action.
- MENU and MAIN open and close in sync with a background fade into blur.

## v2.54.15 — Fixed Favorites deck

- Favorites from every theme now live in one chronological deck: newest above oldest.
- Cards can be drawn off the deck to either the left or right.
- RESTACK returns every drawn card without changing the saved order.
- The deck underneath is permanent; the live top card never changes size.
- Playing-card hearts are larger, separated like dice pips and use matte lighting.
- Words sit inside the broad center of each heart and may wrap instead of clipping.
- REMOVE FAVORITE now uses the exact home-screen heart and throws the card upward.
- Fantasy code entry keeps its existing PIN behavior in the same visual proportions as the menus, without an UNLOCK title.

## v2.54.16 — Prepared Favorites cards

- The complete next favorite card, including hearts and words, is already
  rendered beneath the current card before a swipe begins.
- Hearts scale by subject count: one is largest, two are slightly smaller and
  three retain the most spacing.
- Heart groups have more vertical spread and use more of the available card.
- Labels sit below the heart notch in the broad red area.
- Longer subjects remain on one line and progressively reduce in size instead
  of clipping or entering the notch.
- The matte gloss pass moves more slowly across the card.

## v2.54.17 — Matched heart labels

- Uses the approved Eagle card as the optical text-position reference.
- Labels on two- and three-subject cards now sit equally low in the broad red
  area of their hearts, clear of the top notch.
- Heart size, spacing, deck preparation and swipe behavior remain unchanged.

## v2.54.18 — Transparent Generate plasma

- Keeps the existing shared Main Dice plasma shader.
- Replaces the opaque ivory Generate surface with a smoked translucent resin.
- Renders the live plasma beneath a thin glass/resin finish and the button text.
- Increases plasma contrast while preserving the existing green aura.

## v2.54.19 — Light-resin Generate

- Restores the approved light ivory Main Dice material language.
- Keeps the shared live plasma and layered resin construction from v2.54.18.
- Uses black dice-style lettering and a translucent light finish instead of a
  dark smoked surface.

## v2.54.20 — Responsive Guide

- Removes the duplicate illustrated heart/card and dice demonstrations.
- Highlights only the real current interface controls and dice stage.
- Positions each message and arrow in the available space around its target.
- Uses a horizontal swipe arrow for the Previous Roll step.

## v2.54.21 — Stable Guide + About

- Reorders the Guide from top to bottom and left to right.
- Keeps the title, explanation and eight page dots in fixed positions.
- Removes Guide arrows and uses the real Previous Roll dice movement instead.
- Adds the complete About copy.
- Temporarily removes Privacy from the Menu.

## v2.54.25 — Result Heart + Unified Theme Selector

- The Favorite heart is now a non-layout overlay at the lower-left of the complete dice result, outside the dice geometry.
- The theme selector is one menu row with the exact same dimensions and surface as the other menu choices.
- The arrows remain fixed while only the centered theme name moves.
- Browsing never activates or unlocks a theme.
- Closing the menu applies the previewed theme; a locked preview opens its PIN screen only after closing.
- The centered theme name now uses the exact same font size, weight and family as every other menu row.

## v2.53.1 — Full-page Favorites and AI Image

- Favorite heart is now an overlay inside the dice viewport.
- Menu and Main popups use their matching blue/green button materials.
- Theme arrows preview only; the centre field confirms the theme.
- Favorites and AI Image Generator are dedicated app pages with the original
  footer and credit position.
- Favorites use larger red hearts, opaque stacked cards and page-level controls.
- AI generation pauses at 89%, reveals blurred artwork from 80% and clears it
  at 100% before dropping the message bubble.
- Existing dice engine, Roll/Shake, Main VFX, shadows and composites are
  unchanged.

## v2.53.0 — Menu, Favorites, Previous Roll & AI Image

- The existing blue Theme button is now the Menu entry; Theme remains inline inside that popup.
- Complete roll states can be saved locally as Favorites with a fixed heart control.
- Favorites open as a prebuilt heart-card stack with Pointer Events navigation.
- One previous completed Roll or Shake result can be restored by swiping/dragging right across the dice stage.
- Guide now lives inside Menu and includes Favorites and Previous Roll demonstrations.
- AI Image is a local easter egg that uses actual Favorite combinations and never calls an AI or external service.
- About and Privacy screen shells are present without temporary content.
- Existing dice, VFX, shadow, Roll, Shake, count, Main and responsive systems remain the v2.52.24 implementation.
- See `V2.53.0-IMPLEMENTATION-AND-TEST-REPORT.md` for state ownership, cleanup and test coverage.

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

## v2.53.2 — Previous Roll + stable AI page

- Restores a one-level Previous Roll gesture: after a Roll, drag/swipe the dice
  to the right to bring the previous result back.
- Preserves the captured dice-stage aspect ratio during that drag so the dice
  cannot stretch or warp while moving.
- Applies the same aspect-ratio lock to the existing Drop/Fall captures.
- Moves the favorite heart down by approximately its own height while keeping
  it as a non-layout overlay inside the dice stage.
- Shows the short `SWIPE RIGHT: LAST ROLL` hint for ten seconds after the
  first settled Roll (`DRAG RIGHT` on pointer devices).
- Moves Menu and Main close controls outside the top-right of their panels.
- Keeps THEME above its theme selector while grouping both inside one component.
- Enlarges the AI generator window to match the visual weight of Favorites.
- Matches its width to the complete three-button control row and gives the
  generator a lighter material than the app background.
- Places the favorite selector inside the generator and replaces it in-place
  with “I’LL DRAW IT MYSELF” when generation finishes.
- Adds the fixed bottom row: BACK TO DICES, GENERATE and SAVE IMAGE.
- Locks Back and Save while generation is running, pauses at 89%, and reports
  IMAGE FINISHED at 100%.
- Rebuilds GENERATE as an ivory resin control with white-hot green plasma veins
  and an emerald aura, matching the selected animated Main Dice language.
