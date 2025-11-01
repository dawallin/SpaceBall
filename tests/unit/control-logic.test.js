import { test, expect } from '@jest/globals';
import {
  clamp,
  normalizedToOffset,
  sliderValueToTilt,
  tiltToAcceleration,
  getRailX,
  createPocketLayouts,
} from '../../src/control-logic.js';
import { createGeometryModel } from '../../src/geometry.js';

const geometry = createGeometryModel();

test('normalized touch offsets clamp to rail travel', () => {
  expect(normalizedToOffset(0, geometry.railTravel)).toBe(-geometry.railTravel);
  expect(normalizedToOffset(1, geometry.railTravel)).toBe(geometry.railTravel);
  expect(normalizedToOffset(0.5, geometry.railTravel)).toBe(0);
  expect(normalizedToOffset(-0.2, geometry.railTravel)).toBe(-geometry.railTravel);
  expect(normalizedToOffset(1.5, geometry.railTravel)).toBe(geometry.railTravel);
});

test('slider values map to the configured tilt range', () => {
  expect(sliderValueToTilt(0)).toBe(8);
  expect(sliderValueToTilt(100)).toBe(28);
  expect(sliderValueToTilt(50)).toBe(18);
});

test('tilt acceleration scales with the tilt angle', () => {
  const gentle = tiltToAcceleration(10);
  const steep = tiltToAcceleration(25);
  expect(steep).toBeGreaterThan(gentle);
});

test('rod angles pivot the rails symmetrically', () => {
  geometry.updateAdjustables({ h: geometry.adjustable.h, d: geometry.adjustable.d });
  geometry.updateAngles({ thetaL: geometry.rodAngleRange, thetaR: -geometry.rodAngleRange });
  const leftFront = getRailX(geometry, {}, 0, 'left');
  const rightFront = getRailX(geometry, {}, 0, 'right');
  expect(leftFront).toBeLessThan(rightFront);

  const leftBack = getRailX(geometry, {}, 1, 'left');
  const rightBack = getRailX(geometry, {}, 1, 'right');
  expect(leftBack).toBeLessThan(rightBack);

  geometry.updateAngles({ thetaL: -geometry.rodAngleRange, thetaR: geometry.rodAngleRange });
  const newLeftFront = getRailX(geometry, {}, 0, 'left');
  const newRightFront = getRailX(geometry, {}, 0, 'right');
  expect(newLeftFront).toBeLessThan(newRightFront);
});

test('pocket layouts follow the planetary ordering', () => {
  const pockets = createPocketLayouts(geometry);
  expect(pockets).toHaveLength(7);
  const names = pockets.map((pocket) => pocket.name);
  expect(names).toEqual(['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Pluto']);
  const laneX = pockets.slice(0, -1).map((pocket) => pocket.x);
  const sortedX = [...laneX].sort((a, b) => a - b);
  expect(laneX).toEqual(sortedX);
  expect(pockets[pockets.length - 1].x).toBeCloseTo(0, 5);
  const highlighted = pockets.filter((pocket) => pocket.highlight === true);
  expect(highlighted).toHaveLength(1);
  expect(highlighted[0].name).toBe('Pluto');
});

test('clamp confines values within the provided range', () => {
  expect(clamp(5, 0, 10)).toBe(5);
  expect(clamp(-5, 0, 10)).toBe(0);
  expect(clamp(20, 0, 10)).toBe(10);
});
