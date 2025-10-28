Feature: Camera perspective tuning
  As a player who wants to evaluate different play angles
  I want immediate access to orbit, pitch, and zoom controls
  So that I can dial in a camera view that suits my play style

  Background:
    Given the Space Ball interface has loaded
    And the control panel is visible alongside the playfield

  Scenario: Camera sliders are visible by default
    Then I should see labelled sliders for Orbit, Pitch, and Zoom under the Camera heading
    And each slider should show its current value next to the label

  Scenario: Updating camera values via sliders
    When I adjust any of the Orbit, Pitch, or Zoom sliders
    Then the corresponding value readout should update to reflect the new setting
