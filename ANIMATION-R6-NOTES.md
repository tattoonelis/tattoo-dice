# Animation r6

- Splash slogan removed; it appears only in the real app header.
- Splash logo clone is painted before the source logo is hidden to avoid a black frame.
- Header endpoint is measured from the real header title for an exact size and position match.
- Opening/theme/main drops run strictly left, then right, then middle with no overlap.
- Each die begins above the top edge of the device and falls vertically.
- Full-screen renderer FOV is compensated so dice keep their normal visual size.
- Drop animation never scales the mesh, preventing morphing.
- One small vertical landing bounce; no spin or correction after landing.
- Contact shadow stays absent in the air and fades in near landing.
