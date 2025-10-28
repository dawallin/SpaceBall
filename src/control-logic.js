export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

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
  const {
    centerX,
    railTopSpread,
    railBottomSpread,
    railTravel,
  } = geometry;
  const { leftOffset = 0, rightOffset = 0 } = state;
  const progress = clamp(Number(yNorm) || 0, 0, 1);
  const leftControl = clamp(leftOffset, -railTravel, railTravel);
  const rightControl = clamp(rightOffset, -railTravel, railTravel);
  const leftTop = centerX - railTopSpread / 2 + leftControl * 0.18;
  const rightTop = centerX + railTopSpread / 2 + rightControl * 0.18;
  const leftBottom = centerX - railBottomSpread / 2 + leftControl;
  const rightBottom = centerX + railBottomSpread / 2 + rightControl;

  if (side === "left") {
    return leftTop + (leftBottom - leftTop) * progress;
  }
  return rightTop + (rightBottom - rightTop) * progress;
}

export function createPocketLayouts(geometry) {
  const { centerX, bottomY, pocketRadius } = geometry;
  const baseY = bottomY - pocketRadius * 1.6;
  const spacing = pocketRadius * 2.4;

  return [
    { name: "Mercury", radius: pocketRadius, y: baseY, highlight: false },
    { name: "Earth", radius: pocketRadius, y: baseY - spacing, highlight: false },
    { name: "Mars", radius: pocketRadius, y: baseY - spacing * 2, highlight: false },
    { name: "Jupiter", radius: pocketRadius, y: baseY - spacing * 3, highlight: false },
    { name: "Saturn", radius: pocketRadius, y: baseY - spacing * 4, highlight: false },
    {
      name: "Pluto",
      radius: pocketRadius + 6,
      y: baseY - spacing * 5 - pocketRadius * 0.9,
      highlight: true,
    },
  ].map((pocket) => ({
    ...pocket,
    x: centerX,
  }));
}
