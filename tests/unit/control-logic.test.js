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

describe('control logic helpers', () => {
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

  test('rail positions respect independent offsets', () => {
    const state = { ...baseState, leftOffset: geometry.railTravel, rightOffset: -geometry.railTravel };
    const leftBottom = getRailX(geometry, state, 1, 'left');
    const rightBottom = getRailX(geometry, state, 1, 'right');
    expect(leftBottom).toBeGreaterThan(geometry.centerX - geometry.railBottomSpread / 2);
    expect(rightBottom).toBeLessThan(geometry.centerX + geometry.railBottomSpread / 2);

    const clampedLeft = getRailX(
      geometry,
      { ...state, leftOffset: geometry.railTravel * 2 },
      1,
      'left'
    );
    expect(clampedLeft).toBe(leftBottom);
  });

  test('pocket layouts stay centred and ordered', () => {
    const pockets = createPocketLayouts({ ...geometry, bottomY: 500 });
    expect(pockets).toHaveLength(6);
    pockets.forEach((pocket) => {
      expect(pocket.x).toBe(geometry.centerX);
    });
    const names = pockets.map((pocket) => pocket.name);
    expect(names).toEqual(['Mercury', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Pluto']);
    for (let i = 1; i < pockets.length; i += 1) {
      expect(pockets[i].y).toBeGreaterThan(pockets[i - 1].y);
    }
    const highlighted = pockets.filter((pocket) => pocket.highlight === true);
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0].name).toBe('Pluto');
  });

  test('clamp confines values within the provided range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(20, 0, 10)).toBe(10);
  });
});
