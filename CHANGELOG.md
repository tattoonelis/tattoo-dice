# v2.42 — overflow Ground Contact layer

- Kept the approved non-hover dice behaviour from v2.41.
- Moved only the visible Ground Contact pixels to one persistent transparent
  layer between the background and the live WebGL dice.
- The existing Three.js shadow groups remain the single owners of shadow
  lifecycle, opacity and projected shape in Drop, Idle, Roll and Fall.
- Extended the shadow layer 96 px below the dice stage so its soft feather can
  cross the former hard canvas boundary.
- Kept the complete shadow behind the dice, aura and 1/2/3 controls.
- Orb, plasma, aura, composites, timings, buttons and all other visuals are
  unchanged.

# v2.41 — hover experiment removed

- Restored the complete approved v2.38 dice, aura and Ground Contact system.
- Removed all Idle hover/tilt code and its height-driven shadow behaviour.
- Removed the separate overflow shadow canvas and silhouette masking experiment.
- Random/Main, Roll, Drop, Fall, 1/2/3, orb, plasma, aura and controls are
  otherwise exactly the tested v2.38 implementation.

## Sidequest v2.25 — Support dice retained during Main drop

- Keeps already-landed support dice visible behind the selected Main while the
  live WebGL canvas follows the aura during the Main drop.
- Main, aura, orb, plasma, timing, composites and all other phases are unchanged.

## Sidequest v2.24 — Live Main aura lifecycle

- Removed the Main aura from Drop/Fall PNG snapshots.
- Kept the existing Three.js aura as the single permanent child of the Main VFX group.
- During Drop and Fall, the live aura canvas follows the exact Main snapshot keyframes.
- Prevented inactive permanent dice slots from entering the Roll path after a 1/2/3 switch.
- Resin, orb, plasma, pulse, buttons, composites, timings and other visuals are unchanged.

## Sidequest v2.23 — Aura single opacity owner

- Built directly from v2.22.
- No plasma, orb, dice material, composite, buttons, timings, loading or contact-shadow behavior changed.
- Fixed aura brightness jump at Drop → Idle and Idle → Fall.
- Root cause: aura opacity had two writers (`setMainTintProgress()` and `updateMainPlasmaTime()`).
- `setMainTintProgress()` no longer writes aura sprite opacity.
- `updateMainPlasmaTime()` is now the single owner of aura opacity, preserving the current breath multiplier through handoffs.

## Sidequest v2.22 — Contact shadows removed

- Built directly from the supplied v2.21.
- Removed the visible contact shadow under all dice in every phase: Drop, Idle, Roll and Fall/count transitions.
- Existing shadow objects remain as inert hidden placeholders only, so a future shadow can be rebuilt cleanly as part of the unified dice lifecycle without touching the stable dice state/composite.
- No aura, plasma, orb, Main VFX, buttons, 1/2/3 logic, composite, Roll timing, Drop/Fall timing or loading logic changed.

## Sidequest v2.21 — Startup/load repair

- Built directly from v2.20; unified Main VFX lifecycle is retained.
- Fixed the exact v2.20 loading failure: the top-level `init()` call ran before `MAIN_VFX_CONFIG` had been initialized.
- `init()` calls `setupThree()` synchronously before its first `await`; v2.20's `setupThree()` reads `MAIN_VFX_CONFIG.glowLightHex`, which caused an ES-module temporal-dead-zone ReferenceError.
- Startup now runs only after the complete module has evaluated.
- Added an explicit init error catch for diagnostics.
- No VFX appearance, button behavior, composite, Roll timing, Drop/Fall timing, deck logic or layout values changed.

## Sidequest v2.20 — Unified Main VFX lifecycle

- Built directly from the supplied v2.19.
- Main Dice VFX now has one lifecycle: resin + orb + plasma + aura are captured/moved together.
- Removed the separate aura PNG capture, aura DOM image and aura-specific Drop/Fall animation path.
- Aura remains a permanent child of the same Main VFX group as plasma/orb.
- Aura material keeps additive RGB appearance but now writes normal usable framebuffer alpha via CustomBlending, allowing the same aura to survive the ordinary Main snapshot.
- Added one central `MAIN_VFX_CONFIG` for Main VFX color/intensity/orb settings; aura/plasma now read their green from that shared config.
- Button/state fixes, DICE_COMPOSITES, Roll timings, plasma shape, orb shape and aura size/pulse values are unchanged.

## Sidequest v2.19 — Aura capture fix only

- Built directly from v2.18.
- No button/state, plasma, orb, layout, composite, Roll or animation timing changed.
- Root cause found: the live aura uses additive WebGL blending; that renders correctly in idle but loses usable alpha when captured to the transparent PNG used by Drop/Fall.
- Aura capture now temporarily uses normal alpha blending only while generating the lifecycle snapshot, then immediately restores the approved live additive material.
- Drop / Idle / Fall therefore use the same aura source and the aura stays attached to the selected Main.
- Random remains VFX-free.

## Sidequest v2.18 — Aura lifecycle only

- Built directly from v2.17.
- No button/state, composite, Roll, plasma, orb, material, layout or timing values changed.
- Idle continues to use the existing live WebGL aura unchanged.
- Selected Main Drop now carries an exact aura-only snapshot using the same transform/timing as the Main.
- Selected Main Fall/count exit now carries the same aura-only snapshot using the same transform/timing as the Main.
- Random mode still never creates/shows Main aura lifecycle snapshots.
- Aura snapshot cleanup is included in the existing drop-overlay cleanup path.

