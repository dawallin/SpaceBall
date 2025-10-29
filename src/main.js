import {
  clamp,
  normalizedToOffset,
  sliderValueToTilt,
  getRailX,
  createPocketLayouts,
} from "./control-logic.js";

import {
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
} from "https://cdn.jsdelivr.net/npm/@babylonjs/core@7.34.0/+esm";
import "https://cdn.jsdelivr.net/npm/@babylonjs/core@7.34.0/Meshes/Builders/tubeBuilder.js";
import "https://cdn.jsdelivr.net/npm/@babylonjs/core@7.34.0/Meshes/Builders/sphereBuilder.js";
import "https://cdn.jsdelivr.net/npm/@babylonjs/core@7.34.0/Materials/standardMaterial.js";

function degToRad(degrees) {
  return (Number(degrees) * Math.PI) / 180;
}

const canvas = document.getElementById("playfield");
const tiltSlider = document.getElementById("tiltSlider");
const tiltReadout = document.getElementById("tiltReadout");
const scoreValue = document.getElementById("scoreValue");
const leftPad = document.getElementById("leftPad");
const rightPad = document.getElementById("rightPad");
const cameraAlphaSlider = document.getElementById("cameraAlphaSlider");
const cameraBetaSlider = document.getElementById("cameraBetaSlider");
const cameraZoomSlider = document.getElementById("cameraZoomSlider");
const cameraAlphaReadout = document.getElementById("cameraAlphaReadout");
const cameraBetaReadout = document.getElementById("cameraBetaReadout");
const cameraZoomReadout = document.getElementById("cameraZoomReadout");

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
  tilt: sliderValueToTilt(tiltSlider.value, tiltBounds),
  leftOffset: 0,
  rightOffset: 0,
  leftPointer: null,
  rightPointer: null,
};

tiltReadout.textContent = `${Math.round(state.tilt)}°`;
tiltSlider.setAttribute("aria-valuenow", tiltSlider.value);

const engine = new Engine(canvas, true, {
  alpha: true,
  preserveDrawingBuffer: true,
  stencil: true,
  disableWebGL2Support: false,
});
const scene = new Scene(engine);
scene.clearColor = new Color4(0, 0, 0, 0);

const boardPivot = new TransformNode("boardPivot", scene);

const betaRange = {
  min: Number(cameraBetaSlider?.min ?? 0),
  max: Number(cameraBetaSlider?.max ?? 360),
};
const betaLimitPadding = 0.01;
const safeLowerBetaDeg = Math.min(
  betaRange.min + betaLimitPadding,
  betaRange.max - betaLimitPadding
);
const safeUpperBetaDeg = Math.max(
  betaRange.min + betaLimitPadding,
  betaRange.max - betaLimitPadding
);
const initialBetaDegrees = clamp(
  Number(cameraBetaSlider?.value ?? 60) || 0,
  safeLowerBetaDeg,
  safeUpperBetaDeg
);

const initialCameraSettings = {
  alpha: degToRad(cameraAlphaSlider?.value ?? 20),
  beta: degToRad(initialBetaDegrees),
  radius: Number(cameraZoomSlider?.value ?? 1.2),
};

const camera = new ArcRotateCamera(
  "camera",
  initialCameraSettings.alpha,
  initialCameraSettings.beta,
  initialCameraSettings.radius,
  new Vector3(0, -0.05, -0.35),
  scene
);
camera.lowerRadiusLimit = Number(cameraZoomSlider?.min ?? 0.6);
camera.upperRadiusLimit = Number(cameraZoomSlider?.max ?? 2.4);
camera.lowerBetaLimit = degToRad(safeLowerBetaDeg);
camera.upperBetaLimit = degToRad(safeUpperBetaDeg);
camera.wheelPrecision = 120;
camera.panningSensibility = 0;
camera.attachControl(canvas, false);
camera.inputs.clear();

function buildRailPath(side) {
  const topX = getRailX(geometry, state, 0, side);
  const bottomX = getRailX(geometry, state, 1, side);

  const topPoint = new Vector3(topX, geometry.topY, 0);
  const bottomPoint = new Vector3(bottomX, geometry.bottomY, 0);
  const dropPoint = new Vector3(
    bottomX,
    geometry.bottomY,
    -geometry.railDropLength
  );

  return [topPoint, bottomPoint, dropPoint];
}

