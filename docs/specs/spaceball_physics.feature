Feature: Realistic rod-ball mechanical physics
  The Babylon.js simulation reproduces the authentic Space Ball toy behaviour:
  a steel ball perched on two controllable rods slides downward under gravity,
  gains kinetic energy as the rods open, and eventually drops if the separation
  exceeds the ball's diameter.

  Background:
    Given a steel ball of mass 0.18 kilograms and diameter 0.038 meters
    And two rods form a V-shaped cradle with controllable separation distance
    And the rods are aligned along the Y axis with the ball's downward travel measured along Y

  Scenario: Ball remains supported when rods are closed and level
    Given the rod separation is 0.030 meters (less than the ball diameter)
    And the rods are level with zero slope
    When the simulation advances for 3 seconds with gravity enabled
    Then the ball should remain in static equilibrium without translating along the Y axis
    And its vertical position should not change by more than 0.001 meters

  Scenario Outline: Opening rods induces downhill motion from geometric drop
    Given the rods are opened to a separation of <separation> meters at the front and 0.030 meters at the back
    And each rod is modelled as a kinematic PhysicsShapeCylinder aligned with the Y axis
    When the simulation runs with gravity for 2 seconds at a 240 Hz physics timestep and 480 Hz substep
    Then the ball should translate downward along Y by at least <min_descent> meters
    And the ball's kinetic energy should increase relative to the starting frame

    Examples:
      | separation | min_descent |
      | 0.032      | 0.015       |
      | 0.034      | 0.028       |
      | 0.036      | 0.045       |

  Scenario: Closing rods mid-descent increases friction but preserves inertia
    Given the rods are opened to 0.035 meters allowing the ball to accelerate for 1 second
    When the rods are closed back to 0.031 meters over 0.4 seconds while the simulation continues
    Then the ball's linear speed along Y should decrease by at least 25 percent during closure
    And the ball should continue moving downward along Y without reversing direction

  Scenario: Excessive opening causes the ball to drop through the rods
    Given the rods are opened uniformly to 0.040 meters (greater than the ball diameter)
    When the simulation advances for up to 1.5 seconds
    Then the ball's center should fall below the rod plane, indicating a drop event
    And the drop event should record the ball's Y position for scoring

  Scenario: Physics integration settings for smooth motion
    Given the Babylon.js scene uses a physics engine plugin compatible with setTimeStep
    When the simulation initialises the physics engine
    Then `scene.getPhysicsEngine().setTimeStep(1/240)` should be applied
    And `physicsPlugin.setSubTimeStep(1/480)` should be applied for solver accuracy
    And rod impostors should remain kinematic so player inputs directly control their separation

  Scenario: Scoring and telemetry when the ball drops
    Given the simulation tracks the ball's cumulative Y displacement from its starting position
    When the drop event triggers because the ball's center falls below the rod plane
    Then the score should equal the total Y displacement travelled before the drop
    And the event payload should include the final separation distance of the rods
