Feature: SpaceBall visual loading status bar
  The SpaceBall web game must display a persistent status bar at the top of the page,
  indicating real-time progress through each initialization stage. This is used for debugging
  and user feedback so that the team can identify where the game fails to initialize.

  Background:
    Given the game currently starts silently
    And the developer needs visibility into each step (Ammo load, Babylon setup, physics ready)
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
      const status = document.getElementById('status-bar');
      function setStatus(text) {
          if (status) status.textContent = text;
          console.log(text);
      }

      setStatus('Loading Ammo.js...');
      await new Promise(r => setTimeout(r, 100)); // allow UI update
      await Ammo();
      setStatus('Ammo loaded');

      setStatus('Initializing Babylon engine...');
      const engine = new BABYLON.Engine(canvas, true);
      const scene = new BABYLON.Scene(engine);
      setStatus('Babylon engine ready');

      setStatus('Initializing physics...');
      const plugin = new BABYLON.AmmoJSPlugin(true, Ammo);
      scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), plugin);
      setStatus('Physics enabled');

      setStatus('Creating scene objects...');
      createBallAndRails(scene);
      setStatus('Scene objects created');

      setStatus('Ready ✔');
      """

  Scenario: Handle failure gracefully
    Given any step throws an error
    When an exception occurs
    Then the status bar should display the message in red text:
      """
      catch (err) {
          if (status) {
              status.style.background = 'darkred';
              status.textContent = '❌ ' + (err.message || 'Initialization failed');
          }
          console.error(err);
      }
      """

  Expected outcome:
    Given the page reloads
    Then the top bar should show "Initializing...", then step-by-step messages as each part loads
    And if the game freezes or crashes, the last message indicates exactly which stage failed
