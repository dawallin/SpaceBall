Feature: Dual-rail touch controls
  # Visual reference: docs/assets/thumb_control_sketch.png (see docs/design_reference.md for context)
  As a mobile player using both thumbs
  I want dedicated left and right touch zones
  So that I can independently move each rail to guide the ball

  Background:
    Given the device is held in portrait orientation
    And two touch pads are visible along the bottom edge of the screen
    And the left pad is mapped to the left rail while the right pad is mapped to the right rail

  Scenario: Moving the left rail with the left thumb
    When the player drags their left thumb horizontally within the left pad
    Then the left rail should follow the thumb movement along the horizontal axis
    And the right rail should remain unaffected

  Scenario: Moving the right rail with the right thumb
    When the player drags their right thumb horizontally within the right pad
    Then the right rail should follow the thumb movement along the horizontal axis
    And the left rail should remain unaffected

  Scenario: Visual feedback for active touch zones
    When the player presses either touch pad
    Then the active pad should display visual feedback indicating engagement
    And the feedback should disappear when the touch ends