function applyCameraSettings() {
  if (!cameraAlphaSlider || !cameraBetaSlider || !cameraZoomSlider) {
    return;
  }

  const alphaDeg = clamp(Number(cameraAlphaSlider.value) || 0, 0, 360);
  const betaMin = Number(cameraBetaSlider.min) || 0;
  const betaMax = Number(cameraBetaSlider.max) || 360;
  const betaDeg = clamp(Number(cameraBetaSlider.value) || 0, betaMin, betaMax);
  const safeBetaLower = Math.min(
    betaMin + betaLimitPadding,
    betaMax - betaLimitPadding
  );
  const safeBetaUpper = Math.max(
    betaMin + betaLimitPadding,
    betaMax - betaLimitPadding
  );
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

  cameraAlphaSlider.setAttribute("aria-valuenow", cameraAlphaSlider.value);
  cameraBetaSlider.setAttribute("aria-valuenow", cameraBetaSlider.value);
  cameraZoomSlider.setAttribute("aria-valuenow", cameraZoomSlider.value);
}

if (cameraAlphaSlider && cameraBetaSlider && cameraZoomSlider) {
  [
    [cameraAlphaSlider, applyCameraSettings],
    [cameraBetaSlider, applyCameraSettings],
    [cameraZoomSlider, applyCameraSettings],
  ].forEach(([slider, handler]) => {
    slider.addEventListener("input", handler);
    slider.addEventListener("change", handler);
  });

  applyCameraSettings();
}

const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
light.intensity = 1.1;
light.specular = new Color3(0.2, 0.2, 0.2);

const railMaterial = new StandardMaterial("railMaterial", scene);
railMaterial.diffuseColor = new Color3(0.6, 0.72, 1.0);
railMaterial.emissiveColor = new Color3(0.1, 0.25, 0.6);
railMaterial.specularColor = new Color3(0.3, 0.4, 0.7);

const ballMaterial = new StandardMaterial("ballMaterial", scene);
ballMaterial.diffuseColor = new Color3(1, 1, 1);
ballMaterial.emissiveColor = new Color3(0.55, 0.7, 1);
ballMaterial.specularColor = new Color3(0.9, 0.9, 0.9);

const initialLeftPath = buildRailPath("left");
let leftRail = MeshBuilder.CreateTube(
  "leftRail",
  { path: initialLeftPath, radius: geometry.railRadius, updatable: true },
  scene
);
leftRail.material = railMaterial;
leftRail.parent = boardPivot;

const initialRightPath = buildRailPath("right");
let rightRail = MeshBuilder.CreateTube(
  "rightRail",
  { path: initialRightPath, radius: geometry.railRadius, updatable: true },
  scene
);
rightRail.material = railMaterial;
rightRail.parent = boardPivot;

const railLength = Math.abs(geometry.bottomY - geometry.topY);
const leftRailCollider = MeshBuilder.CreateCylinder(
  "leftRailCollider",
  { height: railLength, diameter: geometry.railRadius * 2 },
  scene
);
leftRailCollider.isVisible = false;
leftRailCollider.parent = boardPivot;

const rightRailCollider = MeshBuilder.CreateCylinder(
  "rightRailCollider",
  { height: railLength, diameter: geometry.railRadius * 2 },
  scene
);
rightRailCollider.isVisible = false;
rightRailCollider.parent = boardPivot;

const ballMesh = MeshBuilder.CreateSphere(
  "ball",
  { diameter: geometry.ballRadius * 2 },
  scene
);
ballMesh.material = ballMaterial;
ballMesh.parent = boardPivot;

const ball = {
  state: "init",
  resetTimer: 0,
  mesh: ballMesh,
};

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
  const leftPath = buildRailPath("left");
  leftRail = MeshBuilder.CreateTube(
    "leftRail",
    {
      path: leftPath,
      radius: geometry.railRadius,
      updatable: true,
      instance: leftRail,
    },
    scene
  );

  const rightPath = buildRailPath("right");
  rightRail = MeshBuilder.CreateTube(
    "rightRail",
    {
      path: rightPath,
      radius: geometry.railRadius,
      updatable: true,
      instance: rightRail,
    },
    scene
  );

  alignColliderToRail(leftRailCollider, "left");
  alignColliderToRail(rightRailCollider, "right");
}