## Sidequest v2.17 — Button / interaction repair only

- No visual, VFX, layout, material, plasma, aura, orb or animation-shape changes.
- 1 / 2 / 3 can now be selected in every Main mode.
- Input taps during Roll/Drop/Fall are queued instead of silently ignored.
- Latest requested dice count is applied after the current animation; Roll queues once.
- Roll lock uses `try/finally`, so `rollInProgress` always releases.
- Count transition now releases `introActive` between Fall and Drop, fixing the guard conflict that could prevent the new Drop from starting.
- Count transition also always clears `introActive` and `snapshotDropActive` in `finally`.
- Count buttons resynchronise to the actual `wordCount` after every completed action.

## Sidequest v2.16 — v2.14 audit + stability repair

- Uses the supplied v2.14 as the only baseline.
- Removed all empty-face fallback paths that silently generated `Roll`.
- Fixed the actual white `Roll` artifact in Main VFX: permanent plasma shader face masks now follow the current Main textures, including mid-Roll commits.
- Plasma now includes the shaded rounded resin bevel through the shader surface mask; removed the 1.5% plasma geometry overscale.
- Simplified Drop/Fall to one complete selected-Main snapshot containing resin + orb + plasma + aura; removed the second aura-only snapshot pipeline.
- Added failure-safe Drop cleanup so a snapshot/VFX error cannot leave `introActive` stuck and disable 1/2/3.
- Reasserts exact active-slot visibility and canonical poses after Drop/count changes.
- DICE_COMPOSITES values, normal Roll motion, orb design, aura design and preload are otherwise unchanged.

## Sidequest v2.14 — Main aura lifecycle

- No composite, layout, scale, roll, orb, plasma or aura design values changed.
- External Main aura is now captured as its own exact transparent lifecycle snapshot.
- Drop: aura snapshot follows the exact same transform/timing as the selected Main.
- Idle: existing live WebGL aura remains unchanged.
- Fall/count exit: aura snapshot follows the exact same transform/timing as the selected Main.
- Random mode still never shows Main VFX.
- Aura centre masking is preserved by retaining the invisible physical Main in the depth buffer during aura-only capture.

## Sidequest v2.13 — Plasma face finish only

- No layout, animation, preload, slot, orb or aura behavior changed.
- Removed the visible `Roll` placeholder from permanent dice-slot face materials.
- Increased only the internal primary plasma shell to 101.5% scale so plasma continues over the rounded resin bevel/corners.
- Aura remains unchanged and remains the only intentionally external glow layer.

## Sidequest v2.12 — Canonical composite source of truth

- Keeps v2.11's permanent slots, preload and cached-texture runtime architecture.
- Added one canonical `DICE_COMPOSITES` source for 1 / 2 / 3.
- Idle, normal Roll, Drop, Fall, count transitions and animation completion now all read final position, rotation and size from that same source.
- Fixed the remaining normal-Roll scale regression where animated dice still used `GROUNDED_DICE_SCALE` instead of their canonical layout size.
- Restored fully opaque/depth-tested physical materials for Main in Random mode.
- Removed the depthTest=false Main-material hack.
- Added one universal two-stage compositor for 2/3 dice: rear composition first, then the same permanent Main slot over the preserved framebuffer after depth-only clear.
- The compositor is identical for Random and fixed Main, so selecting Main only toggles lock/VFX state.
- One-die mode remains a single ordinary render pass.
- Active-slot invariant retained so hidden permanent slots cannot reappear.

## Sidequest v2.11 — Exact v2.8 layout scale + persistent-slot visibility fix

- Keeps the v2.10 permanent-slot/preload architecture.
- Restores the exact v2.8 layout constants and exact idle visual sizes.
- Fixed unit-slot scale semantics: layout size now replaces the old size-specific geometry instead of being multiplied by `GROUNDED_DICE_SCALE`.
- Normal roll/drop/fall now preserve each slot's canonical layout size.
- Fixed persistent-slot count leakage: drop sequencing uses active `wordCount`, not permanent array length 3.
- Hidden slots can no longer be resurrected by 1/2/3 transitions or startup/drop visibility code.
- Added an active-slot invariant after drop completion.
- Main VFX and universal foreground behavior remain unchanged.

## Sidequest v2.10 — Unified permanent dice slots + preloaded runtime

- Rebuilt from the supplied v2.8 baseline; v2.9's broken second foreground render is not carried forward.
- Added one universal permanent slot system for 1, 2 and 3 dice:
  - slot 0 = Main / foreground
  - slot 1 = rear/secondary
  - slot 2 = rear/tertiary
- Slots, geometry, six face materials and shadow meshes are constructed once and then only repositioned, resized or hidden.
- Main selection now changes only slot 0; rear dice are not rebuilt or replaced.
- Random and fixed Main use the exact same scene/render pipeline.
- Slot 0 is always foreground in one WebGL pass via state-independent material depth/render order; this removes the visual rear/Main merge without v2.9's second-render clearing bug.
- Roll result changes now swap cached texture references instead of allocating/discarding MeshPhysicalMaterials.
- All active-deck word textures are cooperatively preloaded behind the splash.
- Main orb/plasma/aura resources are created once; Random hides them and skips their animation updates.
- Removed per-frame static shadow transform recalculation.
- V2.8 Main pose and all approved orb/plasma/aura visual parameters are otherwise preserved.

