# Space Ball Asset Catalogue

Store shared reference imagery and concept sketches in this directory so they can be linked from the behavioural specs.

## Current references
- `space_ball_sketch.png` – overall board layout used by `docs/specs/core_gameplay.feature`.
- `thumb_control_sketch.png` – left/right thumb interaction used by `docs/specs/touch_controls.feature`.
- `spaceball_state_starting_position.jpeg` – neutral orbital position before propulsion, referenced by `docs/specs/spaceball_physics.feature`.
- `spaceball_state_goal_capture.jpeg` – capture-phase energy transfer, referenced by `docs/specs/spaceball_physics.feature`.
- `game_board_top_wall_coordinates.jpeg` – coordinate map for the game board floor and opposing top wall.
- `launch_rod_angle_diagram.jpeg` – launcher rod length and angle constraints for the propulsion mechanic.
- `scoring_board_planet_targets.jpeg` – scoring lane targets labelled with planetary theming.
- `rod_tilt_distance_diagram.jpeg` – rod spacing and tilt variance visual for rotational alignment.

## Adding a New Visual Reference
- Save the asset using a descriptive snake_case filename (for example, `space_ball_sketch.png`).
- Commit binary images directly to the repository; avoid external links so the specs remain self-contained.
- Reference the asset path from the relevant `.feature` file using a comment or Background note to make the association explicit.
