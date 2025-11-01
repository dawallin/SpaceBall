import { clamp, createScoringTargets, getRailX as modelRailX } from './geometry.js';

export { clamp };

export function normalizedToOffset(normalized, railTravel) {
  const clamped = clamp(Number(normalized) || 0, 0, 1);
  return (clamped - 0.5) * 2 * railTravel;
}

export function sliderValueToTilt(sliderValue, { minTilt = 8, maxTilt = 28 } = {}) {
  const ratio = clamp(Number(sliderValue) || 0, 0, 100) / 100;
  return minTilt + (maxTilt - minTilt) * ratio;
}

export function tiltToAcceleration(tiltDeg, gravityBase = 40) {
  return gravityBase * Math.sin((Number(tiltDeg) * Math.PI) / 180);
}

export function getRailX(geometry, state, yNorm, side) {
  return modelRailX(geometry, state, yNorm, side);
}

export function createPocketLayouts(geometry) {
  const radius = geometry.pocketRadius ?? 0.018;
  const targets = geometry.scoringTargets?.length
    ? geometry.scoringTargets
    : createScoringTargets(geometry.board);

  return targets.map((target) => ({
    name: target.label,
    label: target.label,
    score: target.score,
    radius: target.label === 'Pluto' ? radius * 1.3 : radius,
    x: target.center.x,
    y: target.center.y,
    z: target.center.z,
    highlight: target.label === 'Pluto',
  }));
}