## Sidequest v2.8 — restored Main pose + VFX state audit
- Restored the 3-dice Main pose literally from v2.6: `[0.00, -0.34, 0.78, -0.68, 0.00, 0.00, 2.06]`.
- Kept the v2.7 orb, plasma and external aura implementation unchanged.
- Main VFX are now strictly gated to a fixed Main selection; Random mode does not allocate or animate them.
- Fixed cached dice-texture disposal during dice rebuilds to prevent stale/disposed texture reuse and related animation hitches.


## Sidequest v2.7 — External aura + 2/3 Main parity
- Replaced cube-shell aura with feathered camera-facing glow sprites that are depth-masked by the solid die, so the aura is visibly outside the silhouette.
- Added continuous circular drift and breathing to the external aura.
- Normalized internal orb/plasma coordinates to the approved 2-dice Main size.
- Matched the 3-dice Main viewing orientation to the approved 2-dice Main orientation while preserving the 3-dice position and size.
## sidequest v2.2 — smoother normal roll + 30% faster drop/fall

- Reduced the WebGL DPR cap from 2.5 to 2.0 to lower fill-rate cost on high-DPI phones while preserving crisp dice edges.
- Reduced the directional-light shadow map from 2048 to 1024; the visible contact shadows remain the existing controlled mesh shadows.
- While a fixed Main die stays idle during a normal Roll, only its secondary plasma depth pass is temporarily disabled. The primary orb/plasma remains visible and the full two-layer effect is restored after the roll.
- Shortened the die drop duration by exactly 30%: 1120 ms -> 784 ms.
- Shortened the count-selection fall duration by exactly 30%: 620 ms -> 434 ms, including the stagger delay (34 ms -> 24 ms).
- Shortened the small between-drop pause by 30%: 100 ms -> 70 ms.
- No roll trajectory, landing pose, orb size/hover, deck logic, splash behaviour or UI layout changed.

## sidequest v2.1 — Larger hovering energy orb + roll render optimization

- Increased the internal Main Dice energy-orb base radius from 0.46 to 1.012 (exactly 220%).
- Added a restrained three-axis hover around the physical centre, using non-matching slow rhythms so the orb drifts organically without leaving the die.
- Preserved the existing shared breathing driver for orb, plasma and green glow.
- Removed the redundant first-pass render of the Main die. It is now rendered once, in the same final top-layer pass as before, reducing duplicate plasma-shader work during rolls without changing its visual stacking.
- No roll timing, trajectories, landing poses, button behaviour, splash logic or deck logic changed.

## v3.6.4-step-5.10.29 — Outer-shell plasma + pre-fall blink fix

- Rebuilt from the supplied v3.6.4-step-5.10.28 archive.
- Plasma layers now use a normal-offset shell, so the currents visibly travel over the outside surface instead of reading as colour inside the die.
- The secondary layer hugs the surface; the primary layer sits slightly farther out for visible depth.
- Added a temporary full-scene cover during per-die exit snapshot capture. This prevents the internal isolation renders from flashing on screen before the fall.
- The cover is swapped atomically for the prepared exit snapshots after all dice have been captured.
- Fall motion, order, duration, shadows, opacity and plasma pattern are otherwise unchanged.

## v3.6.4-step-5.10.21 — Main Dice Plasma prototype

- Replaced the temporary flat green lifecycle tint with a procedural animated green plasma shader on the selected Main die.
- Plasma is rendered directly on all visible Three.js die faces and follows their perspective, drop, idle and fall states.
- The shader masks dark printed subject lettering so the plasma lives mainly in the pale die surface instead of recolouring the text.
- Reused the proven Main lifecycle: plasma fades in during the drop, remains animated while idle, and fades out during the count-switch fall.
- Removed the separate idle-only colour/emissive treatment so drop, idle and fall all use the same visual system.
- No dice movement, timing, layout, shadow, selection, roll or deck logic was changed.

## v3.6.4-step-5.10.19 — Main VFX lifecycle Step 1: persistent idle overlay

- Fixed the selected Main tint disappearing after the drop handoff.
- Added a real lightweight green overlay mesh attached to the resting Main die.
- The existing drop fade-in and fall fade-out timing are unchanged.
- The overlay remains present for the complete idle state and is removed only when the Main falls out or is deselected.

## v3.6.4-step-5.10.18 — Main VFX lifecycle Step 1 persistent idle tint fix

- Fixed the selected Main tint disappearing after the drop snapshot handed off to the resting Three.js die.
- The idle die now keeps a very light green surface tint plus the existing subtle emissive tint.
- Drop fade-in and fall fade-out behavior are unchanged.

## v3.6.4-step-5.10.17 — Main VFX lifecycle Step 1 idle hold fix

- Keeps the subtle green Main tint active after the complete drop sequence has finished.
- Drop fade-in and count-switch fall-out fade remain unchanged.
- No visual or behavioral changes to non-Main dice.

## v3.6.4 step 5.10.14c — WebGL stage seam removed

- Removed the additive warm floor-glow plane from the Three.js scene.
- The plane used an `rgba(255,248,232,...)` texture inside the transparent WebGL canvas while the page surface is `#faf9f5`; its canvas-clipped edge caused the visible horizontal band above the 1 / 2 / 3 controls.
- Dice, shadows, layout, controls and roll behaviour are otherwise unchanged.

## v3.6.4 step 5.10.14 — Count-transition depth lock

- Fixed the exit snapshot stacking order during 1/2/3 set transitions.
- The middle/main die now remains above both rear dice throughout the complete roll-out animation.
- No timing, movement, drop, shadow, layout or roll logic was changed.

