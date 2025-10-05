Feature: Adjustable rail tilt configuration
  As a player exploring different difficulty levels
  I want to adjust the tilt of the rails via an on-screen slider
  So that I can control how quickly the ball accelerates

  Background:
    Given a vertical slider control is positioned along the right edge of the screen
    And the slider value ranges from a gentle incline to a steep incline
    And the current tilt value is displayed numerically next to the slider

  Scenario: Updating tilt via the slider
    When the player drags the slider thumb upward
    Then the tilt angle should increase proportionally within the allowed range
    And the rails should visually reflect the updated tilt in real time

  Scenario: Persisting tilt across ball resets
    Given the player has selected a custom tilt value
    When the ball resets after scoring or falling off the rails
    Then the previously selected tilt value should remain active

  Scenario: Default tilt on first load
    When the game is loaded for the first time
    Then the tilt slider should start at the recommended default angle
    And the rails should use that default tilt until the player changes it
