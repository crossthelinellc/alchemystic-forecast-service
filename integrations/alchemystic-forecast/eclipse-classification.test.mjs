import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyAlchemysticEclipse } from './eclipse-classification.mjs';

function positions({ sun = 100, moon = 100, north = 102, south = 282 } = {}) {
  return [
    { key: 'sun', longitude: sun }, { key: 'moon', longitude: moon },
    { key: 'mean_north_node', longitude: north }, { key: 'mean_south_node', longitude: south },
  ];
}

test('classifies the Node nearest the Moon with the Sun-led 3/10/13 degree thresholds', () => {
  assert.equal(classifyAlchemysticEclipse({ phase: 'New Moon', positions: positions({ north: 2.9 + 100 }) }).title, 'True Northern Solar Eclipse');
  assert.equal(classifyAlchemysticEclipse({ phase: 'New Moon', positions: positions({ north: 106 }) }).title, 'Forced Northern Solar Eclipse');
  assert.equal(classifyAlchemysticEclipse({ phase: 'New Moon', positions: positions({ north: 112 }) }).title, 'Fringe Northern Solar Eclipse');
  assert.equal(classifyAlchemysticEclipse({ phase: 'New Moon', positions: positions({ north: 114 }) }), null);
});

test('uses the Node on the Moon side of a Full Moon opposition', () => {
  const result = classifyAlchemysticEclipse({
    phase: 'Full Moon',
    positions: positions({ sun: 100, moon: 280, north: 101, south: 281 }),
  });
  assert.equal(result.title, 'True Southern Lunar Eclipse');
  assert.equal(result.relevantNodeKey, 'mean_south_node');
  assert.equal(result.nodeAxis[0].highlighted, true);
});