## v3.6.4 Step 5.10.12 — Dice-count entry drops

- Added the approved full-screen Drop animation when the 1/2/3 selector introduces new dice.
- Existing visible dice remain on stage; only newly added dice fall into their final positions.
- Reducing the selected count still removes surplus dice immediately.
- No changes to normal Roll timing, startup Drop, landing poses, shadows, layout, camera, menus, or render layering.


## v3.6.4 Step 5.10.11 — Two-dice clearance and notice centering

- Increased only the horizontal spacing of the two-dice layout so both face labels remain fully readable.
- Re-centered the fixed-Main notice vertically between the 1/2/3 selector and the coloured action buttons.
- No changes to Roll timing, startup, landing, shadows, header, menus, camera, or render layering.

# Tattoo Dice Changelog

## v3.6.4-step-5.10.10 — Dice-count scene sync
- Connected the 1/2/3 selector to the actual Three.js scene instead of only changing the active button state.
- Selecting a count now immediately renders exactly that number of dice and the next Roll animates only those visible dice.
- Preserved already-visible subjects where possible when changing the count, so the selector does not act like a free reroll.
- Did not change Roll timing, movement, startup, landing, shadows, layout, camera, menus or render layers.

## v3.6.4-step-5.10.9 — Unified surface colour & solid slogan
- Unified the gradient endpoint, page background and footer plane under one exact `#faf9f5` surface token to remove any colour seam.
- Made the footer use that exact solid surface colour instead of relying on transparent compositing.
- Matched the slogan to the dominant cream colour of the supplied logo asset (`#f6f3eb`) and forced full opacity.
- Did not change layout, controls, dice, dice shadows, startup, landing, Roll, camera, menu flow or render layers.

## v3.6.4-step-5.10.8 — Control band artefact removal
- Removed the wide overlapping action-button blur that merged into a grey rectangular band behind the six controls.
- Replaced it with a compact, low-opacity contact shadow per coloured button.
- Replaced the transformed 1/2/3 selector offset with equivalent relative positioning to avoid an iPhone Safari compositor edge.
- Removed any inherited control/footer background, border, outline or section shadow.
- Did not change layout dimensions, dice, dice shadows, startup, landing, Roll, camera, menu flow or render layers.

## v3.6.4-step-5.10.7 — Lighter gradient & softer action buttons
- Shortened the dark-to-light background transition so it reaches the light UI around the midpoint of the dice.
- Increased the Classic, Roll and Random action-label typography by a further 10% on mobile and desktop.
- Kept dynamic Theme and Main labels uppercase after their settings change.
- Replaced the firm grey button drop with a roughly 50% lighter, more feathered shadow.
- Updated the pressed-state shadow to match the softer resting treatment.
- Did not change dice, shadow-dice, startup, landing, Roll, camera, menu flow or render layers.

## v3.6.4-step-5.10.5 — Mobile Master Layout
- Made the iPhone portrait composition the single source of truth for desktop proportions.
- Desktop now renders inside the same narrow portrait canvas instead of using a compressed desktop-specific layout.
- Increased the fixed header logo size on portrait layouts.
- Lowered the 1/2/3 selector row and tightened its spacing to the Classic / Roll / Random action row.
- Changed Classic, Roll and Random to the same rounded font family used on the dice labels.
- Did not change startup, landing, roll, dice rendering, camera or shadow behavior.

## v3.6.4-step-5.10.1 — shared image header
- Replaced the text header with the supplied handwritten Tattoo Dice logo.
- Converted the supplied checkerboard JPEG into a transparent cream-white PNG asset.
- The fixed header, splash logo and existing logo-flight now use the same single image asset.
- No dice, shadow, camera, roll, drop or UI-control behavior was changed.

## Step 5.9.1 — Underside contact alignment

- Anchored each resting shadow plate to the transformed centre of the die's real underside.
- The contact position now accounts for pitch, yaw and roll instead of using the die object origin.
- Shadow orientation follows the projected local X axis while remaining flat on the floor.
- No Roll, Drop, camera, composition or UI behavior changed.


## v3.6.4 Step 5.8.1 — Shadow startup & angle alignment

- Prevented the one-frame shadow flash before the dice startup animation.
- Shadows now remain hidden until the existing fall/roll proximity logic fades them in.
- Rear dice shadow fans now use each die’s approved resting yaw, so the contact edge aligns with the visible bottom and side edges.
- Dice composition, camera, startup motion, roll motion and landing logic are unchanged.
## v3.6.4 Step 5.5 — Shadow alignment

- Kept the approved Step 5.4.3 LEGO composition unchanged.
- Rotated each existing contact-shadow footprint to follow its die's resting yaw.
- Kept shadow size, opacity, texture, position, fade behavior and animation timing unchanged.
- No camera, splash, header, startup drop, atomic handoff, Roll, landing, physics or engine logic was changed.



## v3.6.4 Step 5.4.3 — LEGO composition correction

- Changed only the existing three-dice resting layout values.
- Tightened the outer dice into a clearer triangular group behind the middle die.
- Reduced outer-die yaw so less side face is visible while preserving a subtle inward turn.
- Increased top-face visibility slightly without making the top subject fully readable.
- Kept the middle die clearly forward and nearly frontal.
- No camera, shadows, splash, header, startup drop, atomic handoff, Roll, landing animation, timing or engine logic was changed.


## v3.6.4 Step 5.2 — Fixed-position shadow fade

