// === Loader/Debug utilities ===
const statusEl = document.getElementById('status-bar');
const dbgEl = document.getElementById('debug-panel');
const url = new URL(location.href);
const DEBUG_MODE = url.searchParams.has('debug') || false;

// in-memory log of steps
const loadLog = [];
let lastUpdateTs = performance.now();

function logLine(text) {
  const ts = (performance.now() / 1000).toFixed(3);
  const line = `[${ts}s] ${text}`;
  loadLog.push(line);
  console.log('[SpaceBall]', text);
  if (DEBUG_MODE && dbgEl) {
    dbgEl.style.display = 'block';
    const div = document.createElement('div');
    div.textContent = line;
    dbgEl.appendChild(div);
  }
}

function setStatus(text, color) {
  lastUpdateTs = performance.now();
  if (statusEl) {
    statusEl.textContent = text;
    if (color) statusEl.style.background = color;
    statusEl.title = loadLog.slice(-10).join('\n');
  }
  logLine(text);
}

async function step(name, fn, colorWorking = '#0066cc', colorDone = '#118833') {
  const t0 = performance.now();
  setStatus(`${name}…`, colorWorking);
  try {
    const result = await fn();
    const dt = (performance.now() - t0).toFixed(1);
    setStatus(`${name} ✔ (${dt} ms)`, colorDone);
    return result;
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    const dt = (performance.now() - t0).toFixed(1);
    setStatus(`❌ ${name} failed (${dt} ms): ${msg}`, 'darkred');
    logLine(`STACK: ${err && err.stack ? err.stack : '(no stack)'}`);
    throw err;
  }
}

window.addEventListener('error', (e) => {
  setStatus(`❌ Error: ${e.message}`, 'darkred');
  logLine(`ERROR SRC: ${e.filename}:${e.lineno}:${e.colno}`);
});
window.addEventListener('unhandledrejection', (e) => {
  setStatus(`❌ Unhandled rejection: ${e.reason}`, 'darkred');
  logLine(`REJECTION: ${e.reason}`);
});

setInterval(() => {
  const delta = performance.now() - lastUpdateTs;
  if (delta > 3000 && statusEl) {
    statusEl.style.background = '#cc9900';
    if (!statusEl.textContent.includes('(still working)')) {
      setStatus(`${statusEl.textContent} (still working)`, '#cc9900');
    }
  }
}, 1500);

logLine(`UA: ${navigator.userAgent}`);
logLine(`Online: ${navigator.onLine}`);
logLine(`Location: ${location.href}`);
logLine(`ReadyState: ${document.readyState}`);

let clamp;
let normalizedToOffset;
let sliderValueToTilt;
let getRailX;
let createPocketLayouts;

const canvas = document.getElementById('playfield');
const tiltSlider = document.getElementById('tiltSlider');
const tiltReadout = document.getElementById('tiltReadout');
const scoreValue = document.getElementById('scoreValue');
const leftPad = document.getElementById('leftPad');
const rightPad = document.getElementById('rightPad');
const cameraAlphaSlider = document.getElementById('cameraAlphaSlider');
const cameraBetaSlider = document.getElementById('cameraBetaSlider');
const cameraZoomSlider = document.getElementById('cameraZoomSlider');
const cameraAlphaReadout = document.getElementById('cameraAlphaReadout');
const cameraBetaReadout = document.getElementById('cameraBetaReadout');
const cameraZoomReadout = document.getElementById('cameraZoomReadout');

const tiltBounds = {
  min: 8,
  max: 28,
};

const geometry = {
  centerX: 0,
  topY: 0.28,
  bottomY: -0.62,
  ballRadius: 0.019,
  railTopSpread: 0.032,
  railBottomSpread: 0.082,
  railTravel: 0.028,
  railRadius: 0.006,
  railDropLength: 0.22,
  gravityBase: 9.81,
  dropStartZ: 0,
  dropFloorZ: -0.32,
  dropPlaneZ: -0.004,
  pocketRadius: 0.014,
};

const state = {
  score: 0,
  tilt: 0,
  leftOffset: 0,
  rightOffset: 0,
  leftPointer: null,
  rightPointer: null,
};

function degToRad(degrees) {
  return (Number(degrees) * Math.PI) / 180;
}