function positionBallOnRails(progress = 0) {
  const clampedProgress = clamp(progress, 0, 1);
  const yPos = geometry.topY + (geometry.bottomY - geometry.topY) * clampedProgress;
  const leftX = getRailX(geometry, state, clampedProgress, "left");
  const rightX = getRailX(geometry, state, clampedProgress, "right");
  const xPos = (leftX + rightX) / 2;

  ball.mesh.position.x = xPos;
  ball.mesh.position.y = yPos + geometry.ballRadius;
  ball.mesh.position.z = geometry.dropStartZ + geometry.ballRadius;
  return { xPos, yPos };
}

function handlePadDown(side, pointerId, normalized) {
  const offset = normalizedToOffset(normalized, geometry.railTravel);
  if (side === "left") {
    state.leftPointer = pointerId;
    state.leftOffset = offset;
  } else {
    state.rightPointer = pointerId;
    state.rightOffset = offset;
  }
}

function handlePadMove(side, pointerId, normalized) {
  if (side === "left" && state.leftPointer !== pointerId) return;
  if (side === "right" && state.rightPointer !== pointerId) return;
  const offset = normalizedToOffset(normalized, geometry.railTravel);
  if (side === "left") {
    state.leftOffset = offset;
  } else {
    state.rightOffset = offset;
  }
}

function handlePadUp(side, pointerId) {
  if (side === "left" && state.leftPointer === pointerId) {
    state.leftPointer = null;
  }
  if (side === "right" && state.rightPointer === pointerId) {
    state.rightPointer = null;
  }
}

function updateTilt(value) {
  state.tilt = sliderValueToTilt(value, tiltBounds);
  tiltReadout.textContent = `${Math.round(state.tilt)}°`;
  tiltSlider.setAttribute("aria-valuenow", String(value));
  updateBoardTilt();
}

tiltSlider.addEventListener("input", (event) => {
  updateTilt(event.target.value);
});

tiltSlider.addEventListener("change", (event) => {
  updateTilt(event.target.value);
});

function normalisePointer(event, padElement) {
  const rect = padElement.getBoundingClientRect();
  const ratio = (event.clientX - rect.left) / rect.width;
  return clamp(ratio, 0, 1);
}

function bindTouchPad(padElement, side) {
  padElement.addEventListener(
    "pointerdown",
    (event) => {
      if (event.cancelable) {
        event.preventDefault();
      }
      padElement.setPointerCapture(event.pointerId);
      padElement.classList.add("is-active");
      handlePadDown(side, event.pointerId, normalisePointer(event, padElement));
    },
    { passive: false }
  );

  padElement.addEventListener(
    "pointermove",
    (event) => {
      if (event.cancelable) {
        event.preventDefault();
      }
      handlePadMove(side, event.pointerId, normalisePointer(event, padElement));
    },
    { passive: false }
  );

  padElement.addEventListener(
    "pointerup",
    (event) => {
      if (event.cancelable) {
        event.preventDefault();
      }
      handlePadUp(side, event.pointerId);
      padElement.classList.remove("is-active");
    },
    { passive: false }
  );

  padElement.addEventListener(
    "pointercancel",
    (event) => {
      handlePadUp(side, event.pointerId);
      padElement.classList.remove("is-active");
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
      const pad = side === "left" ? leftPad : rightPad;
      pad.classList.add("is-active");
      handlePadDown(side, pointerId, normalized);
    },
    movePad(side, pointerId, normalized) {
      handlePadMove(side, pointerId, normalized);
    },
    releasePad(side, pointerId) {
      const pad = side === "left" ? leftPad : rightPad;
      pad.classList.remove("is-active");
      handlePadUp(side, pointerId);
    },
  },
  getPocketLayout() {
    return createPocketLayouts(geometry);
  },
};

globalThis.__spaceBall = debugInterface;

bindTouchPad(leftPad, "left");
bindTouchPad(rightPad, "right");

