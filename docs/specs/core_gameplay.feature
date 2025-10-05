Feature: Core Space Ball gameplay loop
  As a mobile player
  I want the ball to respond to gravity and rail spacing
  So that I can control its descent and score points by dropping it intentionally

  Background:
    Given the Space Ball game is loaded on a mobile device in portrait mode
    And a metal ball rests at the top apex between two rails with a configurable tilt

  Scenario: Ball remains at the apex when rails are aligned
    When the player keeps both rails aligned and stationary
    Then the ball should remain balanced at the apex without sliding

  Scenario: Ball accelerates downward when rails separate
    When the player widens the gap between the rails gradually
    Then the ball should move downward along the rails due to gravity
    And the ball's velocity should increase smoothly as it descends

  Scenario: Scoring when the ball exits the rails at the base
    Given the player has widened the rails enough for the ball to reach the base
    When the gap becomes wider than the ball's diameter at the exit point
    Then the ball should fall through the opening into the scoring zone
    And the player's score should increase by one
    And the ball should reset to the apex for the next attempt within two seconds
