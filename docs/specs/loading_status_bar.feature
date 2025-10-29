Feature: SpaceBall visual loading status bar
  The SpaceBall web game must display a persistent status bar at the top of the page,
  indicating real-time progress through each initialization stage. This is used for debugging
  and user feedback so that the team can identify where the game fails to initialize.

  Background:
    Given the game currently starts silently
    And the developer needs visibility into each step (Havok load, Babylon setup, physics ready)
    Then a simple HTML progress or text status bar should be shown at the top of the page

  Scenario: Add status bar container
    Given index.html is updated
    When the body tag loads
    Then a new element should be present before the main canvas:
      """
      <div id="status-bar" style="
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 24px;
          background: linear-gradient(to right, #003366, #0066cc);
          color: white;
          font-family: monospace;
          font-size: 14px;
          line-height: 24px;
          padding-left: 8px;
          z-index: 9999;
      ">Initializing...</div>
      """

  Scenario: Update status text during loading
    Given main.js runs the game setup
    When each stage starts or completes
    Then the code should update the status text accordingly, for example:
      """
      const statusBar = document.getElementById('status-bar');
      function setStatus(text, color) {
          if (!statusBar) return;
          statusBar.textContent = text;
          if (color) statusBar.style.background = color;
          console.log('[SpaceBall]', text);
      }

      try {
          setStatus('Loading Babylon & Havok...');
          if (!window.BABYLON || !window.HavokPhysics) {
              throw new Error('Required globals missing');
          }

          setStatus('Creating Babylon engine...');
          const engine = new BABYLON.Engine(canvas, true);
          const scene = new BABYLON.Scene(engine);
          setStatus('Babylon engine ready');

          setStatus('Enabling physics...');
          const plugin = new BABYLON.HavokPlugin(true, await HavokPhysics());
          scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), plugin);
          setStatus('Havok physics enabled ✔');

          setStatus('Creating game objects...');
          await createSceneObjects(scene);
          setStatus('Scene ready ✔', 'green');
      } catch (err) {
          setStatus('❌ Initialization failed: ' + (err.message || err), 'darkred');
          console.error(err);
      }
      """

  Scenario: Handle failure gracefully
    Given any step throws an error
    When an exception occurs
    Then the status bar background should switch to red while showing the failure message

  Expected outcome:
    Given the page reloads
    Then the top bar should animate through "Loading Babylon & Havok", "Creating Babylon engine", "Enabling physics", and finish with "Havok physics enabled ✔" followed by "Scene ready ✔"
    And if the game freezes or crashes, the final visible message must show which stage failed
