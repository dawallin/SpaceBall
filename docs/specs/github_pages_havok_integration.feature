Feature: SpaceBall GitHub Pages Havok Integration
  The SpaceBall web game must run fully client-side using Babylon.js Physics V2 on GitHub Pages.
  Since GitHub Pages cannot perform npm builds or module bundling, the game must load HavokPhysics
  via static <script> tags instead of dynamic import() or ESM syntax.

  Background:
    Given the site is hosted on GitHub Pages and serves only static files
    And Babylon.js 7 requires the Havok physics plugin for the Physics V2 architecture
    And the HavokPhysics UMD bundle exposes a global HavokPhysics() factory when loaded

  Scenario: Correct static Havok integration
    Given the index.html file is edited to include Babylon.js and Havok before the main game script
    When the developer adds the following block near the end of <body>:
      """
      <!-- Load Babylon.js and Havok for Physics V2 -->
      <script src="https://cdn.babylonjs.com/babylon.js"></script>
      <script src="https://cdn.babylonjs.com/havok/HavokPhysics_umd.js"></script>
      <script>
        (function waitForHavok() {
          if (window.BABYLON && window.HavokPhysics) {
            const s = document.createElement('script');
            s.src = 'src/main.js?v=' + Date.now();
            document.body.appendChild(s);
          } else {
            setTimeout(waitForHavok, 100);
          }
        })();
      </script>
      """
    Then the global HavokPhysics factory should be available to main.js as a browser global
    And Babylon’s HavokPlugin can initialize physics successfully

  Scenario: Updated physics initialization in main.js
    Given the physics engine must be initialized after HavokPhysics is available
    When the script executes
    Then the following initialization pattern should be used:
      """
      const havokInstance = await HavokPhysics();
      const plugin = new BABYLON.HavokPlugin(true, havokInstance);
      scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), plugin);
      """
    And any previous AmmoJSPlugin usage should be removed or commented out

  Scenario: Optional local Havok hosting
    Given the developer prefers a self-contained repository
    When the developer downloads HavokPhysics_umd.js from https://cdn.babylonjs.com/havok/HavokPhysics_umd.js
    And places it at lib/HavokPhysics_umd.js in the repository
    Then the index.html reference should change to:
      """
      <script src="lib/HavokPhysics_umd.js"></script>
      <script src="src/main.js"></script>
      """
    And GitHub Pages should serve it directly without dependency on external CDNs

  Scenario: Expected outcome
    Given HavokPhysics_umd.js is loaded before main.js executes
    Then Babylon.js should report that Havok physics is enabled in the console
    And the status bar should progress to "Havok physics enabled ✔"
    And the ball should fall, roll, and behave correctly according to the rod positions
    And the game should no longer crash or freeze on load
