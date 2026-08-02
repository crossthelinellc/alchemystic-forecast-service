import assert from 'node:assert/strict';
import test from 'node:test';

import { buildForecastFeed, hasCompleteInterpretationMethod } from './forecast-feed.mjs';
import {
  buildFoundationalTranslations,
  foundationalTranslationForDossier,
} from './foundational-translation.mjs';
import { buildAspectArcDossier } from './interpretation-dossier.mjs';

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
    { type: 'true_aspect_activation', contact: 'forced', toContact: 'forced', forcedBy: 'mercury' },
    { type: 'point_of_exactitude', contact: 'direct' },
    { type: 'aspect_release', contact: 'forced', fromContact: 'forced', forcedBy: 'mercury' },
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

test('builds a complete foundational translation from both assessed planetary conditions', async () => {
  const dossier = await buildAspectArcDossier({ arc, positionProvider });
  const translation = foundationalTranslationForDossier(dossier);

  assert.equal(translation.tier, 'foundational');
  assert.match(translation.interpretation, /Pallas is in Aries/);
  assert.match(translation.interpretation, /Mercury is in Cancer/);
  assert.match(translation.interpretation, /Square is synchronizing pressure/);
  assert.match(translation.interpretation, /Mercury must also be read through both signs it rules/);
  assert.match(translation.interpretation, /hands off from Pallas → Mercury to Mercury → Pallas/);
  assert.match(translation.alignment, /Support Mercury's needs/);
  assert.match(translation.conditionSummary, /active channels/);
  assert.match(translation.conditionSummary, /connected With layer/);
  assert.equal(hasCompleteInterpretationMethod(arc, translation.method, dossier.id), true);
});

test('generates translations for complete non-lunar arcs and keeps lunar contacts separate', async () => {
  const lunarArc = {
    ...arc,
    key: 'moon:square:mercury',
    planetOne: 'moon',
  };
  const translations = await buildFoundationalTranslations({
    forecast: { arcs: [arc, lunarArc] },
    positionProvider,
  });

  assert.deepEqual(Object.keys(translations), [
    'pallas:square:mercury:2026-08-03T12:00:00.000Z',
  ]);

  const feed = buildForecastFeed({
    forecast: {
      generatedAt: '2026-08-01T12:00:00.000Z',
      window: { start: '2026-08-01T12:00:00.000Z' },
      arcs: [arc],
    },
    interpretations: translations,
    now: '2026-08-01T12:00:00.000Z',
  });
  assert.equal(feed.calendar.records[0].hasInterpretation, true);
  assert.equal(feed.calendar.records[0].interpretationTier, 'foundational');
  assert.equal(feed.week.length, 0);
});
