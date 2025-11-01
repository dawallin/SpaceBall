import {
  CM,
  D_RANGE,
  H_RANGE,
  createDebugOverlayData,
  createGeometryModel,
} from './geometry.js';

// === Early debug helpers ===
const statusEl = document.getElementById('status-bar');
let debugPanel;
function logLine(msg) {
  console.log('[SpaceBall]', msg);
  if (statusEl) {
    statusEl.textContent = msg;
  }
}
function setStatus(msg, color) {
  if (statusEl) {
    statusEl.textContent = msg;
    if (color) statusEl.style.background = color;
  }
  logLine(msg);
  if (typeof updateScriptBannerPosition === 'function') {
    updateScriptBannerPosition();
  }
}
async function step(name, fn) {
  const start = performance.now();
  try {
    setStatus(name + '…', '#004488');
    const result = await fn();
    const dur = (performance.now() - start).toFixed(1);
    setStatus(`${name} ✔ (${dur}ms)`, '#0077aa');
    return result;
  } catch (err) {
    const msg = `${name} failed: ${err.message}`;
    setStatus('❌ ' + msg, 'darkred');
    logLine(err.stack || msg);
    throw err;
  }
}

console.log('=== SpaceBall Startup ===');
const scriptLoadResults = ['babylon.js', 'havok/HavokPhysics_umd.js'].map((src) => {
  const found = [...document.scripts].some((s) => s.src.includes(src));
  console.log(found ? `✅ Found ${src}` : `❌ Missing ${src}`);
  return { src, found };
});
console.log('Document readyState:', document.readyState);

if (document.readyState === 'loading') {
  console.log('⏳ Waiting for DOM ready...');
  document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ DOM ready, continuing...');
  });
}

let scriptBanner;
function updateScriptBannerPosition() {
  if (!scriptBanner) {
    return;
  }
  const statusHeight = statusEl ? statusEl.getBoundingClientRect().height : 0;
  scriptBanner.style.top = `${statusHeight}px`;
}

scriptBanner = document.createElement('div');
scriptBanner.style.cssText =
  'position:fixed;left:0;width:100%;background:#001b33;color:#d9e8ff;font-family:monospace;font-size:12px;padding:4px 10px;z-index:9998;display:flex;gap:12px;flex-wrap:wrap;box-shadow:0 2px 6px rgba(0,0,0,0.3);';
scriptLoadResults.forEach(({ src, found }) => {
  const tag = document.createElement('span');
  tag.textContent = `${found ? '✅' : '❌'} ${src}`;
  tag.style.color = found ? '#6cff8b' : '#ff6b6b';
  scriptBanner.appendChild(tag);
});
if (statusEl) {
  statusEl.insertAdjacentElement('afterend', scriptBanner);
} else {
  document.body.insertAdjacentElement('afterbegin', scriptBanner);
}
updateScriptBannerPosition();
window.addEventListener('resize', updateScriptBannerPosition);

const missingScripts = scriptLoadResults.filter((entry) => !entry.found);
if (missingScripts.length) {
  setStatus(`❌ Missing: ${missingScripts.map((e) => e.src).join(', ')}`, 'darkred');
} else {
  setStatus('External scripts detected — bootstrapping…', '#1b4f8f');
}

if (typeof window.BABYLON === 'undefined') {
  document.body.insertAdjacentHTML(
    'beforeend',
    '<div style="background:#aa0000;color:#fff;font-family:monospace;padding:8px;z-index:10000;">❌ BABYLON is undefined when bootstrap starts. Check index.html script ordering and network.</div>'
  );
}

const DEBUG_MODE = new URL(location.href).searchParams.has('debug');
if (DEBUG_MODE) {
  debugPanel = document.createElement('div');
  debugPanel.style.cssText =
    'position:fixed;top:40px;left:0;width:100%;max-height:35vh;overflow:auto;background:#0b1022;color:#d9e8ff;font-family:monospace;font-size:12px;padding:6px;z-index:9998;';
  document.body.appendChild(debugPanel);
  const alignDebugPanel = () => {
    const statusHeight = statusEl ? statusEl.getBoundingClientRect().height : 0;
    const bannerHeight = scriptBanner ? scriptBanner.getBoundingClientRect().height : 0;
    debugPanel.style.top = `${statusHeight + bannerHeight + 8}px`;
  };
  alignDebugPanel();
  window.addEventListener('resize', alignDebugPanel);
  const oldLog = console.log;
  console.log = (...args) => {
    oldLog(...args);
    const line = document.createElement('div');
    line.textContent = args.join(' ');
    debugPanel.appendChild(line);
  };
  logLine('🧠 Debug panel active');
}

