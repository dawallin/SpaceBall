import {
  clamp,
  normalizedToOffset,
  sliderValueToTilt,
  tiltToAcceleration,
  getRailX,
} from "./control-logic.js";

import {
  Engine,
  Scene,
  Vector3,
  ArcRotateCamera,
  HemisphericLight,
  MeshBuilder,
  Color3,
  Color4,
  StandardMaterial,
  TransformNode,
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
  topY: 3.2,
  bottomY: -4.4,
  ballRadius: 0.35,
  railTopSpread: 1.4,
  railBottomSpread: 3.6,
  railTravel: 1.2,
  railRadius: 0.11,
  gravityBase: 85,
  dropStartZ: 0,
  dropFloorZ: -5.6,
  dropGravity: 22,
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

const initialCameraSettings = {
  alpha: degToRad(cameraAlphaSlider?.value ?? 20),
  beta: degToRad(cameraBetaSlider?.value ?? 60),
  radius: Number(cameraZoomSlider?.value ?? 12),
};

const camera = new ArcRotateCamera(
  "camera",
  initialCameraSettings.alpha,
  initialCameraSettings.beta,
  initialCameraSettings.radius,
  new Vector3(0, -0.2, -1.6),
  scene
);
camera.lowerRadiusLimit = Number(cameraZoomSlider?.min ?? 9);
camera.upperRadiusLimit = Number(cameraZoomSlider?.max ?? 16);
camera.lowerBetaLimit = degToRad(cameraBetaSlider?.min ?? 35);
camera.upperBetaLimit = degToRad(cameraBetaSlider?.max ?? 110);
camera.wheelPrecision = 120;
camera.panningSensibility = 0;
camera.attachControl(canvas, false);
camera.inputs.clear();

function applyCameraSettings() {
  if (!cameraAlphaSlider || !cameraBetaSlider || !cameraZoomSlider) {
    return;
  }

  const alphaDeg = clamp(Number(cameraAlphaSlider.value) || 0, 0, 360);
  const betaDeg = clamp(
    Number(cameraBetaSlider.value) || 0,
    Number(cameraBetaSlider.min) || 35,
    Number(cameraBetaSlider.max) || 110
  );
  const zoom = clamp(
    Number(cameraZoomSlider.value) || 0,
    Number(cameraZoomSlider.min) || 9,
    Number(cameraZoomSlider.max) || 16
  );

  camera.alpha = degToRad(alphaDeg);
  camera.beta = degToRad(betaDeg);
  camera.radius = zoom;

  if (cameraAlphaReadout) {
    cameraAlphaReadout.textContent = `${Math.round(alphaDeg)}°`;
  }
  if (cameraBetaReadout) {
    cameraBetaReadout.textContent = `${Math.round(betaDeg)}°`;
  }
  if (cameraZoomReadout) {
    cameraZoomReadout.textContent = zoom.toFixed(1);
  }

  cameraAlphaSlider.value = String(alphaDeg);
  cameraBetaSlider.value = String(betaDeg);
  cameraZoomSlider.value = zoom.toFixed(1);

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

const initialLeftPath = [
  new Vector3(getRailX(geometry, state, 0, "left"), geometry.topY, 0),
  new Vector3(getRailX(geometry, state, 1, "left"), geometry.bottomY, 0),
];
let leftRail = MeshBuilder.CreateTube(
  "leftRail",
  { path: initialLeftPath, radius: geometry.railRadius, updatable: true },
  scene
);
leftRail.material = railMaterial;
leftRail.parent = boardPivot;

const initialRightPath = [
  new Vector3(getRailX(geometry, state, 0, "right"), geometry.topY, 0),
  new Vector3(getRailX(geometry, state, 1, "right"), geometry.bottomY, 0),
];
let rightRail = MeshBuilder.CreateTube(
  "rightRail",
  { path: initialRightPath, radius: geometry.railRadius, updatable: true },
  scene
);
rightRail.material = railMaterial;
rightRail.parent = boardPivot;

const ballMesh = MeshBuilder.CreateSphere(
  "ball",
  { diameter: geometry.ballRadius * 2 },
  scene
);
ballMesh.material = ballMaterial;
ballMesh.parent = boardPivot;

const ball = {
  progress: 0,
  velocity: 0,
  state: "ready",
  fallX: geometry.centerX,
  fallY: geometry.topY,
  fallZ: geometry.dropStartZ,
  dropVelocity: 0,
  resetTimer: 0,
  mesh: ballMesh,
};

function updateBoardTilt() {
  const normalizedTilt = clamp(
    (state.tilt - tiltBounds.min) / (tiltBounds.max - tiltBounds.min),
    0,
    1
  );
  const minAngle = Math.PI / 3.1;
  const maxAngle = Math.PI / 2.2;
  boardPivot.rotation.x = minAngle + (maxAngle - minAngle) * normalizedTilt;
}

updateBoardTilt();

function updateRailMeshes() {
  const leftPath = [
    new Vector3(getRailX(geometry, state, 0, "left"), geometry.topY, 0),
    new Vector3(getRailX(geometry, state, 1, "left"), geometry.bottomY, 0),
  ];
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

  const rightPath = [
    new Vector3(getRailX(geometry, state, 0, "right"), geometry.topY, 0),
    new Vector3(getRailX(geometry, state, 1, "right"), geometry.bottomY, 0),
  ];
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
}

function positionBallOnRails() {
  const clampedProgress = clamp(ball.progress, 0, 1);
  const yPos =
    geometry.topY + (geometry.bottomY - geometry.topY) * clampedProgress;
  const leftX = getRailX(geometry, state, clampedProgress, "left");
  const rightX = getRailX(geometry, state, clampedProgress, "right");
  const xPos = (leftX + rightX) / 2;

  ball.mesh.position.x = xPos;
  ball.mesh.position.y = yPos;
  ball.mesh.position.z = geometry.dropStartZ;
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
    return [];
  },
};

globalThis.__spaceBall = debugInterface;

bindTouchPad(leftPad, "left");
bindTouchPad(rightPad, "right");

function resetBall() {
  ball.progress = 0;
  ball.velocity = 0;
  ball.state = "ready";
  ball.fallX = geometry.centerX;
  ball.fallY = geometry.topY;
  ball.fallZ = geometry.dropStartZ;
  ball.dropVelocity = 0;
  ball.mesh.isVisible = true;
  positionBallOnRails();
}

function startScoreSequence(exitX) {
  state.score += 1;
  scoreValue.textContent = state.score;
  ball.state = "falling";
  ball.fallX = exitX;
  ball.fallY = geometry.bottomY;
  ball.fallZ = geometry.dropStartZ;
  ball.dropVelocity = 0;
  ball.mesh.position.x = exitX;
  ball.mesh.position.y = geometry.bottomY;
  ball.mesh.position.z = geometry.dropStartZ;
}

function updatePhysics(dt) {
  const dtSeconds = dt / 1000;
  const accelDown = tiltToAcceleration(state.tilt, geometry.gravityBase);
  const clampedProgress = clamp(ball.progress, 0, 1);
  const leftX = getRailX(geometry, state, clampedProgress, "left");
  const rightX = getRailX(geometry, state, clampedProgress, "right");
  const gap = rightX - leftX - geometry.ballRadius * 2;

  if (ball.state === "ready") {
    const openingThreshold = geometry.ballRadius * 0.6;
    const atStartGate = clampedProgress <= 0.01;

    if (gap > openingThreshold || atStartGate) {
      ball.velocity += accelDown * dtSeconds;
    } else {
      ball.velocity -= accelDown * 1.2 * dtSeconds;
    }

    ball.velocity *= 0.985;

    const span = Math.abs(geometry.bottomY - geometry.topY);
    ball.progress += (ball.velocity / span) * dtSeconds;

    if (ball.progress < 0) {
      ball.progress = 0;
      ball.velocity = 0;
    }

    if (ball.progress > 1) {
      ball.progress = 1;
    }

    const exitGap =
      getRailX(geometry, state, 1, "right") -
      getRailX(geometry, state, 1, "left") -
      geometry.ballRadius * 2;
    if (ball.progress >= 0.995 && exitGap > geometry.ballRadius * 0.8) {
      const exitX =
        (getRailX(geometry, state, 1, "left") +
          getRailX(geometry, state, 1, "right")) /
        2;
      startScoreSequence(exitX);
    }

    if (ball.progress > 0 && gap < geometry.ballRadius * 0.4 && ball.velocity > 0) {
      ball.velocity = Math.min(ball.velocity, 0);
    }

    positionBallOnRails();
  } else if (ball.state === "falling") {
    ball.dropVelocity += geometry.dropGravity * dtSeconds;
    ball.fallZ -= ball.dropVelocity * dtSeconds;
    if (ball.fallZ <= geometry.dropFloorZ) {
      ball.fallZ = geometry.dropFloorZ;
      ball.mesh.position.x = ball.fallX;
      ball.mesh.position.y = ball.fallY;
      ball.mesh.position.z = ball.fallZ;
      ball.velocity = 0;
      ball.state = "resetting";
      ball.resetTimer = 1.2;
      ball.mesh.isVisible = false;
    } else {
      ball.mesh.position.x = ball.fallX;
      ball.mesh.position.y = ball.fallY;
      ball.mesh.position.z = ball.fallZ;
    }
  } else if (ball.state === "resetting") {
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

  updatePhysics(delta);
  updateRailMeshes();
  scene.render();
}

resetBall();
updateRailMeshes();

timing.lastTick = performance.now();
engine.runRenderLoop(updateFrame);

debugInterface.ready = true;

window.addEventListener("resize", () => {
  engine.resize();
  updateTilt(tiltSlider.value);
});

