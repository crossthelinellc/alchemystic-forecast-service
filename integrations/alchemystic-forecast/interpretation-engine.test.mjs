import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildInterpretationPlan,
  buildUniversalInterpretation,
  groupAspectArcs,
  zodiacPlacement,
} from './interpretation-engine.mjs';

test('uses modern rulership and treats the sign as a through point', () => {
  assert.deepEqual(zodiacPlacement(301.5), {
    sign: 'aquarius',
    signLabel: 'Aquarius',
    signRuler: 'uranus',
    degreeInSign: 1.5,
    longitude: 301.5,
  });
});

test('creates a mandatory ordered plan before forecast prose can be written', () => {
  const context = buildUniversalInterpretation({
    focus: ['pallas', 'mercury'],
    positions: [
      { key: 'pallas', longitude: 222, speed: 0.2 },
      { key: 'mercury', longitude: 312, speed: 1.1 },
      { key: 'pluto', longitude: 309, speed: 0.02 },
      { key: 'uranus', longitude: 65, speed: 0.01 },
    ],
  });
  const plan = buildInterpretationPlan({
    context,
    arc: {
      moments: {
        activating: '2026-08-01T12:00:00Z',
        pointOfExactitude: '2026-08-03T12:00:00Z',
        releasing: '2026-08-05T12:00:00Z',
      },
    },
  });

  assert.equal(plan.orderedReading[0].step, 'planet_one_condition');
  assert.equal(plan.orderedReading[1].step, 'planet_two_condition');
  assert.equal(plan.requiredMoments.pointOfExactitude.from, 'pallas_to_mercury');
  assert.equal(plan.requiredMoments.pointOfExactitude.to, 'mercury_to_pallas');
  assert.ok(plan.prohibitions.includes('isolated_aspect_interpretation'));
});

test('assesses each focus planet, its channels, and its ruler before interpretation', () => {
  const result = buildUniversalInterpretation({
    focus: ['pallas', 'mercury'],
    positions: [
      { key: 'pallas', longitude: 222, speed: 0.2 },
      { key: 'mercury', longitude: 312, speed: 1.1 },
      { key: 'pluto', longitude: 309, speed: 0.02 },
      { key: 'uranus', longitude: 65, speed: 0.01 },
      { key: 'mars', longitude: 132, speed: 0.5 },
      { key: 'moon', longitude: 109.5, speed: 13 },
    ],
  });

  assert.equal(result.focus.planetOne, 'pallas');
  assert.equal(result.focus.planetTwo, 'mercury');
  assert.equal(result.focus.aspect, 'square');
  assert.equal(result.planetaryCondition.pallas.throughPoint.sign, 'scorpio');
  assert.equal(result.planetaryCondition.pallas.direction.ruler, 'pluto');
  assert.equal(result.planetaryCondition.mercury.throughPoint.sign, 'aquarius');
  assert.equal(result.planetaryCondition.mercury.direction.ruler, 'uranus');
  assert.ok(result.planetaryCondition.mercury.channels.some(({ planetOne, planetTwo }) => (
    planetOne === 'pluto' && planetTwo === 'mercury'
  )));
  assert.ok(result.thematicLayers.with.some(({ body }) => body === 'pluto'));
  assert.ok(result.thematicLayers.with.some(({ body }) => body === 'uranus'));
  assert.ok(result.thematicLayers.while.some(({ body }) => body === 'moon'));
});

test('keeps indirect aspect chains in the simultaneous while layer', () => {
  const result = buildUniversalInterpretation({
    focus: ['pallas', 'mercury'],
    positions: [
      { key: 'pallas', longitude: 222, speed: 0.2 },
      { key: 'mercury', longitude: 312, speed: 1.1 },
      { key: 'pluto', longitude: 309, speed: 0.02 },
      { key: 'uranus', longitude: 65, speed: 0.01 },
      { key: 'mars', longitude: 132, speed: 0.5 },
      { key: 'moon', longitude: 199, speed: 13 },
    ],
  });

  assert.ok(result.thematicLayers.with.some(({ body }) => body === 'mars'));
  assert.ok(result.thematicLayers.with.some(({ body }) => body === 'pluto'));
  assert.ok(result.thematicLayers.with.some(({ body }) => body === 'uranus'));
  assert.ok(result.thematicLayers.while.some(({ body }) => body === 'moon'));
});

test('keeps activating, exactitude handoff, and releasing together on one arc', () => {
  const arcs = groupAspectArcs([
    { type: 'point_of_exactitude', timestamp: '2026-08-03T12:00:00Z', planetOne: 'pallas', planetTwo: 'mercury', aspect: 'square' },
    { type: 'aspect_release', timestamp: '2026-08-05T12:00:00Z', planetOne: 'pallas', planetTwo: 'mercury', aspect: 'square' },
    { type: 'true_aspect_activation', timestamp: '2026-08-01T12:00:00Z', planetOne: 'pallas', planetTwo: 'mercury', aspect: 'square' },
  ]);

  assert.equal(arcs.length, 1);
  assert.deepEqual(arcs[0].moments, {
    activating: '2026-08-01T12:00:00Z',
    pointOfExactitude: '2026-08-03T12:00:00Z',
    releasing: '2026-08-05T12:00:00Z',
  });
  assert.deepEqual(arcs[0].handoff, {
    before: 'pallas_to_mercury',
    after: 'mercury_to_pallas',
  });
});