function debugPositionLog(...args) {
  if (DEBUG_MODE) {
    console.log(...args);
  }
}

window.addEventListener('error', (e) => {
  setStatus(`❌ JS crash: ${e.message}`, 'darkred');
  const crashBanner = document.createElement('div');
  crashBanner.style.cssText =
    'position:fixed;bottom:0;left:0;right:0;background:#aa0000;color:#fff;font-family:monospace;font-size:12px;padding:6px 10px;z-index:10000;max-height:20vh;overflow:auto;';
  const stack = e.error && e.error.stack ? e.error.stack : '';
  crashBanner.textContent = '❌ ' + e.message + '\n' + stack;
  document.body.appendChild(crashBanner);
});

window.addEventListener('unhandledrejection', (e) => {
  const reasonText =
    typeof e.reason === 'string'
      ? e.reason
      : e.reason && e.reason.message
      ? e.reason.message
      : String(e.reason);
  setStatus(`❌ Promise rejection: ${reasonText}`, 'darkred');
  const crashBanner = document.createElement('div');
  crashBanner.style.cssText =
    'position:fixed;bottom:0;left:0;right:0;background:#aa0000;color:#fff;font-family:monospace;font-size:12px;padding:6px 10px;z-index:10000;max-height:20vh;overflow:auto;';
  const reasonStack = e.reason && e.reason.stack ? `\n${e.reason.stack}` : '';
  crashBanner.textContent = '❌ Promise Rejection: ' + reasonText + reasonStack;
  document.body.appendChild(crashBanner);
});

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

const rodHeightSlider = document.getElementById('rodHeightSlider');
const rodHeightReadout = document.getElementById('rodHeightReadout');
const rodSpacingSlider = document.getElementById('rodSpacingSlider');
const rodSpacingReadout = document.getElementById('rodSpacingReadout');

const tiltBounds = {
  min: 8,
  max: 28,
};

// ─────────────────────────────
// 🧩 1. GEOMETRY CONFIGURATION
// ─────────────────────────────
const geometry = createGeometryModel();

const state = {
  score: 0,
  tilt: 0,
  leftAngle: geometry.angles.leftDeg,
  rightAngle: geometry.angles.rightDeg,
  leftPointer: null,
  rightPointer: null,
  rodHeight: geometry.adjustable.h,
  rodSpacing: geometry.adjustable.d,
};

function degToRad(degrees) {
  return (Number(degrees) * Math.PI) / 180;
}

