/**
 * SpaceBall geometry model.
 *
 * Coordinate system:
 * - Origin (0, 0, 0) sits on the board floor at the longitudinal midpoint between the rods.
 * - The X axis runs left (negative) to right (positive) across the board.
 * - The Y axis runs from the player/front edge (positive) toward the back/top wall (negative).
 * - The Z axis points upward from the floor (positive values are above the board surface).
 *
 * All distances are expressed in metres; helper constants expose centimetre conversions
 * because the industrial diagrams are annotated in centimetres.
 */

export const CM = 0.01;

export const ROD_LENGTH = 27 * CM;
export const ROD_MIDPOINT_HEIGHT = 3.6 * CM;
export const ROD_ANGLE_LIMIT_DEG = 15;
export const ROD_CLEARANCE = 0.75 * CM;

export const H_RANGE = Object.freeze({ min: 0, max: 5 * CM });
export const D_RANGE = Object.freeze({ min: 2 * CM, max: 6 * CM });

export const BOARD_DIMENSIONS = Object.freeze({
  width: 42 * CM,
  depth: 58 * CM,
  floorZ: 0,
  rodMidlineY: -4 * CM,
  topWallHeight: 12 * CM,
  floorThickness: 1.8 * CM,
  backWallThickness: 1.2 * CM,
  clearanceX: 1.25 * CM,
});

export const DEFAULT_PARAMETERS = Object.freeze({
  h: 3 * CM,
  d: 4.2 * CM,
  thetaL: 0,
  thetaR: 0,
});

function clamp(value, min, max) {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

function radToDeg(rad) {
  return (rad * 180) / Math.PI;
}

function rotateAroundZ({ x, y, z }, angleRad) {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos,
    z,
  };
}

