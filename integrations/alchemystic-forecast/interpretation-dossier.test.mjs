import assert from 'node:assert/strict';
import test from 'node:test';

import {
  INTERPRETATION_DOSSIER_SCHEMA,
  buildAspectArcDossier,
  buildWeeklyInterpretationDossiers,
} from './interpretation-dossier.mjs';

const arc = {
  key: 'pallas:square:mercury',
  planetOne: 'pallas',
  aspect: 'square',
  planetTwo: 'mercury',
  moments: {
    activating: '2026-08-01T12:00:00.000Z',
    pointOfExactitude: '2026-08-03T12:00:00.000Z',
    releasing: '2026-08-05T12:00:00.000Z',
  },
  events: [
    { type: 'true_aspect_activation', contact: 'forced', forcedBy: 'mercury' },
    { type: 'point_of_exactitude', contact: 'direct' },
    { type: 'aspect_release', contact: 'forced', forcedBy: 'mercury' },
  ],
};

const positions = [
  { key: 'pallas', longitude: 0, speed: 0.2 },
  { key: 'mercury', longitude: 90, speed: 1.1 },
  { key: 'mars', longitude: 15, speed: 0.5 },
  { key: 'moon', longitude: 110, speed: 13 },
  { key: 'uranus', longitude: 65, speed: 0.01 },
  { key: 'saturn', longitude: 165, speed: -0.04 },
];

const positionProvider = async () => ({ positions });

test('builds a calculation-only dossier across the complete Aspect Arc', async () => {
  const dossier = await buildAspectArcDossier({ arc, positionProvider });

  assert.equal(dossier.id, 'pallas:square:mercury:2026-08-03T12:00:00.000Z');
  assert.equal(dossier.status, 'calculation_ready_for_editorial_review');
  assert.equal(dossier.arc.handoff.before, 'pallas_to_mercury');
  assert.equal(dossier.arc.handoff.after, 'mercury_to_pallas');
  assert.equal(dossier.phases.activating.direction, 'pallas_to_mercury');
  assert.deepEqual(dossier.phases.pointOfExactitude.direction, {
    from: 'pallas_to_mercury',
    to: 'mercury_to_pallas',
    event: 'directional_handoff',
  });
  assert.equal(dossier.phases.releasing.direction, 'mercury_to_pallas');
  assert.equal(dossier.phases.releasing.sampleTimestamp, '2026-08-05T11:59:00.000Z');
  assert.equal(dossier.phases.activating.contact.type, 'Forced Aspect');
  assert.equal(dossier.phases.pointOfExactitude.contact.type, 'True Aspect');
  assert.equal(dossier.phases.releasing.contact.type, 'Forced Aspect');

  for (const phase of Object.values(dossier.phases)) {
    assert.equal(phase.planetOne.body, 'pallas');
    assert.equal(phase.planetTwo.body, 'mercury');
    assert.deepEqual(
      phase.planetTwo.dualRulership.fields.map(({ sign, expression }) => ({ sign, expression })),
      [
        { sign: 'gemini', expression: 'inferior_mercury' },
        { sign: 'virgo', expression: 'superior_mercury' },
      ],
    );
    assert.ok(Array.isArray(phase.thematicLayers.with));
    assert.ok(Array.isArray(phase.thematicLayers.while));
  }

  assert.equal(dossier.editorialContract.orderedReading[0].step, 'planet_one_condition');
  assert.equal(dossier.editorialContract.orderedReading[1].step, 'planet_two_condition');
  assert.equal(dossier.editorialContract.orderedReading[2].step, 'ordered_aspect_synthesis');
  assert.ok(dossier.editorialContract.prohibitions.includes('isolated_aspect_interpretation'));
  assert.equal('interpretation' in dossier, false);
});

test('keeps Point of Exactitude as the True Aspect nucleus even for a one-sided OOI arc', async () => {
  const oneSidedArc = {
    ...arc,
    events: arc.events.map((event) => (
      event.type === 'point_of_exactitude'
        ? { ...event, contact: 'forced', forcedBy: 'mercury' }
        : event
    )),
  };
  const dossier = await buildAspectArcDossier({ arc: oneSidedArc, positionProvider });

  assert.deepEqual(dossier.phases.pointOfExactitude.contact, {
    type: 'True Aspect',
    forcedBy: null,
  });
});

test('queues only complete Aspect Arcs with a phase moment in the weekly editorial window', async () => {
  const futureArc = {
    ...arc,
    key: 'venus:square:mars',
    planetOne: 'venus',
    planetTwo: 'mars',
    moments: {
      activating: '2026-08-20T12:00:00.000Z',
      pointOfExactitude: '2026-08-22T12:00:00.000Z',
      releasing: '2026-08-24T12:00:00.000Z',
    },
  };
  const dossiers = await buildWeeklyInterpretationDossiers({
    forecast: {
      generatedAt: '2026-08-01T06:00:00.000Z',
      arcs: [arc, futureArc, { ...arc, key: 'incomplete', moments: { ...arc.moments, releasing: null } }],
    },
    positionProvider,
    now: '2026-08-01T05:00:00.000Z',
  });

  assert.equal(dossiers.schema, INTERPRETATION_DOSSIER_SCHEMA);
  assert.equal(dossiers.window.days, 7);
  assert.equal(dossiers.window.selection, 'phase_moment_in_window');
  assert.equal(dossiers.window.moonPolicy, 'separate_lunar_calendar');
  assert.deepEqual(dossiers.records.map(({ id }) => id), [
    'pallas:square:mercury:2026-08-03T12:00:00.000Z',
  ]);
  assert.deepEqual(dossiers.records[0].weeklyAttention, [
    { phase: 'activating', timestamp: '2026-08-01T12:00:00.000Z' },
    { phase: 'pointOfExactitude', timestamp: '2026-08-03T12:00:00.000Z' },
    { phase: 'releasing', timestamp: '2026-08-05T12:00:00.000Z' },
  ]);
});

test('keeps lunar contacts and background-only arcs out of the weekly editorial queue', async () => {
  const lunarArc = { ...arc, key: 'moon:square:mercury', planetOne: 'moon' };
  const backgroundArc = {
    ...arc,
    key: 'saturn:trine:sun',
    planetOne: 'saturn',
    aspect: 'trine',
    planetTwo: 'sun',
    moments: {
      activating: '2026-07-01T12:00:00.000Z',
      pointOfExactitude: '2026-07-15T12:00:00.000Z',
      releasing: '2026-08-20T12:00:00.000Z',
    },
  };
  const dossiers = await buildWeeklyInterpretationDossiers({
    forecast: { generatedAt: '2026-08-01T06:00:00.000Z', arcs: [arc, lunarArc, backgroundArc] },
    positionProvider,
    now: '2026-08-01T05:00:00.000Z',
  });

  assert.deepEqual(dossiers.records.map(({ id }) => id), [
    'pallas:square:mercury:2026-08-03T12:00:00.000Z',
  ]);
});