// ─────────────────────────────
// 🚀 3. BOOTSTRAP AND DEBUG
// ─────────────────────────────
async function bootstrap() {
  try {
    setStatus('Initialize SpaceBall…', '#44c');
    console.log('[SpaceBall Geometry]', geometry);
    await step('Verify Babylon global', async () => {
      const t0 = performance.now();
      if (typeof window.BABYLON === 'undefined') {
        throw new Error('BABYLON global still undefined inside bootstrap — external script may have failed to load.');
      } else {
        const dt = (performance.now() - t0).toFixed(1);
        logLine(`✅ Babylon.js detected after ${dt}ms`);
      }
    });

    const controlModule = await step('Load control-logic module', async () => import('./control-logic.js'));
    ({ clamp, normalizedToOffset, sliderValueToTilt, getRailX, createPocketLayouts } = controlModule);
    let pocketLayout = createPocketLayouts(geometry);

    await step('Initialize UI controls', async () => {
      if (!tiltSlider || !tiltReadout) {
        throw new Error('Tilt controls missing');
      }
      if (!rodHeightSlider || !rodHeightReadout || !rodSpacingSlider || !rodSpacingReadout) {
        throw new Error('Rod geometry sliders missing');
      }

      state.tilt = sliderValueToTilt(tiltSlider.value ?? 0, tiltBounds);
      tiltReadout.textContent = `${Math.round(state.tilt)}°`;
      tiltSlider.setAttribute('aria-valuenow', tiltSlider.value);

      const heightCm = (geometry.adjustable.h / CM).toFixed(1);
      const spacingCm = (geometry.adjustable.d / CM).toFixed(1);
      rodHeightSlider.value = heightCm;
      rodSpacingSlider.value = spacingCm;
      rodHeightSlider.setAttribute('aria-valuenow', heightCm);
      rodSpacingSlider.setAttribute('aria-valuenow', spacingCm);
      rodHeightReadout.textContent = `${heightCm} cm`;
      rodSpacingReadout.textContent = `${spacingCm} cm`;
    });

    await step('Verify Havok loader', async () => {
      if (typeof window.HavokPhysics === 'function') {
        return;
      }
      throw new Error('HavokPhysics global not found (HavokPhysics_umd.js failed to load)');
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
      PhysicsMotionType,
      PhysicsShapeType,
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
      const alphaRange = {
        min: Number(cameraAlphaSlider.min ?? 0),
        max: Number(cameraAlphaSlider.max ?? 360),
      };
      const betaRange = {
        min: Number(cameraBetaSlider.min ?? 0),
        max: Number(cameraBetaSlider.max ?? 360),
      };
      safeLowerBetaDeg = Math.min(betaRange.min + betaLimitPadding, betaRange.max - betaLimitPadding);
      safeUpperBetaDeg = Math.max(betaRange.min + betaLimitPadding, betaRange.max - betaLimitPadding);
      const initialAlphaDegrees = clamp(
        Number(cameraAlphaSlider.value ?? 90) || 0,
        alphaRange.min,
        alphaRange.max
      );
      const initialBetaDegrees = clamp(
        Number(cameraBetaSlider.value ?? 45) || 0,
        safeLowerBetaDeg,
        safeUpperBetaDeg
      );
      const cam = new ArcRotateCamera(
        'camera',
        degToRad(initialAlphaDegrees),
        degToRad(initialBetaDegrees),
        Number(cameraZoomSlider.value ?? 1.5),
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
      const alphaMin = Number(cameraAlphaSlider.min) || 0;
      const alphaMax = Number(cameraAlphaSlider.max) || 360;
      const alphaDeg = clamp(Number(cameraAlphaSlider.value) || 0, alphaMin, alphaMax);
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

    // ─────────────────────────────
    // ⚙️ 2. SCENE CONSTRUCTION
    // ─────────────────────────────

    function buildRailPath(side) {
      const front = geometry.getRodPoint(side, 0);
      const back = geometry.getRodPoint(side, 1);
      const frontVec = new Vector3(front.x, front.y, front.z);
      const backVec = new Vector3(back.x, back.y, back.z);
      const dropVec = new Vector3(back.x, back.y, back.z - geometry.railDropLength);
      return [frontVec, backVec, dropVec];
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
      debugPositionLog('[SpaceBall] Rail L position:', leftRail.position);
      debugPositionLog('[SpaceBall] Rail L path:', initialLeftPath.map((point) => point.toString()));

      setStatus('Creating right rail mesh…', '#2277cc');
      const initialRightPath = buildRailPath('right');
      const rightRail = MeshBuilder.CreateTube(
        'rightRail',
        { path: initialRightPath, radius: geometry.railRadius, updatable: true },
        scene
      );
      rightRail.material = railMaterial;
      rightRail.parent = boardPivot;
      debugPositionLog('[SpaceBall] Rail R position:', rightRail.position);
      debugPositionLog('[SpaceBall] Rail R path:', initialRightPath.map((point) => point.toString()));

      setStatus('Creating rail colliders…', '#2277cc');
      const railLength = geometry.railLengthY;
      const leftRailCollider = MeshBuilder.CreateCylinder(
        'leftRailCollider',
        { height: railLength, diameter: geometry.railRadius * 2 },
        scene
      );
      leftRailCollider.isVisible = false;
      leftRailCollider.parent = boardPivot;
      debugPositionLog('[SpaceBall] Rail L collider created at:', leftRailCollider.position);

      const rightRailCollider = MeshBuilder.CreateCylinder(
        'rightRailCollider',
        { height: railLength, diameter: geometry.railRadius * 2 },
        scene
      );
      rightRailCollider.isVisible = false;
      rightRailCollider.parent = boardPivot;
      debugPositionLog('[SpaceBall] Rail R collider created at:', rightRailCollider.position);

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
    updateDebugOverlayMeshes();
    applyRodAdjustables();

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
      debugPositionLog('[SpaceBall] Ball mesh created at:', ballMesh.position);
      setStatus('Ball ready ✔', '#118833');
      return {
        state: 'init',
        resetTimer: 0,
        mesh: ballMesh,
      };
    }
    let ball;

    async function createScoreBoard() {
      setStatus('Creating score board…', '#2277cc');
      if (!scene.getPhysicsEngine()) {
        console.warn('[SpaceBall] ⚠ Physics engine not ready, skipping score board.');
        return;
      }
      // Compute pocket layout and centre the board around it
      const pockets = pocketLayout;
      const pocketCount = pockets.length;
      const yMin = pockets[pocketCount - 1].y - geometry.pocketRadius;
      const yMax = pockets[0].y + geometry.pocketRadius;
      const boardCenterY = (yMin + yMax) / 2;

      // Wooden plate
        const board = MeshBuilder.CreateBox(
          'scoreBoard',
          {
            width: geometry.boardWidth,
            height: geometry.boardHeight,
            depth: geometry.boardThickness,
          },
          scene
        );
        const boardMat = new StandardMaterial('scoreBoardMat', scene);
        boardMat.diffuseColor = new Color3(0.3, 0.15, 0.05); // wood colour
        board.material = boardMat;
        board.position.set(geometry.centerX, boardCenterY, geometry.boardOffsetZ);
        board.parent = boardPivot;
        debugPositionLog('[SpaceBall] Board centre:', board.position);

        const boardThickness = geometry.boardThickness;
        const boardCenterZ = geometry.boardOffsetZ;

        // Static physics for the plate
        const boardAgg = new PhysicsAggregate(
        board,
        PhysicsShapeType.BOX,
        {
          mass: 0,
          restitution: 0.02,
          friction: 0.68,
        },
        scene
      );
      boardAgg.body.setMotionType?.(PhysicsMotionType.STATIC);

      // Create sloped funnels for each pocket
      // Each funnel is built from a few stacked cylinder segments with decreasing radius
      const segmentsPerFunnel = 3;
      const slopeFactor = 2.5; // controls how wide the top is relative to the hole
      for (let i = 0; i < pockets.length; i++) {
        const p = pockets[i];
        for (let j = 0; j < segmentsPerFunnel; j++) {
          const t = j / segmentsPerFunnel;
          const nextT = (j + 1) / segmentsPerFunnel;
          const topDiameter = p.radius * 2 * (1 + slopeFactor * (1 - t));
          const bottomDiameter = p.radius * 2 * (1 + slopeFactor * (1 - nextT));
          const segHeight = boardThickness / segmentsPerFunnel;

          const funnel = MeshBuilder.CreateCylinder(
            `pocket_${p.name}_seg${j}`,
            {
              diameterTop: topDiameter,
              diameterBottom: bottomDiameter,
              height: segHeight,
              tessellation: 24,
            },
            scene
          );
          // Material for funnels: slightly lighter wood
          const funnelMat = new StandardMaterial(`funnelMat_${p.name}_${j}`, scene);
          funnelMat.diffuseColor = new Color3(0.4, 0.2, 0.1);
          funnel.material = funnelMat;

          // Position each segment: stack them along z inside the plate
          const zOffset = -boardThickness / 2 + segHeight * (j + 0.5);
          funnel.position.set(p.x, p.y, boardCenterZ + zOffset);
          funnel.parent = boardPivot;

          // Static physics for each funnel segment
          const funnelAgg = new PhysicsAggregate(
            funnel,
            PhysicsShapeType.CYLINDER,
            {
              mass: 0,
              restitution: 0.02,
              friction: 0.68,
            },
            scene
          );
          funnelAgg.body.setMotionType?.(PhysicsMotionType.STATIC);
        }
      }
      setStatus('Score board ready ✔', '#118833');
    }

    const supportSpacing = geometry.pocketRadius * 1.6;
    const supportYOffsets = [-supportSpacing, supportSpacing];
    const supportZCenter = geometry.supportDropZ;
    let railSupports = { left: [], right: [] };

    function positionSupports() {
      const pockets = pocketLayout;
      const pocketCount = pockets.length;
      const yMin = pockets[pocketCount - 1].y - geometry.pocketRadius;
      const yMax = pockets[0].y + geometry.pocketRadius;
      const boardCenterY = (yMin + yMax) / 2;

      ['left', 'right'].forEach((side) => {
        const sideSupports = railSupports[side];
        if (!sideSupports || !sideSupports.length) {
          return;
        }
        const railX = getRailX(geometry, state, 1, side);
        supportYOffsets.forEach((offset, index) => {
          const support = sideSupports[index];
          if (!support) {
            return;
          }
          support.position.x = railX;
          support.position.y = boardCenterY + offset;
          support.position.z = supportZCenter;
          debugPositionLog(`[SpaceBall] Support ${side} #${index} at:`, support.position);
          const aggregate = support.physicsAggregate;
          if (aggregate?.body) {
            const { position, rotation } = getWorldTransform(support);
            aggregate.body.setTargetTransform?.(position, rotation, 0);
            aggregate.body.setTransformation?.(position, rotation);
          }
        });
      });
    }

    async function createSupports() {
      if (!scene.getPhysicsEngine()) {
        console.warn('[SpaceBall] ⚠ Physics engine not ready, skipping supports.');
        return railSupports;
      }
      const supportsBySide = { left: [], right: [] };
      const diameter = geometry.supportRadius * 2;
      const height = geometry.railDropLength;

      ['left', 'right'].forEach((side) => {
        supportYOffsets.forEach((offset, index) => {
          const support = MeshBuilder.CreateCylinder(
            `${side}RailSupport_${index}`,
            { height, diameter },
            scene
          );
          support.rotation.x = Math.PI / 2;
          support.material = railMaterial;
          support.parent = boardPivot;
          debugPositionLog(`[SpaceBall] Created support ${side} #${index} (y offset ${offset.toFixed(3)})`);
          const supportAggregate = new PhysicsAggregate(
            support,
            PhysicsShapeType.CYLINDER,
            {
              mass: 0,
              restitution: 0.05,
              friction: 0.7,
            },
            scene
          );
          supportAggregate.body.setMotionType?.(PhysicsMotionType.STATIC);
          support.physicsAggregate = supportAggregate;
          supportsBySide[side].push(support);
        });
      });

      railSupports = supportsBySide;
      positionSupports();
      return supportsBySide;
    }

    const physicsState = {
      plugin: null,
      leftAggregate: null,
      rightAggregate: null,
      ballAggregate: null,
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
      const front = geometry.getRodPoint(side, 0);
      const back = geometry.getRodPoint(side, 1);
      const top = new Vector3(front.x, front.y, front.z);
      const bottom = new Vector3(back.x, back.y, back.z);
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
      positionSupports();
    }

    function positionBallOnRails(progress = 0) {
      const clampedProgress = clamp(progress, 0, 1);
      const leftPoint = geometry.getRodPoint('left', clampedProgress);
      const rightPoint = geometry.getRodPoint('right', clampedProgress);
      const xPos = (leftPoint.x + rightPoint.x) / 2;
      const yPos = (leftPoint.y + rightPoint.y) / 2;
      const zRail = (leftPoint.z + rightPoint.z) / 2;

      ball.mesh.position.x = xPos;
      ball.mesh.position.y = yPos;
      ball.mesh.position.z = zRail + geometry.ballRadius;
      if (clampedProgress === 0) {
        debugPositionLog('[SpaceBall] Ball start:', ball.mesh.position);
      }
      return { xPos, yPos, zRail };
    }

    const overlayMeshes = {
      lines: [],
      points: [],
    };

    function getCurrentBallProgress() {
      if (!ball?.mesh) {
        return 0;
      }
      const position = ball.mesh.getAbsolutePosition();
      const frontY = geometry.rods.left.front.y;
      const backY = geometry.rods.left.back.y;
      const span = frontY - backY || 1;
      const along = frontY - position.y;
      return clamp(along / span, 0, 1);
    }

    function updateDebugOverlayMeshes() {
      if (!DEBUG_MODE) {
        return;
      }
      const data = createDebugOverlayData(geometry);
      data.lines.forEach((line, index) => {
        const points = line.points.map((p) => new Vector3(p.x, p.y, p.z));
        if (overlayMeshes.lines[index]) {
          overlayMeshes.lines[index] = MeshBuilder.CreateLines(
            `geometryDebugLine_${index}`,
            { points, updatable: true, instance: overlayMeshes.lines[index] },
            scene
          );
          overlayMeshes.lines[index].isVisible = true;
        } else {
          const mesh = MeshBuilder.CreateLines(
            `geometryDebugLine_${index}`,
            { points, updatable: true },
            scene
          );
          mesh.color = new Color3(0.8, 0.95, 0.6);
          mesh.parent = boardPivot;
          overlayMeshes.lines[index] = mesh;
        }
      });
      // Hide extra meshes if line count shrinks
      overlayMeshes.lines.slice(data.lines.length).forEach((mesh) => mesh && (mesh.isVisible = false));

      data.points.forEach((entry, index) => {
        const position = entry.position;
        const existing = overlayMeshes.points[index];
        if (existing) {
          existing.position.set(position.x, position.y, position.z);
          existing.isVisible = true;
        } else {
          const sphere = MeshBuilder.CreateSphere(
            `geometryDebugPoint_${index}`,
            { diameter: geometry.ballRadius * 0.6 },
            scene
          );
          const material = new StandardMaterial(`geometryDebugPointMat_${index}`, scene);
          material.diffuseColor = new Color3(0.95, 0.45, 0.35);
          sphere.material = material;
          sphere.parent = boardPivot;
          sphere.position.set(position.x, position.y, position.z);
          overlayMeshes.points[index] = sphere;
        }
      });
      overlayMeshes.points.slice(data.points.length).forEach((mesh) => mesh && (mesh.isVisible = false));
    }

    function applyRodAngles() {
      const progress = getCurrentBallProgress();
      geometry.updateAngles({ thetaL: state.leftAngle, thetaR: state.rightAngle });
      state.leftAngle = geometry.angles.leftDeg;
      state.rightAngle = geometry.angles.rightDeg;
      if (leftRail && rightRail) {
        updateRailMeshes();
      }
      if (ball) {
        positionBallOnRails(progress);
      }
      if (railSupports.left.length || railSupports.right.length) {
        positionSupports();
      }
      updateDebugOverlayMeshes();
    }

    function applyRodAdjustables() {
      const progress = getCurrentBallProgress();
      geometry.updateAdjustables({ h: state.rodHeight, d: state.rodSpacing });
      geometry.updateAngles({ thetaL: state.leftAngle, thetaR: state.rightAngle });
      state.leftAngle = geometry.angles.leftDeg;
      state.rightAngle = geometry.angles.rightDeg;
      state.rodHeight = geometry.adjustable.h;
      state.rodSpacing = geometry.adjustable.d;
      pocketLayout = createPocketLayouts(geometry);
      if (leftRail && rightRail) {
        updateRailMeshes();
      }
      if (ball) {
        positionBallOnRails(progress);
      }
      if (railSupports.left.length || railSupports.right.length) {
        positionSupports();
      }
      updateDebugOverlayMeshes();
      const heightCm = (geometry.adjustable.h / CM).toFixed(1);
      const spacingCm = (geometry.adjustable.d / CM).toFixed(1);
      if (rodHeightReadout) {
        rodHeightReadout.textContent = `${heightCm} cm`;
      }
      if (rodSpacingReadout) {
        rodSpacingReadout.textContent = `${spacingCm} cm`;
      }
      if (rodHeightSlider) {
        rodHeightSlider.value = heightCm;
        rodHeightSlider.setAttribute('aria-valuenow', heightCm);
      }
      if (rodSpacingSlider) {
        rodSpacingSlider.value = spacingCm;
        rodSpacingSlider.setAttribute('aria-valuenow', spacingCm);
      }
    }

    function handlePadDown(side, pointerId, normalized) {
      const angle = normalizedToOffset(normalized, geometry.rodAngleRange);
      if (side === 'left') {
        state.leftPointer = pointerId;
        state.leftAngle = angle;
      } else {
        state.rightPointer = pointerId;
        state.rightAngle = angle;
      }
      applyRodAngles();
    }

    function handlePadMove(side, pointerId, normalized) {
      if (side === 'left' && state.leftPointer !== pointerId) return;
      if (side === 'right' && state.rightPointer !== pointerId) return;
      const angle = normalizedToOffset(normalized, geometry.rodAngleRange);
      if (side === 'left') {
        state.leftAngle = angle;
      } else {
        state.rightAngle = angle;
      }
      applyRodAngles();
    }

    function handlePadUp(side, pointerId) {
      if (side === 'left' && state.leftPointer === pointerId) {
        state.leftPointer = null;
      }
      if (side === 'right' && state.rightPointer === pointerId) {
        state.rightPointer = null;
      }
      applyRodAngles();
    }

    function updateTilt(value) {
      state.tilt = sliderValueToTilt(value, tiltBounds);
      tiltReadout.textContent = `${Math.round(state.tilt)}°`;
      tiltSlider.setAttribute('aria-valuenow', String(value));
      updateBoardTilt();
    }

    function updateRodHeight(value) {
      if (!rodHeightSlider) {
        return;
      }
      const minCm = H_RANGE.min / CM;
      const maxCm = H_RANGE.max / CM;
      const cmValue = clamp(Number(value) || 0, minCm, maxCm);
      state.rodHeight = cmValue * CM;
      applyRodAdjustables();
    }

    function updateRodSpacing(value) {
      if (!rodSpacingSlider) {
        return;
      }
      const minCm = D_RANGE.min / CM;
      const maxCm = D_RANGE.max / CM;
      const cmValue = clamp(Number(value) || 0, minCm, maxCm);
      state.rodSpacing = cmValue * CM;
      applyRodAdjustables();
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
        return pocketLayout.map((p) => ({ ...p }));
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
      if (rodHeightSlider) {
        rodHeightSlider.addEventListener('input', (event) => {
          updateRodHeight(event.target.value);
        });
        rodHeightSlider.addEventListener('change', (event) => {
          updateRodHeight(event.target.value);
        });
      }
      if (rodSpacingSlider) {
        rodSpacingSlider.addEventListener('input', (event) => {
          updateRodSpacing(event.target.value);
        });
        rodSpacingSlider.addEventListener('change', (event) => {
          updateRodSpacing(event.target.value);
        });
      }
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
      debugPositionLog('[SpaceBall] Ball reset at:', ball.mesh.position, 'target x:', xPos);

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

    async function initialisePhysics() {
      logLine('Configuring Havok physics engine…');
      setStatus('Configuring Havok physics engine…', '#22a9cc');
      const havokInstance = await HavokPhysics();
      const havokPlugin = new BABYLON.HavokPlugin(true, havokInstance);
      scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), havokPlugin);
      logLine('Havok physics enabled ✔');
      const enginePhysics = scene.getPhysicsEngine();
      enginePhysics?.setTimeStep(1 / 240);
      if (havokPlugin.setSubTimeStep) {
        havokPlugin.setSubTimeStep(1 / 480);
      }

      setStatus('Creating ball physics aggregate…', '#22b9cc');
      const ballAggregate = new PhysicsAggregate(
        ball.mesh,
        PhysicsShapeType.SPHERE,
        {
          mass: 0.18,
          restitution: 0.02,
          friction: 0.68,
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
          restitution: 0.02,
          friction: 0.68,
        },
        scene
      );
      leftAggregate.body.setMotionType?.(PhysicsMotionType.KINEMATIC);

      const rightAggregate = new PhysicsAggregate(
        rightRailCollider,
        PhysicsShapeType.CYLINDER,
        {
          mass: 0,
          restitution: 0.02,
          friction: 0.68,
        },
        scene
      );
      rightAggregate.body.setMotionType?.(PhysicsMotionType.KINEMATIC);

      physicsState.plugin = havokPlugin;
      physicsState.ballAggregate = ballAggregate;
      physicsState.leftAggregate = leftAggregate;
      physicsState.rightAggregate = rightAggregate;
      physicsState.ready = true;
      setStatus('Havok physics enabled ✔', '#118833');
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
        const travel = physicsState.lastBallY - position.y;
        if (travel > 0) {
          physicsState.displacement += travel;
        }
      }
      physicsState.lastBallY = position.y;

      const frontY = geometry.rods.left.front.y;
      const backY = geometry.rods.left.back.y;
      const span = frontY - backY || 1;
      const along = frontY - position.y;
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

    ball = await step('Create ball', createBall);

    await step('Prime scene', async () => {
      resetBall();
      updateRailMeshes();
      alignColliderToRail(leftRailCollider, 'left');
      alignColliderToRail(rightRailCollider, 'right');
    });

    await step('Enable physics', async () => {
      await initialisePhysics();
    });

    await step('Create score board', createScoreBoard);

    await step('Create supports', createSupports);

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
        if (debugPanel) debugPanel.style.display = 'none';
        if (scriptBanner) scriptBanner.style.display = 'none';
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
}

bootstrap();
