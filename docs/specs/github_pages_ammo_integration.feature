Feature: SpaceBall GitHub Pages Ammo Integration
  The SpaceBall web game must run fully client-side using Babylon.js physics on GitHub Pages.
  Since GitHub Pages cannot perform npm builds or module bundling, the game must load Ammo.js
  via a static <script> tag instead of dynamic import() or ESM syntax.

  Background:
    Given the site is hosted on GitHub Pages and serves only static files
    And the Babylon.js physics system requires Ammo.js to be loaded before enabling physics
    And dynamic import of "ammojs-typed" fails because its build is not an ES module

  Scenario: Correct static Ammo integration
    Given the index.html file is edited to include Ammo before the main game script
    When the developer adds the following lines near the end of <body>:
      """
      <script src="https://cdn.babylonjs.com/ammo.js"></script>
      <script src="src/main.js"></script>
      """
    Then the global Ammo factory should be available to main.js as a browser global
    And Babylon’s AmmoJSPlugin can initialize physics successfully

  Scenario: Updated physics initialization in main.js
    Given the physics engine must be initialized after Ammo is loaded
    When the script executes
    Then the following initialization pattern should be used:
      """
      const ammo = await Ammo(); // global function from script include
      const plugin = new BABYLON.AmmoJSPlugin(true, ammo);
      scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), plugin);
      """
    And any previous dynamic import code such as loadAmmoModule() should be removed or commented out

  Scenario: Optional local Ammo hosting
    Given the developer prefers a self-contained repository
    When the developer downloads ammo.js from https://cdn.babylonjs.com/ammo.js
    And places it at lib/ammo.js in the repository
    Then the index.html reference should change to:
      """
      <script src="lib/ammo.js"></script>
      <script src="src/main.js"></script>
      """
    And GitHub Pages should serve it directly without dependency on external CDNs

  Scenario: Expected outcome
    Given Ammo.js is loaded before main.js
    Then Babylon.js should report physics ready in the console
    And the ball should fall, roll, and behave correctly according to the rod positions
    And the game should no longer crash or freeze on load
