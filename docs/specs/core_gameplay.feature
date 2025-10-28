Feature: Core Space Ball gameplay loop
  # Visual reference: docs/assets/space_ball_sketch.png (see docs/design_reference.md for context)
  As a mobile player
  I want the ball to react predictably to the rail spacing
  So that I can intentionally guide it toward the scoring zone

  Background:
    Given the Space Ball game is loaded on a mobile device in portrait mode
    And a metal ball rests at the apex between two slightly tilted rails

  Scenario: Ball stays parked when the rails match
    When the player keeps both rails aligned and stationary
    Then the ball should remain balanced at the apex without sliding

  Scenario: Ball speeds up while the rails open
    When the player widens the gap between the rails gradually
    Then the ball should move downward along the rails in the X-Y plane because of gravity
    And the ball's speed should increase smoothly as it descends

  Scenario: Ball climbs back when the rails close
    Given the ball has started descending between the rails
    When the player narrows the gap until the rails nearly touch
    Then the ball should slow down as the rails close
    And once the ball loses forward speed it should reverse direction
    And the ball should travel upward to its resting position at the apex because the upper section of the rails sits slightly lower than the base

  Scenario: Ball scores after exiting the rails
    Given the player has widened the rails enough for the ball to reach the base
    When the gap becomes wider than the ball's diameter at the exit point
    Then the ball should fall straight down along the Z axis into the scoring zone below the rails
    And the player's score should increase by one
    And the ball should reset to the apex for the next attempt within two seconds

  Scenario: Scoring pockets descend beneath the rail exit
    When the scoring pockets are visible under the rails
    Then each pocket should sit lower than the one above it
    And Pluto should be the lowest and widest target