- Replaced the separate falling DOM shadow with the existing Three.js contact shadow.
- Startup shadows now remain at their final position and final size for the entire drop.
- Shadows fade from 0 to full visibility over exactly the same duration as each die.
- Changed the footprint from a wide ellipse to a smaller soft rounded-square shape.
- Removed the landing position/scale jump while preserving Step 4e's atomic die handoff.

# Step 5.1 — Persistent Dark Contact Shadows

- Resting dice now keep a clearly visible contact shadow at all times.
- Maximum Three.js blob-shadow opacity increased from 0.14 to 0.52.
- Shadow visibility no longer drops out because of the closeness threshold.
- Startup landing shadow darkened to match the stationary scene more closely.
- No changes to splash, header, drop, landing handoff, roll, camera, or dice layout.

# Step 5 — Dynamic shadows

- Preserved the accepted Step 4e atomic landing handoff.
- Reversed the old contact-shadow scaling: higher dice now cast broader, lighter shadows; landed dice cast tighter, darker shadows.
- Startup overlay shadows now follow each die’s horizontal wobble instead of remaining visually detached.
- No changes to splash, header, dice movement, landing pose, roll result timing, or camera.

# Tattoo Dice changelog

## v3.6.4 master-clean — baseline refactor

Basis: the embedded `tattoo-dice-v3.6.4-acceptance-complete-ux-polish` build from the supplied `inverted-gradient-refined-r3-start-fix(2)` archive.

- Kept the existing HTML, CSS, JavaScript, decks, assets and admin files.
- Removed the obsolete nested ZIP and old outer build from the distributable project.
- Removed confirmed-unused JavaScript declarations and functions only.
- Removed leftover `Tap to start` CSS that had no corresponding HTML or JavaScript usage.
- Kept the automatic splash/loading screen and its current behavior unchanged.
- No deliberate visual, layout, timing or feature changes in this pass.

This file is the frozen baseline for all following local edits.

## Step 2 — Splash/header handoff
- Kept the existing splash, header and logo-flight architecture.
- Removed competing splash opacity animations and obsolete CSS transforms.
- The splash background now remains stable throughout the logo flight.
- Header reveal and splash removal happen atomically on the landing frame.
- The moving logo remains over the real header for two full paint frames before removal.
- No dice, Roll, selector, menu, counter or layout logic was changed.

## Step 3 — Roll result concealment
- Kept the approved Roll movement and timings unchanged.
- The next Roll is now prepared on the existing dice instead of rebuilding the Three.js scene before motion starts.
- The previous readable faces remain visible until each moving die has rotated away from the camera.
- New face textures are committed during the hidden part of the rotation and are already present at landing.
- No post-animation text swap is used.
- A fixed Main remains stationary and its unchanged material is not replaced.
- No splash, header, selector, menu, shadow, counter or layout code was changed.

## Step 3b — Roll smoothness check
- Kept the approved concealed-result behaviour.
- Moved expensive text-texture generation out of the Roll button's click frame.
- Starts the existing Roll animation immediately.
- Builds one die's pending materials per rendered frame to avoid a single blocking pause.
- No changes to Roll motion, timing, layout, splash, header, selector, menus or shadows.

## Step 3 final — seamless Roll concealment
- Removed the per-frame material-building queue that caused the visible micro-pause.
- Only the final landing face is prepared for each moving die; unchanged side faces are left untouched.
- The pending landing face is committed only when its real world-space normal points away from the camera.
- Reused cached word textures so the animation loop performs no canvas drawing or texture creation.
- Kept the approved Roll movement, duration, bounce, fixed-Main behaviour and final pose unchanged.

- Step 3 correction: pending landing words now commit at the proven hidden phase of the existing roll path, preventing the old word from landing before a late visible swap.


## Step 4b — Restore proven drop, correct landing only

- Restored the approved full-canvas startup drop from Step 3.
- Removed the cropped per-die snapshot experiment that caused overlays to stack at the top-left.
- The existing stationary Three.js layout is now the sole source for each die's final position, rotation and scale.
- Snapshot capture and real-mesh reveal use the same per-die resting transform.
- The overlay remains for two paint frames after the real mesh is rendered to prevent a visible handoff correction.
- Roll concealment and splash/header logic were not changed.
## v3.6.4 Step 4e — atomic canvas handoff
- Restored Step 4b as the baseline.
- Snapshot dimensions now use the WebGL canvas rectangle rather than the outer scene wrapper.
- Removed the two-frame overlap between the DOM snapshot and the real Three.js die.
- No drop motion, roll behavior, splash, or layout logic was changed.


## v3.6.4 Step 5.4 — presentation pose

- Changed only the existing three-dice resting layout values.
- Moved the middle die slightly forward and made it nearly frontal.
- Moved the outer dice slightly farther back and outward, retained a subtle inward yaw, and reduced roll to almost zero.
- Kept top-face visibility intentionally subtle so the three front faces remain dominant.
- Existing shadows continue to follow the canonical resting positions; their size, material and behavior were not changed.
- No camera, splash, header, startup drop, atomic handoff, Roll, landing animation, timing or engine logic was changed.

## v3.6.4 Step 5.6 — rear-light projected shadows

