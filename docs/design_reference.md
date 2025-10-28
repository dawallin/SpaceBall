# Space Ball Design Reference

Two companion sketches illustrate the intended feel of the prototype:

- **Gameplay layout** – `docs/assets/space_ball_sketch.png`
  - Mercury, Earth, Mars, Jupiter, Saturn, and Pluto scoring pockets stack vertically on the centerline beneath the apex of the rails so that each pocket sits directly under the chute.
  - Score values increase as the ball drops lower, with Pluto representing the highest-value goal at the bottom center.
  - The player's thumbs pinch the rails near the base, reinforcing the touch-control scenarios described in `docs/specs/touch_controls.feature`.
- **Thumb controls** – `docs/assets/thumb_control_sketch.png`
  - Depicts how each thumb rests on an independent touch pad.
  - Highlights the expectation that horizontal thumb movement directly drives the corresponding rail.

Reference the appropriate asset from the relevant `.feature` file so future contributors understand the intended arrangement and control scheme before implementing gameplay updates.