function loadAmmoModule() {
  const typedModules = [
    "https://cdn.jsdelivr.net/npm/ammojs-typed@1.0.6/ammo.wasm.js",
    "https://cdn.jsdelivr.net/npm/ammojs-typed@1.0.6/ammo.js",
  ];

  const tryTypedModule = (index = 0) => {
    if (index >= typedModules.length) {
      return Promise.reject(new Error("Typed AmmoJS module unavailable"));
    }

    return import(typedModules[index])
      .then((module) => {
        if (typeof module.default === "function") {
          return module.default();
        }
        if (typeof module.Ammo === "function") {
          return module.Ammo();
        }
        if (module.default && typeof module.default.Ammo === "function") {
          return module.default.Ammo();
        }
        throw new Error("AmmoJS module is not available in the expected format");
      })
      .catch(() => tryTypedModule(index + 1));
  };

  const loadFromScript = () =>
    new Promise((resolve, reject) => {
      const existing = globalThis.Ammo;
      if (typeof existing === "function") {
        existing().then(resolve).catch(reject);
        return;
      }

      const script = document.createElement("script");
      script.src = "https://cdn.babylonjs.com/ammo.js";
      script.async = true;
      script.onload = () => {
        const ammoFactory = globalThis.Ammo;
        if (typeof ammoFactory === "function") {
          ammoFactory().then(resolve).catch(reject);
        } else if (ammoFactory) {
          resolve(ammoFactory);
        } else {
          reject(new Error("Ammo global was not initialised"));
        }
      };
      script.onerror = () => reject(new Error("Failed to load AmmoJS script"));
      document.head.appendChild(script);
    });

  return tryTypedModule().catch(() => loadFromScript());
}

function resetBall() {
  const { xPos } = positionBallOnRails(0);
  ball.state = "ready";
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

function initialisePhysics() {
  return loadAmmoModule()
    .then((ammo) => {
      const plugin = new AmmoJSPlugin(true, ammo);
      scene.enablePhysics(new Vector3(0, -geometry.gravityBase, 0), plugin);
      const enginePhysics = scene.getPhysicsEngine();
      enginePhysics?.setTimeStep(1 / 240);
      if (plugin.setSubTimeStep) {
        plugin.setSubTimeStep(1 / 480);
      }

      const material = new PhysicsMaterial();
      material.friction = 0.68;
      material.restitution = 0.02;
      material.rollingFriction = 0.06;

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

      resetBall();
    })
    .catch((error) => {
      console.error("Babylon physics failed to initialise", error);
      physicsState.ready = false;
      resetBall();
    });
}

function syncRailBodies(dtSeconds) {
  if (!physicsState.ready) {
    return;
  }

  const enginePhysics = scene.getPhysicsEngine?.();
  const step = enginePhysics?.getTimeStep?.() ?? dtSeconds;
  const leftBody = physicsState.leftAggregate?.body;
  const rightBody = physicsState.rightAggregate?.body;

  if (leftBody) {
    const { position, rotation } = getWorldTransform(leftRailCollider);
    leftBody.setTargetTransform?.(position, rotation, step);
  }

  if (rightBody) {
    const { position, rotation } = getWorldTransform(rightRailCollider);
    rightBody.setTargetTransform?.(position, rotation, step);
  }
}

function updateScoreReadout() {
  scoreValue.textContent = `${physicsState.displacement.toFixed(3)} m`;
}

function recordDropEvent() {
  physicsState.events.push({
    type: "drop",
    displacement: physicsState.displacement,
    separation: physicsState.dropSeparation,
    timestamp: performance.now(),
  });
  state.score = physicsState.displacement;
  updateScoreReadout();
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
  const leftX = getRailX(geometry, state, progress, "left");
  const rightX = getRailX(geometry, state, progress, "right");
  physicsState.dropSeparation = rightX - leftX;

  updateScoreReadout();

  if (
    !physicsState.dropTriggered &&
    (physicsState.dropSeparation - geometry.ballRadius * 2 > 0.0005 ||
      position.z < geometry.dropPlaneZ)
  ) {
    physicsState.dropTriggered = true;
    ball.state = "resetting";
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

  if (ball.state === "resetting") {
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

resetBall();
updateRailMeshes();

alignColliderToRail(leftRailCollider, "left");
alignColliderToRail(rightRailCollider, "right");

const physicsReadyPromise = initialisePhysics();

timing.lastTick = performance.now();
engine.runRenderLoop(updateFrame);

debugInterface.ready = true;

window.addEventListener("resize", () => {
  engine.resize();
  updateTilt(tiltSlider.value);
});