- Kept the approved Step 5.4.3 dice composition and Step 5.5 baseline unchanged.
- Replaced only the existing compact contact-shadow texture and footprint with a forward-projected shadow for each die.
- Each shadow now starts dark and compact beneath the die, opens slightly toward the viewer, and fades to transparent by roughly 80% of its length.
- The middle shadow projects straight forward; the two rear shadows project subtly outward to match the approved triangular composition.
- Kept the existing landing fade and height-based shadow opacity/scale behavior.
- No changes to dice pose, camera, splash, header, startup drop, Roll, landing, timing, controls, or engine architecture.

## v3.6.4 Step 5.6.1 — contact alignment and side-face reduction

- Kept the approved three-dice positions, pitch, roll, camera and animation engine unchanged.
- Reduced only the mirrored yaw of the two rear dice so their side faces become narrower and less readable while retaining the LEGO-inspired inward grouping.
- Replaced the existing projected-shadow footprint values so the dark contact edge spans the visible base and begins directly beneath the front foot of each die.
- Kept the rear-light direction, forward fade, opacity animation, shadow length and all startup/Roll/landing behavior unchanged.

## v3.6.4 Step 5.7 — Attached Motion Shadows
- Goedgekeurde dobbelsteencompositie volledig behouden.
- Contactschaduw dichter onder de zichtbare voet geplaatst; oude generieke offset vervangen.
- Startup-schaduwen verschijnen pas tijdens de laatste nadering van de val.
- Tijdens Roll volgt iedere schaduw de horizontale beweging en reageert subtiel op de yaw/spin van zijn dobbelsteen.
- Achterlicht-richting, zachte gradient en bestaande landing/roll-engine behouden.

## v3.6.4 Step 5.8 — Wide fan contact shadows
- Replaced the existing narrow shadow texture with one combined contact-bar + wide fan shape.
- Shadows now spread wider and shorter toward the viewer, matching the approved reference sketch.
- Contact edge is tucked slightly beneath each die to remove the visible air gap.
- Shadow plane is rendered safely behind the dice to prevent the centre die from being visually cut off.
- Existing startup fade, roll-follow motion, dice composition, camera and animation engine remain unchanged.

## v3.6.4 Step 5.9 — Shadow-die underside foundation

- Replaced the previous projected fan/blob shadow with one transform-linked underside plate per die.
- The resting shadow now mirrors the die footprint as a soft rounded square directly beneath the die.
- Removed the old projection offset, fan direction, yaw reaction and height-based footprint stretching instead of layering a second system on top.
- The shadow plate follows only horizontal position and yaw while remaining flat on the floor.
- Existing startup/Roll timing hooks are preserved for later dedicated Step 5.10 and Step 5.11 work.
- Dice composition, camera, startup motion, Roll engine, landing and UI were not changed.
## Step 5.9.2 — Rest contact overlap fix

- Reverted the sideways transformed-underside offset that increased the visible gap.
- Rest shadows are centred directly below each die again.
- Increased the underside footprint slightly so the soft shadow overlaps the die silhouette and reads as physical contact.
- Roll, Drop, camera, composition and UI remain unchanged.


## Step 5.9.3 — Shadow footprint 150%

- Increased every resting shadow footprint to 150% of the Step 5.9.2 size.
- Shadow opacity, softness, position, Roll, Drop, camera, composition and UI remain unchanged.

## v3.6.4 Step 5.10 — Grounded Dice
- Increased the visible dice scale to 115% while preserving the approved composition and animation paths.
- Reworked the resting underside shadows into wider, softer oval contact shadows inspired by the approved visual reference.
- Reduced shadow density and increased edge diffusion for a softer ambient-occlusion look.
- Added a very subtle floor light pool beneath the group to establish a readable surface without a visible spotlight.
- No changes to Roll timing, Drop timing, camera, selection logic, deck logic, or UI controls.

## Step 5.10.3 — Safe Dice Overlay Layers
- Reverted the broken per-face `onBeforeRender/clearDepth` approach from Step 5.10.2.
- Restored Step 5.10.1 as the working visual baseline.
- Added a safe two-pass renderer: the complete scene renders normally, then only the middle/main die renders once more after a depth clear.
- Left/right dice remain on the lower visual layer; the middle die stays on the upper visual layer during rest and Roll.
- No changes to roll paths, timing, scale, pose, shadows, header, startup, landing, camera or UI.

## v3.6.4-step-5.10.4 — Desktop proportion parity + menu flow
- Desktop layout now uses the same narrow portrait proportions as the iPhone layout instead of stretching across the browser width.
- Slogan and counter now use the same visual font size on mobile and desktop.
- Counter and all modal typography, including modal headers and choice buttons, now use the same rounded font family as the dice labels.
- Selecting an unlocked Theme now immediately applies the setting and returns to the app.
- Main selections continue to apply immediately and close their menu.
- No changes to startup, landing, Roll, dice render layers, camera, or shadows.

## v3.6.4-step-5.10.13 — Full Set Count Transition
- Replaced the partial “new dice only” selector drop with a full set transition.
- When 1/2/3 changes, the complete current set now rolls downward out of the viewport.
- After the exit completes, the requested full set is rebuilt and enters using the existing approved top-drop sequence.
- Existing subjects are preserved wherever they still fit; changing the count does not trigger a free roll.
- Selector input remains blocked during the transition to prevent overlapping animations.
- Removed the superseded partial count-entry animation function.

- 5.10.14b: softened background gradient for smoother falloff.