function addVec3(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function clampRodAngle(rad, { d, yHalf, midpoint, board }) {
  const baseLimit = degToRad(ROD_ANGLE_LIMIT_DEG);
  const margin = board.clearanceX ?? 0;
  const usableWidth = board.width / 2 - Math.abs(midpoint.x) - margin;
  const limitByBoard = usableWidth > 0 ? Math.asin(Math.min(usableWidth / yHalf, 1)) : 0;
  const spacingAllowance = d / 2 - ROD_CLEARANCE;
  const limitBySpacing = spacingAllowance > 0 ? Math.asin(Math.min(spacingAllowance / yHalf, 1)) : 0;
  const limit = Math.max(0, Math.min(baseLimit, limitByBoard || baseLimit, limitBySpacing || baseLimit));
  return clamp(rad, -limit, limit);
}

export function computeRodEndpoints(side, {
  h,
  d,
  angleDeg,
  board = BOARD_DIMENSIONS,
} = {}) {
  if (side !== 'left' && side !== 'right') {
    throw new Error(`Invalid rod side "${side}". Expected "left" or "right".`);
  }

  const hClamped = clamp(Number(h) || 0, H_RANGE.min, H_RANGE.max);
  const dClamped = clamp(Number(d) || 0, D_RANGE.min, D_RANGE.max);
  const rawAngle = Number(angleDeg) || 0;
  const midpoint = {
    x: side === 'left' ? -dClamped / 2 : dClamped / 2,
    y: board.rodMidlineY,
    z: board.floorZ + ROD_MIDPOINT_HEIGHT,
  };

  const projectedLength = Math.max(ROD_LENGTH * ROD_LENGTH - hClamped * hClamped, 0);
  const deltaY = Math.sqrt(projectedLength);
  const yHalf = deltaY / 2;

  const baseFront = { x: 0, y: yHalf, z: -hClamped / 2 };
  const baseBack = { x: 0, y: -yHalf, z: hClamped / 2 };

  const limitedRad = clampRodAngle(degToRad(rawAngle), { d: dClamped, yHalf, midpoint, board });
  const limitedDeg = radToDeg(limitedRad);

  const rotatedFront = rotateAroundZ(baseFront, limitedRad);
  const rotatedBack = rotateAroundZ(baseBack, limitedRad);

  const front = addVec3(midpoint, rotatedFront);
  const back = addVec3(midpoint, rotatedBack);

  return {
    side,
    length: ROD_LENGTH,
    heightDifference: hClamped,
    spacing: dClamped,
    angle: {
      deg: limitedDeg,
      rad: limitedRad,
      inputDeg: rawAngle,
    },
    midpoint,
    front,
    back,
    deltaY,
  };
}

export function getRodPoint(rod, progress) {
  const t = clamp(Number(progress) || 0, 0, 1);
  const dx = rod.back.x - rod.front.x;
  const dy = rod.back.y - rod.front.y;
  const dz = rod.back.z - rod.front.z;
  return {
    x: rod.front.x + dx * t,
    y: rod.front.y + dy * t,
    z: rod.front.z + dz * t,
  };
}

export function createScoringTargets(board = BOARD_DIMENSIONS) {
  const laneNames = ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn'];
  const laneSpacing = board.width / (laneNames.length + 1);
  const targets = laneNames.map((label, index) => {
    const x = -board.width / 2 + laneSpacing * (index + 1);
    return {
      label,
      score: (index + 1) * 50,
      center: {
        x,
        y: -board.depth / 2 - 4 * CM,
        z: board.floorZ + board.floorThickness + 0.8 * CM,
      },
    };
  });

  targets.push({
    label: 'Pluto',
    score: 400,
    center: {
      x: 0,
      y: -board.depth / 2 - 8 * CM,
      z: board.floorZ + board.floorThickness + 0.6 * CM,
    },
  });

  return targets;
}

export function createGeometryModel(initial = {}) {
  const parameters = {
    h: DEFAULT_PARAMETERS.h,
    d: DEFAULT_PARAMETERS.d,
    thetaL: DEFAULT_PARAMETERS.thetaL,
    thetaR: DEFAULT_PARAMETERS.thetaR,
    ...initial,
  };

  const model = {
    origin: { x: 0, y: 0, z: BOARD_DIMENSIONS.floorZ },
    board: { ...BOARD_DIMENSIONS },
    rods: {
      left: null,
      right: null,
    },
    adjustable: {
      h: 0,
      d: 0,
    },
    angles: {
      leftDeg: 0,
      rightDeg: 0,
    },
    topY: 0,
    bottomY: 0,
    railRadius: 0.0055,
    ballRadius: 0.019,
    dropStartZ: BOARD_DIMENSIONS.floorZ + ROD_MIDPOINT_HEIGHT,
    railDropLength: 0.16,
    dropFloorZ: BOARD_DIMENSIONS.floorZ - 0.12,
    dropPlaneZ: BOARD_DIMENSIONS.floorZ - 0.02,
    boardThickness: 0.018,
    boardOffsetZ: BOARD_DIMENSIONS.floorZ - 0.024,
    pocketRadius: 0.018,
    railLengthY: 0,
    scoringTargets: [],
    debug: {
      lines: [],
      points: [],
    },
    rodAngleRange: ROD_ANGLE_LIMIT_DEG,
    railTravel: ROD_ANGLE_LIMIT_DEG,
    centerX: 0,
    boardWidth: BOARD_DIMENSIONS.width,
    boardHeight: BOARD_DIMENSIONS.depth,
    supportRadius: 0.0038,
    supportDropZ: BOARD_DIMENSIONS.floorZ - 0.08,
    ballStartZ: BOARD_DIMENSIONS.floorZ + ROD_MIDPOINT_HEIGHT,
    gravityBase: 9.81,
    updateAdjustables(update) {
      if (!update) return;
      if (typeof update.h !== 'undefined') {
        parameters.h = clamp(Number(update.h) || 0, H_RANGE.min, H_RANGE.max);
      }
      if (typeof update.d !== 'undefined') {
        parameters.d = clamp(Number(update.d) || 0, D_RANGE.min, D_RANGE.max);
      }
      recompute();
    },
    updateAngles({ thetaL, thetaR } = {}) {
      if (typeof thetaL !== 'undefined') {
        parameters.thetaL = clamp(Number(thetaL) || 0, -ROD_ANGLE_LIMIT_DEG, ROD_ANGLE_LIMIT_DEG);
      }
      if (typeof thetaR !== 'undefined') {
        parameters.thetaR = clamp(Number(thetaR) || 0, -ROD_ANGLE_LIMIT_DEG, ROD_ANGLE_LIMIT_DEG);
      }
      recompute();
    },
    getRod(side) {
      return side === 'left' ? model.rods.left : model.rods.right;
    },
    getRodPoint(side, progress) {
      const rod = model.getRod(side);
      return getRodPoint(rod, progress);
    },
  };

  function updateDebug() {
    const left = model.rods.left;
    const right = model.rods.right;
    model.debug.lines = [
      { points: [left.front, left.back], label: 'left-rod' },
      { points: [right.front, right.back], label: 'right-rod' },
      {
        points: [
          { x: -model.board.width / 2, y: model.board.depth / 2, z: model.board.floorZ },
          { x: model.board.width / 2, y: model.board.depth / 2, z: model.board.floorZ },
          { x: model.board.width / 2, y: -model.board.depth / 2, z: model.board.floorZ },
          { x: -model.board.width / 2, y: -model.board.depth / 2, z: model.board.floorZ },
          { x: -model.board.width / 2, y: model.board.depth / 2, z: model.board.floorZ },
        ],
        label: 'board-floor-outline',
      },
      {
        points: [
          { x: -model.board.width / 2, y: -model.board.depth / 2, z: model.board.floorZ },
          { x: -model.board.width / 2, y: -model.board.depth / 2, z: model.board.floorZ + model.board.topWallHeight },
        ],
        label: 'top-wall-left',
      },
      {
        points: [
          { x: model.board.width / 2, y: -model.board.depth / 2, z: model.board.floorZ },
          { x: model.board.width / 2, y: -model.board.depth / 2, z: model.board.floorZ + model.board.topWallHeight },
        ],
        label: 'top-wall-right',
      },
    ];

    model.debug.points = [
      { position: left.front, label: 'left-front' },
      { position: left.back, label: 'left-back' },
      { position: right.front, label: 'right-front' },
      { position: right.back, label: 'right-back' },
    ];
  }

  function recompute() {
    const leftRod = computeRodEndpoints('left', {
      h: parameters.h,
      d: parameters.d,
      angleDeg: parameters.thetaL,
      board: model.board,
    });
    const rightRod = computeRodEndpoints('right', {
      h: parameters.h,
      d: parameters.d,
      angleDeg: parameters.thetaR,
      board: model.board,
    });

    model.rods.left = leftRod;
    model.rods.right = rightRod;
    model.adjustable.h = parameters.h;
    model.adjustable.d = parameters.d;
    model.angles.leftDeg = leftRod.angle.deg;
    model.angles.rightDeg = rightRod.angle.deg;
    model.topY = Math.max(leftRod.front.y, rightRod.front.y);
    model.bottomY = Math.min(leftRod.back.y, rightRod.back.y);
    model.railLengthY = (leftRod.deltaY + rightRod.deltaY) / 2;
    model.scoringTargets = createScoringTargets(model.board);
    updateDebug();
  }

  recompute();
  return model;
}

export function getRailX(model, state, progress, side) {
  const rod = model.getRod(side);
  const point = getRodPoint(rod, progress);
  return point.x;
}

export function createDebugOverlayData(model) {
  return model.debug;
}

export function getBoardTopWall(model) {
  // Top wall: single vertical segment at the back center
  // Axis convention: x = left–right, y = front–back, z = height
  const y = -model.board.depth / 2;
  return {
    start: { x: 0, y, z: model.board.floorZ },
    end:   { x: 0, y, z: model.board.floorZ + model.board.topWallHeight },
  };
}

export function getRodClearance(model) {
  const separationFront = model.rods.right.front.x - model.rods.left.front.x;
  const separationBack = model.rods.right.back.x - model.rods.left.back.x;
  return Math.min(separationFront, separationBack);
}

export { clamp };
