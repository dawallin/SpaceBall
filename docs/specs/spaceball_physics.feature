Feature: SpaceBall orbital physics model
  The mechanical SpaceBall toy is reimagined with orbital mechanics, requiring precise force pulses
  and magnetically assisted capture to deliver deterministic skill-based gameplay.
  # Visual references
  # - Neutral drift: docs/assets/spaceball_state_starting_position.jpeg
  # - Capture phase: docs/assets/spaceball_state_goal_capture.jpeg

  Background:
    Given the neutral drift diagram is available at "docs/assets/spaceball_state_starting_position.jpeg"
    And the capture phase diagram is available at "docs/assets/spaceball_state_goal_capture.jpeg"

  Scenario: Neutral drift remains stable without input
    Given the spaceball mass is 0.18 kilograms
    And the orbital lane curvature keeps centripetal acceleration under 0.4 meters per second squared
    When no thrust impulse is applied for 5 seconds
    Then the ball should maintain a tangential velocity between 0.45 and 0.55 meters per second
    And the radial offset from the lane midline should stay within 0.02 meters

  Scenario Outline: Pulse thrusters adjust tangential velocity predictably
    Given the pilot applies a thrust pulse lasting <duration> milliseconds
    And the thruster delivers 0.9 newtons of force while active
    When the simulation integrates the pulse over the timestep
    Then the tangential velocity should change by <delta_v> meters per second
    And the cumulative kinetic energy delta must match within 5 percent of 1/2 * m * (delta_v^2)

    Examples:
      | duration | delta_v |
      | 050      | 0.25    |
      | 100      | 0.50    |
      | 150      | 0.75    |

  Scenario: Magnetic gate captures the ball when residual speed is low
    Given the capture gate applies a magnetic braking field of 1.2 newtons opposite travel direction
    And the capture zone is 0.3 meters long
    When the ball enters the capture zone below 0.6 meters per second
    Then the ball should decelerate to a stop before exiting the zone
    And the kinetic energy dissipated should be logged for scoring feedback

  Scenario: Bounce response when the ball strikes the gate too fast
    Given the ball approaches the capture gate at 0.9 meters per second
    And the gate collision coefficient of restitution is 0.35
    When the ball impacts the gate plating
    Then the post-collision speed should resolve to approximately 0.32 meters per second in the opposite direction
    And the rebound vector should align within 3 degrees of the incoming trajectory mirrored across the gate normal

  Scenario: JavaScript implementation guidelines
    Given the simulation runs inside a `SpaceballSimulation` module under `src/physics/`
    And the update loop uses a fixed 120 Hz tick with semi-implicit Euler integration
    When thrust inputs are received from the control layer
    Then the module should update velocity and position vectors using SI units (meters, seconds, kilograms)
    And it should expose collision events so the UI can trigger capture effects

  Scenario: Physics framework recommendations for the web client
    Given the team needs rigid body dynamics with constraint solving and collision detection
    When selecting supporting libraries for the Babylon.js scene graph mandated by the project
    Then prefer integrating `cannon-es` through the Babylon.js physics plugin for lightweight rigid bodies
    And consider `ammo.js` when higher stability is required for stacked interactions
    And prototype impulse-only behaviour with the built-in Babylon.js `PhysicsImpostor` before adding external engines