## v3.6.4-step-5.10.20 — Main tint visual parity
- Removed the CSS-filtered duplicate used for the Main tint during count drop and fall transitions.
- Drop and fall now use two actual Three.js captures: the normal Main and the exact fully tinted idle Main.
- The two complete captures cross-fade instead of being stacked, preventing the darker die body and blue-shifted lettering.
- Landing handoff now matches the stationary Main tint because both states use the same materials, lighting and overlay.
- No changes to dice motion, timing, layout, shadows, selection behavior or other dice.

## v3.6.4-step-5.10.22 — Strong plasma + opaque fall
- Increased Main Dice Plasma scale, coverage, contrast, speed and glow so the prototype is deliberately easy to judge before scaling back.
- Replaced full-die tint crossfades during drop/fall with a dedicated transparent plasma-only snapshot.
- The solid die now remains fully opaque throughout drop and fall; only the plasma layer fades in/out.

## v3.6.4-step-5.10.23 — Living Plasma continuity + organic flow
- Replaced face-local 2D cellular plasma coordinates with one object-space 3D field.
- Plasma streams now share coordinates across front, side and top faces, so they continue over cube edges.
- Replaced straight cellular borders with domain-warped 3D FBM contour veins for rounded, organic movement.
- Preserved the existing Main lifecycle, opaque fall snapshot, text mask, die animation and layout behavior.

## v3.6.4-step-5.10.24 — White-core plasma
- Restored the die body to neutral white plastic with black lettering.
- Removed the warm beige face tint from the generated die textures.
- Changed the living plasma vein profile to green outer edges with a white-hot centre.
- Kept the existing seamless 3D flow, lifecycle timing, opaque fall and animations unchanged.

## v3.6.4-step-5.10.25 — Airy dual-layer plasma
- Narrowed the primary plasma veins and halos to create more clean white space and remove the blob-like cellular coverage.
- Added a restrained secondary plasma field beneath the primary layer, with a separate object-space offset, scale and motion path for depth.
- Tightened the texture luminance mask around printed subjects and disabled the green scene light so the lettering remains genuinely black.
- Preserved the continuous three-dimensional flow across cube edges and the existing drop / idle / opaque-fall lifecycle.

## v3.6.4-step-5.10.26 — Long plasma currents + definitive black lettering
- Added sparse, curved object-space plasma currents that can span nearly the full die and remain continuous across corners.
- Preserved the airy dual-layer field and its separate secondary motion.
- Removed every selected-Main green text path: all generated and pending dice-face textures now use true black (`#000000`).
- Left lifecycle, drop, idle, opaque fall, layout and other UI behavior unchanged.

## v3.6.4-step-5.10.28 — Wider plasma fields + seamless snapshot handoff

- Rebuilt from v3.6.4-step-5.10.26; the experimental smoke layer is not included.
- Plasma opacity is reduced to 50% of the v5.10.26 strength.
- Enlarged the low-frequency plasma field so open regions span more of each visible face.
- Reduced short-cell density and added a second broad crossing current to distribute energy more evenly across the die.
- Increased plasma animation speed while retaining organic movement.
- Removed plasma fade-in and fade-out: a selected Main carries the effect for its full visible lifetime.
- Drop and fall now use one combined opaque die+plasma snapshot instead of a separate transparent effect image.
- Added a paused local plasma clock during DOM snapshot transitions, so the shader resumes at the exact captured phase without a pattern jump.
- Removed the transparent overlay path that could create a dark veil during fall.
- Dice movement, contact-shadow timing, layout, roll logic and black lettering are unchanged.

## v3.6.4-sidequest-premium-toy-1
- Sidequest visual refinement only; layout and functionality preserved.
- Replaced the flat light lower canvas with a continuous warm charcoal environment.
- Added broad, diffused ambient illumination behind and beneath the dice.
- Refined selector dice into warm polished-resin controls with softer contact depth.
- Refinished Theme, Roll and Main as tactile hardware-like buttons; Roll remains focal.
- Calmed supporting typography and reduced slogan prominence.
- Unified modal surfaces into warm charcoal, softly lit material panels.
- Adjusted Three.js lighting and physical dice material for warmer ceramic/resin rendering.
- Reduced contact-shadow density while preserving all existing shadow timing and animation logic.
- No element positions, dice proportions, controls, menus, roll logic or VFX lifecycle changed.

## Sidequest – internal energy orb restart
- Built directly on the supplied last working premium sidequest baseline.
- Added one shared irregular breathing driver using three non-matching rhythms.
- Added a soft white-green internal orb to the existing object-space plasma shader.
- Linked orb radius, orb brightness, plasma intensity, plasma speed and green ambient glow to the same breathing value.
- Returned the plasma layers almost flush to the die surface so the effect reads beneath the clear resin finish instead of as an outer shell.
- Increased clearcoat modestly for the requested glass/resin read without changing dice geometry, layout or animation paths.
- No blocking preload, compile, decode, bootstrap or splash changes were introduced.

## Sidequest v2.4 — consistent dim Main / 80% orb / external aura / fall handoff
- Main orb radius reduced to 80% of v2.3 (1.012 -> 0.8096).
- Removed the secondary plasma depth layer permanently so the preferred softer/dimmer roll look is now identical in idle, roll, drop and fall.
- Removed the roll-only plasma visibility mode switch; no brightness jump at roll start/end and one less heavy procedural shader pass per frame.
- Added a lightweight external green aura shell using a Fresnel/ripple shader outside the die silhouette. Aura follows the same breath and continuous circular clock as the internal energy.
- Fixed the pre-fall one-frame flash by allowing the full-scene cover and individual data-URL snapshots to reach the compositor before each visibility handoff. No image.decode() dependency added.

