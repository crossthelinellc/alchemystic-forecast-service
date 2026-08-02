import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BODY_CATALOG,
  classifyContact,
  classifyRelationship,
  directedArc,
  nearestMajorAspect,
  normalizeLongitude,
} from './engine.mjs';

const body = (key, longitude, speed) => ({ key, longitude, speed });

test('normalizes longitudes to the 360-degree zodiac', () => {
  assert.equal(normalizeLongitude(361.5), 1.5);
  assert.equal(normalizeLongitude(-1.5), 358.5);
});
test('retains direction below the 180-degree Energy Flow Meridian', () => {
  const arc = directedArc(body('moon', 325.95, 13), body('chiron', 54.7, 0.05));
  assert.equal(arc.planetOne.key, 'moon');
  assert.equal(arc.planetTwo.key, 'chiron');
  assert.ok(Math.abs(arc.angle - 88.75) < 0.00001);
});

test('performs a directional handoff after crossing 180 degrees', () => {
  const arc = directedArc(body('sun', 10, 1), body('saturn', 200, 0.03));
  assert.equal(arc.planetOne.key, 'saturn');
  assert.equal(arc.planetTwo.key, 'sun');
  assert.equal(arc.angle, 170);
});

test('recognizes only the seven version-one major aspects', () => {
  assert.equal(nearestMajorAspect(28.75).key, 'semi_sextile');
  assert.equal(nearestMajorAspect(121.1).key, 'trine');
  assert.equal(nearestMajorAspect(149.5).key, 'quincunx');
});

test('keeps Forced contact separate from mutual direct and Fringe contact', () => {
  const moon = { key: 'moon', ...BODY_CATALOG.moon };
  const saturn = { key: 'saturn', ...BODY_CATALOG.saturn };

  assert.deepEqual(classifyContact(moon, saturn, 2), {
    kind: 'direct', directImpact: true, forcedBy: null,
  });
  assert.deepEqual(classifyContact(moon, saturn, 5), {
    kind: 'forced', directImpact: true, forcedBy: 'saturn',
  });
  assert.deepEqual(classifyContact(moon, saturn, 9), {
    kind: 'fringe', directImpact: false, forcedBy: null,
  });
});

test('treats entry into OOI as a strong True Aspect Activation event', () => {
  const relationship = classifyRelationship(
    [body('mercury', 20, 1.2), body('saturn', 88, 0.03)],
    [body('mercury', 21, 1.2), body('saturn', 88, 0.03)],
    [body('mercury', 22, 1.2), body('saturn', 88, 0.03)],
  );

  assert.equal(relationship.aspect.key, 'sextile');
  assert.equal(relationship.contact.kind, 'forced');
  assert.equal(relationship.phase, 'true_aspect_activation');
  assert.equal(relationship.flow, 'planet_one_to_planet_two');
});

test('changes flow after exactitude without reversing the aspect wording', () => {
  const relationship = classifyRelationship(
    [body('moon', 29, 13), body('saturn', 90, 0.03)],
    [body('moon', 31, 13), body('saturn', 90, 0.03)],
    [body('moon', 32, 13), body('saturn', 90, 0.03)],
  );

  assert.equal(relationship.planetOne.key, 'moon');
  assert.equal(relationship.planetTwo.key, 'saturn');
  assert.equal(relationship.phase, 'separating_aspect');
  assert.equal(relationship.flow, 'planet_two_pulls_planet_one');
});

test('mathematical points receive influence without projecting their own OOI', () => {
  const node = { key: 'mean_north_node', ...BODY_CATALOG.mean_north_node };
  const venus = { key: 'venus', ...BODY_CATALOG.venus };

  assert.deepEqual(classifyContact(node, venus, 4), {
    kind: 'forced', directImpact: true, forcedBy: 'venus',
  });
});

test('Mean Black Moon Lilith uses its author-confirmed 3° OOI', () => {
  const lilith = { key: 'mean_black_moon_lilith', ...BODY_CATALOG.mean_black_moon_lilith };
  const venus = { key: 'venus', ...BODY_CATALOG.venus };

  assert.equal(lilith.ooi, 3);
  assert.deepEqual(classifyContact(lilith, venus, 4), {
    kind: 'forced', directImpact: true, forcedBy: 'venus',
  });
  assert.deepEqual(classifyContact(lilith, venus, 3), {
    kind: 'direct', directImpact: true, forcedBy: null,
  });
});
