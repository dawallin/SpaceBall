import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clamp,
  normalizedToOffset,
  sliderValueToTilt,
  tiltToAcceleration,
  getRailX,
  createPocketLayouts,
} from '../../src/control-logic.js';

const geometry = {
  centerX: 180,
  railTopSpread: 34,
  railBottomSpread: 180,
  railTravel: 90,
  bottomY: 524,
  pocketRadius: 22,
};

const baseState = {
  leftOffset: 0,
  rightOffset: 0,
};

test('normalized touch offsets clamp to rail travel', () => {
  assert.equal(normalizedToOffset(0, geometry.railTravel), -geometry.railTravel);
  assert.equal(normalizedToOffset(1, geometry.railTravel), geometry.railTravel);
  assert.equal(normalizedToOffset(0.5, geometry.railTravel), 0);
  assert.equal(normalizedToOffset(-0.2, geometry.railTravel), -geometry.railTravel);
  assert.equal(normalizedToOffset(1.5, geometry.railTravel), geometry.railTravel);
});

test('slider values map to the configured tilt range', () => {
  assert.equal(sliderValueToTilt(0), 8);
  assert.equal(sliderValueToTilt(100), 28);
  assert.equal(sliderValueToTilt(50), 18);
});

test('tilt acceleration scales with the tilt angle', () => {
  const gentle = tiltToAcceleration(10);
  const steep = tiltToAcceleration(25);
  assert.ok(steep > gentle);
});

test('rail positions respect independent offsets', () => {
  const state = { ...baseState, leftOffset: geometry.railTravel, rightOffset: -geometry.railTravel };
  const leftBottom = getRailX(geometry, state, 1, 'left');
  const rightBottom = getRailX(geometry, state, 1, 'right');
  assert.ok(leftBottom > geometry.centerX - geometry.railBottomSpread / 2);
  assert.ok(rightBottom < geometry.centerX + geometry.railBottomSpread / 2);

  const clampedLeft = getRailX(
    geometry,
    { ...state, leftOffset: geometry.railTravel * 2 },
    1,
    'left'
  );
  assert.equal(clampedLeft, leftBottom);
});

test('pocket layouts stay centred and ordered', () => {
  const pockets = createPocketLayouts({ ...geometry, bottomY: 500 });
  assert.equal(pockets.length, 6);
  pockets.forEach((pocket) => {
    assert.equal(pocket.x, geometry.centerX);
  });
  const names = pockets.map((pocket) => pocket.name);
  assert.deepEqual(names, ['Mercury', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Pluto']);
  for (let i = 1; i < pockets.length; i += 1) {
    assert.ok(pockets[i].y > pockets[i - 1].y);
  }
  const highlighted = pockets.filter((pocket) => pocket.highlight === true);
  assert.equal(highlighted.length, 1);
  assert.equal(highlighted[0].name, 'Pluto');
});

test('clamp confines values within the provided range', () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-5, 0, 10), 0);
  assert.equal(clamp(20, 0, 10), 10);
});