(async function bootstrap() {
  try {
    await step('Verify Babylon global', async () => {
      if (!window.BABYLON) {
        throw new Error('BABYLON global missing (babylon.js not loaded)');
      }
    });

    const controlModule = await step('Load control-logic module', async () => import('./control-logic.js'));
    ({ clamp, normalizedToOffset, sliderValueToTilt, getRailX, createPocketLayouts } = controlModule);

    await step('Initialize UI controls', async () => {
      if (!tiltSlider || !tiltReadout) {
        throw new Error('Tilt controls missing');
      }
      state.tilt = sliderValueToTilt(tiltSlider.value ?? 0, tiltBounds);
      tiltReadout.textContent = `${Math.round(state.tilt)}°`;
      tiltSlider.setAttribute('aria-valuenow', tiltSlider.value);
    });

    const ammoModule = await step('Load Ammo.js', async () => {
      if (typeof window.Ammo === 'function') {
        return await window.Ammo();
      }
      if (typeof window.Ammo === 'object') {
        return window.Ammo;
      }
      throw new Error('Ammo global not found (ammo.js failed to load)');
    });

    const {
      Engine,
      Scene,
      Vector3,
      Quaternion,
      ArcRotateCamera,
      HemisphericLight,
      MeshBuilder,
      Color3,
      Color4,
      StandardMaterial,
      TransformNode,
      PhysicsAggregate,
      PhysicsMaterial,
      PhysicsMotionType,
      PhysicsShapeType,
      AmmoJSPlugin,
    } = BABYLON;

    await step('Verify playfield canvas', async () => {
      if (!canvas) {
        throw new Error('Playfield canvas element not found');
      }
    });

    const engine = await step('Create Babylon engine', async () =>
      new Engine(canvas, true, {
        alpha: true,
        preserveDrawingBuffer: true,
        stencil: true,
        disableWebGL2Support: false,
      })
    );

    const scene = await step('Create scene', async () => {
      const scn = new Scene(engine);
      scn.clearColor = new Color4(0, 0, 0, 0);
      return scn;
    });

    const betaLimitPadding = 0.01;
    let safeLowerBetaDeg = 0;
    let safeUpperBetaDeg = 0;

    const camera = await step('Create camera', async () => {
      if (!cameraAlphaSlider || !cameraBetaSlider || !cameraZoomSlider) {
        throw new Error('Camera controls missing');
      }
      const betaRange = {
        min: Number(cameraBetaSlider.min ?? 0),
        max: Number(cameraBetaSlider.max ?? 360),
      };
      safeLowerBetaDeg = Math.min(betaRange.min + betaLimitPadding, betaRange.max - betaLimitPadding);
      safeUpperBetaDeg = Math.max(betaRange.min + betaLimitPadding, betaRange.max - betaLimitPadding);
      const initialBetaDegrees = clamp(
        Number(cameraBetaSlider.value ?? 60) || 0,
        safeLowerBetaDeg,
        safeUpperBetaDeg
      );
      const cam = new ArcRotateCamera(
        'camera',
        degToRad(cameraAlphaSlider.value ?? 20),
        degToRad(initialBetaDegrees),
        Number(cameraZoomSlider.value ?? 1.2),
        new Vector3(0, -0.05, -0.35),
        scene
      );
      cam.lowerRadiusLimit = Number(cameraZoomSlider.min ?? 0.6);
      cam.upperRadiusLimit = Number(cameraZoomSlider.max ?? 2.4);
      cam.lowerBetaLimit = degToRad(safeLowerBetaDeg);
      cam.upperBetaLimit = degToRad(safeUpperBetaDeg);
      cam.wheelPrecision = 120;
      cam.panningSensibility = 0;
      cam.attachControl(canvas, false);
      cam.inputs.clear();
      return cam;
    });

    function applyCameraSettings() {
      if (!cameraAlphaSlider || !cameraBetaSlider || !cameraZoomSlider) {
        return;
      }
      const alphaDeg = clamp(Number(cameraAlphaSlider.value) || 0, 0, 360);
      const betaMin = Number(cameraBetaSlider.min) || 0;
      const betaMax = Number(cameraBetaSlider.max) || 360;
      const betaDeg = clamp(Number(cameraBetaSlider.value) || 0, betaMin, betaMax);
      const safeBetaLower = Math.min(betaMin + betaLimitPadding, betaMax - betaLimitPadding);
      const safeBetaUpper = Math.max(betaMin + betaLimitPadding, betaMax - betaLimitPadding);
      const safeBetaDeg = clamp(betaDeg, safeBetaLower, safeBetaUpper);
      const zoom = clamp(
        Number(cameraZoomSlider.value) || 0,
        Number(cameraZoomSlider.min) || 0.6,
        Number(cameraZoomSlider.max) || 2.4
      );

      camera.alpha = degToRad(alphaDeg);
      camera.beta = degToRad(safeBetaDeg);
      camera.radius = zoom;

      if (cameraAlphaReadout) {
        cameraAlphaReadout.textContent = `${Math.round(alphaDeg)}°`;
      }
      if (cameraBetaReadout) {
        cameraBetaReadout.textContent = `${Math.round(betaDeg)}°`;
      }
      if (cameraZoomReadout) {
        cameraZoomReadout.textContent = zoom.toFixed(2);
      }

      cameraAlphaSlider.value = String(alphaDeg);
      cameraBetaSlider.value = String(betaDeg);
      cameraZoomSlider.value = zoom.toFixed(2);

      cameraAlphaSlider.setAttribute('aria-valuenow', cameraAlphaSlider.value);
      cameraBetaSlider.setAttribute('aria-valuenow', cameraBetaSlider.value);
      cameraZoomSlider.setAttribute('aria-valuenow', cameraZoomSlider.value);
    }

    await step('Bind camera controls', async () => {
      if (!cameraAlphaSlider || !cameraBetaSlider || !cameraZoomSlider) {
        throw new Error('Camera sliders unavailable');
      }
      [
        [cameraAlphaSlider, applyCameraSettings],
        [cameraBetaSlider, applyCameraSettings],
        [cameraZoomSlider, applyCameraSettings],
      ].forEach(([slider, handler]) => {
        slider.addEventListener('input', handler);
        slider.addEventListener('change', handler);
      });
      applyCameraSettings();
    });

    await step('Add light', async () => {
      const light = new HemisphericLight('light', new Vector3(0, 1, 0), scene);
      light.intensity = 1.1;
      light.specular = new Color3(0.2, 0.2, 0.2);
    });

    const boardPivot = await step('Create board pivot', async () => new TransformNode('boardPivot', scene));

    async function prepareMaterials() {
      setStatus('Preparing rail material…', '#2151a1');
      const railMaterial = new StandardMaterial('railMaterial', scene);
      railMaterial.diffuseColor = new Color3(0.6, 0.72, 1.0);
      railMaterial.emissiveColor = new Color3(0.1, 0.25, 0.6);
      railMaterial.specularColor = new Color3(0.3, 0.4, 0.7);
      setStatus('Preparing ball material…', '#2151b1');
      const ballMaterial = new StandardMaterial('ballMaterial', scene);
      ballMaterial.diffuseColor = new Color3(1, 1, 1);
      ballMaterial.emissiveColor = new Color3(0.55, 0.7, 1);
      ballMaterial.specularColor = new Color3(0.9, 0.9, 0.9);
      setStatus('Materials ready ✔', '#118833');
      return { railMaterial, ballMaterial };
    }

    const { railMaterial, ballMaterial } = await step('Prepare materials', prepareMaterials);

    function buildRailPath(side) {
      const topX = getRailX(geometry, state, 0, side);
      const bottomX = getRailX(geometry, state, 1, side);
      const topPoint = new Vector3(topX, geometry.topY, 0);
      const bottomPoint = new Vector3(bottomX, geometry.bottomY, 0);
      const dropPoint = new Vector3(bottomX, geometry.bottomY, -geometry.railDropLength);
      return [topPoint, bottomPoint, dropPoint];
    }

    async function createRails() {
      setStatus('Creating left rail mesh…', '#2277cc');
      const initialLeftPath = buildRailPath('left');
      const leftRail = MeshBuilder.CreateTube(
        'leftRail',
        { path: initialLeftPath, radius: geometry.railRadius, updatable: true },
        scene
      );
      leftRail.material = railMaterial;
      leftRail.parent = boardPivot;

      setStatus('Creating right rail mesh…', '#2277cc');
      const initialRightPath = buildRailPath('right');
      const rightRail = MeshBuilder.CreateTube(
        'rightRail',
        { path: initialRightPath, radius: geometry.railRadius, updatable: true },
        scene
      );
      rightRail.material = railMaterial;
      rightRail.parent = boardPivot;

      setStatus('Creating rail colliders…', '#2277cc');
      const railLength = Math.abs(geometry.bottomY - geometry.topY);
      const leftRailCollider = MeshBuilder.CreateCylinder(
        'leftRailCollider',
        { height: railLength, diameter: geometry.railRadius * 2 },
        scene
      );
      leftRailCollider.isVisible = false;
      leftRailCollider.parent = boardPivot;

      const rightRailCollider = MeshBuilder.CreateCylinder(
        'rightRailCollider',
        { height: railLength, diameter: geometry.railRadius * 2 },
        scene
      );
      rightRailCollider.isVisible = false;
      rightRailCollider.parent = boardPivot;

      setStatus('Rails ready ✔', '#118833');
      return { leftRail, rightRail, leftRailCollider, rightRailCollider, railLength };
    }

    let leftRail;
    let rightRail;
    let leftRailCollider;
    let rightRailCollider;
    let railLength = 0;
    ({ leftRail, rightRail, leftRailCollider, rightRailCollider, railLength } = await step(
      'Create rails',
      createRails
    ));

    async function createBall() {
      setStatus('Creating ball mesh…', '#2277cc');
      const ballMesh = MeshBuilder.CreateSphere(
        'ball',
        { diameter: geometry.ballRadius * 2 },
        scene
      );
      setStatus('Applying ball material…', '#2288cc');
      ballMesh.material = ballMaterial;
      ballMesh.parent = boardPivot;
      setStatus('Ball ready ✔', '#118833');
      return {
        state: 'init',
        resetTimer: 0,
        mesh: ballMesh,
      };
    }

    const ball = await step('Create ball', createBall);

    const physicsState = {
      plugin: null,
      leftAggregate: null,
      rightAggregate: null,
      ballAggregate: null,
      material: null,
      ready: false,
      lastBallY: null,
      displacement: 0,
      dropTriggered: false,
      dropSeparation: 0,
      events: [],
    };

    function updateBoardTilt() {
      const normalizedTilt = clamp(
        (state.tilt - tiltBounds.min) / (tiltBounds.max - tiltBounds.min),
        0,
        1
      );
      const minAngle = Math.PI / 3.1;
      const maxAngle = Math.PI / 2.2;
      const tiltAngle = minAngle + (maxAngle - minAngle) * normalizedTilt;
      boardPivot.rotation.x = -tiltAngle;
    }

    updateBoardTilt();

    function alignColliderToRail(collider, side) {
      const topX = getRailX(geometry, state, 0, side);
      const bottomX = getRailX(geometry, state, 1, side);
      const top = new Vector3(topX, geometry.topY, geometry.dropStartZ);
      const bottom = new Vector3(bottomX, geometry.bottomY, geometry.dropStartZ);
      const center = top.add(bottom).scale(0.5);
      const direction = bottom.subtract(top);
      const length = direction.length();
      const normalized = direction.normalize();
      const up = Vector3.Up();
      const dot = clamp(Vector3.Dot(up, normalized), -1, 1);
      let rotation = Quaternion.Identity();
      const axis = Vector3.Cross(up, normalized);
      if (axis.lengthSquared() > 1e-6) {
        axis.normalize();
        rotation = Quaternion.RotationAxis(axis, Math.acos(dot));
      } else if (dot < 0) {
        rotation = Quaternion.RotationAxis(Vector3.Right(), Math.PI);
      }

      if (!collider.rotationQuaternion) {
        collider.rotationQuaternion = Quaternion.Identity();
      }
      collider.rotationQuaternion.copyFrom(rotation);
      collider.position.copyFrom(center);
      collider.scaling.y = length / railLength;
    }

    function getWorldTransform(node) {
      const scaling = new Vector3();
      const rotation = new Quaternion();
      const translation = new Vector3();
      node.getWorldMatrix().decompose(scaling, rotation, translation);
      return { rotation, position: translation };
    }

    function updateRailMeshes() {
      const leftPath = buildRailPath('left');
      leftRail = MeshBuilder.CreateTube(
        'leftRail',
        {
          path: leftPath,
          radius: geometry.railRadius,
          updatable: true,
          instance: leftRail,
        },
        scene
      );

      const rightPath = buildRailPath('right');
      rightRail = MeshBuilder.CreateTube(
        'rightRail',
        {
          path: rightPath,
          radius: geometry.railRadius,
          updatable: true,
          instance: rightRail,
        },
        scene
      );

      alignColliderToRail(leftRailCollider, 'left');
      alignColliderToRail(rightRailCollider, 'right');
    }

    function positionBallOnRails(progress = 0) {
      const clampedProgress = clamp(progress, 0, 1);
      const yPos = geometry.topY + (geometry.bottomY - geometry.topY) * clampedProgress;
      const leftX = getRailX(geometry, state, clampedProgress, 'left');
      const rightX = getRailX(geometry, state, clampedProgress, 'right');
      const xPos = (leftX + rightX) / 2;

      ball.mesh.position.x = xPos;
      ball.mesh.position.y = yPos + geometry.ballRadius;
      ball.mesh.position.z = geometry.dropStartZ + geometry.ballRadius;
      return { xPos, yPos };
    }

    function handlePadDown(side, pointerId, normalized) {
      const offset = normalizedToOffset(normalized, geometry.railTravel);
      if (side === 'left') {
        state.leftPointer = pointerId;
        state.leftOffset = offset;
      } else {
        state.rightPointer = pointerId;
        state.rightOffset = offset;
      }
    }

    function handlePadMove(side, pointerId, normalized) {
      if (side === 'left' && state.leftPointer !== pointerId) return;
      if (side === 'right' && state.rightPointer !== pointerId) return;
      const offset = normalizedToOffset(normalized, geometry.railTravel);
      if (side === 'left') {
        state.leftOffset = offset;
      } else {
        state.rightOffset = offset;
      }
    }

    function handlePadUp(side, pointerId) {
      if (side === 'left' && state.leftPointer === pointerId) {
        state.leftPointer = null;
      }
      if (side === 'right' && state.rightPointer === pointerId) {
        state.rightPointer = null;
      }
    }

    function updateTilt(value) {
      state.tilt = sliderValueToTilt(value, tiltBounds);
      tiltReadout.textContent = `${Math.round(state.tilt)}°`;
      tiltSlider.setAttribute('aria-valuenow', String(value));
      updateBoardTilt();
    }

    function normalisePointer(event, padElement) {
      const rect = padElement.getBoundingClientRect();
      const ratio = (event.clientX - rect.left) / rect.width;
      return clamp(ratio, 0, 1);
    }

    function bindTouchPad(padElement, side) {
      padElement.addEventListener(
        'pointerdown',
        (event) => {
          if (event.cancelable) {
            event.preventDefault();
          }
          padElement.setPointerCapture(event.pointerId);
          padElement.classList.add('is-active');
          handlePadDown(side, event.pointerId, normalisePointer(event, padElement));
        },
        { passive: false }
      );

      padElement.addEventListener(
        'pointermove',
        (event) => {
          if (event.cancelable) {
            event.preventDefault();
          }
          handlePadMove(side, event.pointerId, normalisePointer(event, padElement));
        },
        { passive: false }
      );

      padElement.addEventListener(
        'pointerup',
        (event) => {
          if (event.cancelable) {
            event.preventDefault();
          }
          handlePadUp(side, event.pointerId);
          padElement.classList.remove('is-active');
        },
        { passive: false }
      );

      padElement.addEventListener(
        'pointercancel',
        (event) => {
          handlePadUp(side, event.pointerId);
          padElement.classList.remove('is-active');
        },
        { passive: false }
      );
    }

    const debugInterface = {
      geometry,
      get state() {
        return state;
      },
      get physics() {
        return physicsState;
      },
      controls: {
        pressPad(side, pointerId, normalized) {
          const pad = side === 'left' ? leftPad : rightPad;
          pad.classList.add('is-active');
          handlePadDown(side, pointerId, normalized);
        },
        movePad(side, pointerId, normalized) {
          handlePadMove(side, pointerId, normalized);
        },
        releasePad(side, pointerId) {
          const pad = side === 'left' ? leftPad : rightPad;
          pad.classList.remove('is-active');
          handlePadUp(side, pointerId);
        },
      },
      getPocketLayout() {
        return createPocketLayouts(geometry);
      },
    };

    await step('Attach input', async () => {
      if (!leftPad || !rightPad || !tiltSlider) {
        throw new Error('Input controls missing');
      }
      bindTouchPad(leftPad, 'left');
      bindTouchPad(rightPad, 'right');
      tiltSlider.addEventListener('input', (event) => {
        updateTilt(event.target.value);
      });
      tiltSlider.addEventListener('change', (event) => {
        updateTilt(event.target.value);
      });
      updateTilt(tiltSlider.value);
      globalThis.__spaceBall = debugInterface;
    });

    function updateScoreReadout() {
      if (scoreValue) {
        scoreValue.textContent = `${physicsState.displacement.toFixed(3)} m`;
      }
    }

    function recordDropEvent() {
      physicsState.events.push({
        type: 'drop',
        displacement: physicsState.displacement,
        separation: physicsState.dropSeparation,
        timestamp: performance.now(),
      });
      state.score = physicsState.displacement;
      updateScoreReadout();
    }

    function resetBall() {
      const { xPos } = positionBallOnRails(0);
      ball.state = 'ready';
      ball.resetTimer = 0;
      ball.mesh.isVisible = true;
      physicsState.displacement = 0;
      physicsState.lastBallY = ball.mesh.position.y;
      physicsState.dropTriggered = false;
      physicsState.dropSeparation = 0;

      if (physicsState.ballAggregate) {
        const body = physicsState.ballAggregate.body;
        if (body) {
          body.setLinearVelocity?.(Vector3.Zero());
          body.setAngularVelocity?.(Vector3.Zero());
          if (body.setMotionType) {
            body.setMotionType(PhysicsMotionType.DYNAMIC);
          }
          const startPosition = new Vector3(xPos, ball.mesh.position.y, ball.mesh.position.z);
          const rotation = ball.mesh.rotationQuaternion ?? Quaternion.Identity();
          body.setTargetTransform?.(startPosition, rotation, 0);
          body.setTransformation?.(startPosition, rotation);
        }
      }

      updateScoreReadout();
    }

    function initialisePhysics(ammo) {
      setStatus('Configuring physics engine…', '#2299cc');
      const plugin = new AmmoJSPlugin(true, ammo);
      scene.enablePhysics(new Vector3(0, -geometry.gravityBase, 0), plugin);
      const enginePhysics = scene.getPhysicsEngine();
      enginePhysics?.setTimeStep(1 / 240);
      if (plugin.setSubTimeStep) {
        plugin.setSubTimeStep(1 / 480);
      }

      setStatus('Creating physics materials…', '#22a9cc');
      const material = new PhysicsMaterial();
      material.friction = 0.68;
      material.restitution = 0.02;
      material.rollingFriction = 0.06;

      setStatus('Creating ball physics aggregate…', '#22b9cc');
      const ballAggregate = new PhysicsAggregate(
        ball.mesh,
        PhysicsShapeType.SPHERE,
        {
          mass: 0.18,
          restitution: material.restitution,
          friction: material.friction,
        },
        scene
      );
      ballAggregate.body.setMotionType?.(PhysicsMotionType.DYNAMIC);
      ballAggregate.body.setLinearDamping?.(0.08);
      ballAggregate.body.setAngularDamping?.(0.22);

      setStatus('Creating rail physics aggregates…', '#22c9cc');
      const leftAggregate = new PhysicsAggregate(
        leftRailCollider,
        PhysicsShapeType.CYLINDER,
        {
          mass: 0,
          restitution: material.restitution,
          friction: material.friction,
        },
        scene
      );
      leftAggregate.body.setMotionType?.(PhysicsMotionType.KINEMATIC);

      const rightAggregate = new PhysicsAggregate(
        rightRailCollider,
        PhysicsShapeType.CYLINDER,
        {
          mass: 0,
          restitution: material.restitution,
          friction: material.friction,
        },
        scene
      );
      rightAggregate.body.setMotionType?.(PhysicsMotionType.KINEMATIC);

      physicsState.plugin = plugin;
      physicsState.material = material;
      physicsState.ballAggregate = ballAggregate;
      physicsState.leftAggregate = leftAggregate;
      physicsState.rightAggregate = rightAggregate;
      physicsState.ready = true;
      setStatus('Physics aggregates ready ✔', '#118833');
    }

    function syncRailBodies(dtSeconds) {
      if (!physicsState.ready) {
        return;
      }

      const enginePhysics = scene.getPhysicsEngine?.();
      const stepTime = enginePhysics?.getTimeStep?.() ?? dtSeconds;
      const leftBody = physicsState.leftAggregate?.body;
      const rightBody = physicsState.rightAggregate?.body;

      if (leftBody) {
        const { position, rotation } = getWorldTransform(leftRailCollider);
        leftBody.setTargetTransform?.(position, rotation, stepTime);
      }

      if (rightBody) {
        const { position, rotation } = getWorldTransform(rightRailCollider);
        rightBody.setTargetTransform?.(position, rotation, stepTime);
      }
    }

    function updateBallTelemetry(dtSeconds) {
      if (!physicsState.ballAggregate) {
        return;
      }

      const position = ball.mesh.getAbsolutePosition();
      if (physicsState.lastBallY !== null) {
        const descent = physicsState.lastBallY - position.y;
        if (descent > 0) {
          physicsState.displacement += descent;
        }
      }
      physicsState.lastBallY = position.y;

      const span = geometry.topY - geometry.bottomY;
      const along = geometry.topY - (position.y - geometry.ballRadius);
      const progress = clamp(along / span, 0, 1);
      const leftX = getRailX(geometry, state, progress, 'left');
      const rightX = getRailX(geometry, state, progress, 'right');
      physicsState.dropSeparation = rightX - leftX;

      updateScoreReadout();

      if (
        !physicsState.dropTriggered &&
        (physicsState.dropSeparation - geometry.ballRadius * 2 > 0.0005 || position.z < geometry.dropPlaneZ)
      ) {
        physicsState.dropTriggered = true;
        ball.state = 'resetting';
        ball.resetTimer = 1.2;
        ball.mesh.isVisible = false;
        recordDropEvent();
      }
    }

    function stepSimulation(delta) {
      const dtSeconds = delta / 1000;
      updateRailMeshes();
      syncRailBodies(dtSeconds);

      if (physicsState.ready) {
        updateBallTelemetry(dtSeconds);
      }

      if (ball.state === 'resetting') {
        ball.resetTimer -= dtSeconds;
        if (ball.resetTimer <= 0) {
          resetBall();
        }
      }
    }

    const timing = {
      lastTick: performance.now(),
    };

    function updateFrame() {
      const now = performance.now();
      const delta = now - timing.lastTick;
      timing.lastTick = now;

      stepSimulation(delta);
      scene.render();
    }

    await step('Prime scene', async () => {
      resetBall();
      updateRailMeshes();
      alignColliderToRail(leftRailCollider, 'left');
      alignColliderToRail(rightRailCollider, 'right');
    });

    await step('Enable physics', async () => {
      initialisePhysics(ammoModule);
    });

    await step('Reset ball', async () => {
      resetBall();
    });

    await step('Start render loop', async () => {
      timing.lastTick = performance.now();
      engine.runRenderLoop(updateFrame);
    });

    debugInterface.ready = true;

    window.addEventListener('resize', () => {
      engine.resize();
      if (tiltSlider) {
        updateTilt(tiltSlider.value);
      }
    });

    setStatus('✅ All systems go', '#10893E');

    if (!DEBUG_MODE) {
      setTimeout(() => {
        if (statusEl) statusEl.style.display = 'none';
        if (dbgEl) dbgEl.style.display = 'none';
      }, 2500);
    } else {
      logLine('DEBUG MODE ON (bar/panel persist)');
    }
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    if (!statusEl || !statusEl.textContent.startsWith('❌')) {
      setStatus(`❌ Bootstrap failure: ${message}`, 'darkred');
    }
    logLine(`Bootstrap error stack: ${err && err.stack ? err.stack : '(no stack)'}`);
    console.error(err);
  }
})();
