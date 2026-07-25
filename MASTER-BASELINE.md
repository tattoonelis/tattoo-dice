# Frozen master baseline

All future work starts from this directory.

Rules:

1. Modify existing files locally; do not rebuild the app from scratch.
2. Preserve unrelated behavior and styling.
3. Remove replaced or unused code rather than stacking parallel systems.
4. Record every change in `CHANGELOG.md`.
5. Validate startup and JavaScript syntax before packaging.
6. Every current and future dice uses directional light centred exactly above
   the dice composition. Ground shadows project straight down from that shared
   source and derive their shape from the live 3D dice orientation.
7. Ground Contact lifecycle and projection remain owned by the permanent
   Three.js shadow slots. Their visible pixels are drawn on the persistent
   transparent layer between the background and WebGL dice, allowing the
   feather to cross the dice-stage edge while remaining behind dice and
   controls.