## Sidequest v2.5 — softer orb + feathered living aura
- Internal orb visual contribution reduced to roughly 50% of v2.4 while leaving plasma brightness intact.
- Replaced the single hard-edged aura shell with four lightweight expanding shells for a broader feathered falloff.
- Added subtle normal displacement to the aura shells for a soft wavy outline.
- Aura pulse remains tied to the existing shared breath driver and uses continuous travelling/circular phases (no ping-pong reversal).
- No layout, roll timing, drop/fall timing, orb size, or dice positioning changes.
# sidequest v2.32 — clean Main Drop handoff + centered discovery hint

- Prevented the incoming Main snapshot from ever entering the DOM at its idle
  position before the first Drop keyframe.
- Delayed new Main VFX activation until the Drop lifecycle owns the scene.
- Preserved the existing Random die during the automatic 1 → 2 transition.
- Replaced the two-piece discovery arrow with one solid white arrow shape.
- Changed the hint copy to `CHOOSE A MAIN` and centered it in the viewport.
- Kept orb, plasma, aura, counter, composites, timings and other visuals intact.
# sidequest v2.33 — unified ground contact shadows

- Re-enabled the three permanent shadow slots as one universal system for
  Random and selected Main in every 1/2/3-dice composition.
- Rebuilt the footprint as a compact feathered rounded rectangle matching the
  rounded underside of the resin dice.
- Drop now fades each ground contact in as its die approaches the table.
- Idle retains one stable shadow per visible die.
- Fall removes ground contact before the first exit frame.
- Roll keeps the existing height-responsive shadow behaviour.
- Dice, Main VFX, composites, positions and motion timings are unchanged.
# sidequest v2.34 — canonical Ground Contact composites

- Replaced each single floating shadow plane with one permanent Ground Contact
  group containing a rounded underside core and a separate soft feather.
- Anchored every contact group to the canonical idle pose rather than the
  animated die transform.
- Calculated the fixed contact height from each RoundedBoxGeometry pose so the
  dense core joins the actual lowest rounded edge without a visible air gap.
- Offset only the soft feather toward the camera so the forward Main keeps the
  same readable grounding as the support dice.
- Drop only fades the fixed contact group in; Fall removes it immediately.
- Resin, orb, plasma, aura, composites, controls and all motion timings remain
  unchanged.
# sidequest v2.35 — larger visible Ground Contact

- Enlarged the actual rounded contact core beyond the dice underside.
- Expanded the visible feather footprint instead of only scaling its
  transparent canvas margins.
- Increased contact density while retaining a soft outer falloff.
- Added canonical camera-depth compensation so forward dice expose more
  feather without special-casing Main or changing any dice position.
- Moved the Main Ground Contact into the same foreground render pass as its
  resin/aura, preventing the aura pass from washing the shadow away.
- No resin, VFX, composite, control or animation timing changes.
# sidequest v2.36 — overhead projected Roll shadows

- Established one permanent dice-light rule: directional illumination is
  centred exactly above the dice composition.
- Replaced the fixed rounded contact core with a downward projection of all
  eight corners of the live 3D die.
- The projected convex footprint now changes continuously with Roll rotation,
  squash and horizontal travel while remaining on the ground plane.
- Idle uses the canonical pose and Drop fades that landing footprint in.
- Fall still removes the shadow before the exit starts.
- A larger soft feather is rebuilt around every projected silhouette.
- Main and support shadows use the same projection and foreground rules.
- Orb, plasma, aura, dice composites, controls and motion timings are unchanged.
# v2.38 — Main shadow visibility state fix

- Fixed the actual Main-shadow persistence bug in the two-pass compositor.
- Shadow visibility is now captured before the Main is temporarily hidden for
  the rear render pass.
- The compositor therefore restores the real Main-shadow state after every
  frame instead of permanently restoring `false`.
- This keeps the same shadow visible in Drop, Idle, Roll and the opening of
  Fall; the existing fast Fall fade remains unchanged.
- No VFX, dice, layout, timing, control or material settings were changed.

# v2.37 — Main shadow full lifecycle

- Made the selected Main's fixed ground-contact footprint visibly extend beyond
  the resin/aura silhouette during Drop and Idle.
- Kept the existing live, orientation-driven shadow behaviour during Roll.
- Added a dedicated 150 ms Fall release so the existing contact is visible on
  the first Fall frame and then disappears almost immediately.
- Drop still fades the permanent ground-contact shadow into its canonical idle
  position; no snapshot shadow or second shadow system was added.
- Orb, plasma, aura, dice materials, composites, controls and animation timings
  are unchanged.
# V0.2.54 — Canon manager

- Added the isolated, PIN-protected `/canon/` internal mobile curation route.
- Seeded all 86 Classic subjects from `Tattoo_Dice_Classic_Deck_Rating_v2_Multi_Slot.xlsx`.
- Added Dog as a separate subject with Wolf's exact score, weight, slots, themes, family, possibilities and known Moon relation.
- Kept subject input to seven groups: Identity, Themes, Dice, Score, Family, Possibilities and Knowledge.
- Added immediate local autosave and optional cross-device Supabase synchronization.
- Added safe full-canon backup import/export and Admin ranking/highlight CSV import.
- Added isolated per-theme runtime JSON export so paid decks do not need to ship together in a future app binary.
- Added targeted testing for new, changed and removed subjects instead of restarting the full ranking run.
- Left the public root, public deck files, Generator, Admin Ranking, dice animations and existing storage untouched.
