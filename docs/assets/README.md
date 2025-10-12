# Space Ball Asset Catalogue

Store shared reference imagery and concept sketches in this directory so they can be linked from the behavioural specs.

## Current references
- `space_ball_sketch.png` – overall board layout used by `docs/specs/core_gameplay.feature`.
- `thumb_control_sketch.png` – left/right thumb interaction used by `docs/specs/touch_controls.feature`.

## Adding a New Visual Reference
- Save the asset using a descriptive snake_case filename (for example, `space_ball_sketch.png`).
- Commit binary images directly to the repository; avoid external links so the specs remain self-contained.
- Reference the asset path from the relevant `.feature` file using a comment or Background note to make the association explicit.
