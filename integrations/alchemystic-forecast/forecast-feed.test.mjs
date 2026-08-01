import assert from 'node:assert/strict';
import test from 'node:test';

import { buildForecastFeed } from './forecast-feed.mjs';

const completeArc = {
  key: 'pallas:square:mercury',
  planetOne: 'pallas',
  planetTwo: 'mercury',
  aspect: 'square',
  moments: {
    activating: '2026-07-31T12:00:00Z',
    pointOfExactitude: '2026-08-02T12:00:00Z',
    releasing: '2026-08-05T12:00:00Z',
  },
  events: [
    { type: 'true_aspect_activation', contact: 'forced', toContact: 'forced' },
    { type: 'contact_transition', timestamp: '2026-08-01T18:00:00Z', fromContact: 'forced', toContact: 'direct', contact: 'direct' },
    { type: 'point_of_exactitude', timestamp: '2026-08-02T12:00:00Z', contact: 'direct' },
    { type: 'contact_transition', timestamp: '2026-08-03T18:00:00Z', fromContact: 'direct', toContact: 'forced', contact: 'forced' },
    { type: 'aspect_release', contact: 'fringe', fromContact: 'forced' },
  ],
};

function approvedEditorial(arc, overrides = {}) {
  return {
    interpretation: 'Strategy is pressing on the message.',
    alignment: 'Make sure the plan and the words solve the same problem.',
    method: {
      version: 'alchemystic-interpretation.v1',
      planetOne: { body: arc.planetOne, condition: 'Planet one was assessed independently.' },
      planetTwo: { body: arc.planetTwo, condition: 'Planet two was assessed independently.' },
      aspect: { type: arc.aspect, synthesis: 'The aspect was applied to both assessed conditions.' },
    },
    ...overrides,
  };
}

test('presents a complete Aspect Arc without inventing editorial interpretation', () => {
  const feed = buildForecastFeed({
    now: '2026-08-01T12:00:00Z',
    timeZone: 'America/Chicago',
    forecast: {
      generatedAt: '2026-08-01T12:00:00Z',
      window: { start: '2026-08-01T12:00:00Z' },
      arcs: [completeArc],
    },
    interpretations: {
      [completeArc.key]: approvedEditorial(completeArc),
    },
  });

  assert.equal(feed.schema, 'mystic-rebels.alchemystic-forecast.v1');
  assert.equal(feed.week.length, 1);
  assert.equal(feed.week[0].planetOne, 'Pallas');
  assert.equal(feed.week[0].aspect, 'Squares');
  assert.equal(feed.week[0].planetTwo, 'Mercury');
  assert.equal(feed.week[0].currentPhase, 'Activating');
  assert.equal(feed.week[0].contactType, 'Forced Aspect');
  assert.deepEqual(feed.week[0].contactTimeline.map(({ contactType }) => contactType), [
    'Forced Aspect', 'True Aspect', 'Forced Aspect',
  ]);
  assert.equal(feed.week[0].moments.activating.contactType, 'Forced Aspect');
  assert.equal(feed.week[0].moments.exactitude.contactType, 'True Aspect');
  assert.equal(feed.week[0].moments.releasing.contactType, 'Forced Aspect');
  assert.equal(feed.week[0].moments.exactitude.display, 'Sunday · August 2');
  assert.equal(feed.week[0].moments.exactitude.dateKey, '2026-08-02');
  assert.equal(feed.week[0].planetOneGlyph, 'P');
  assert.equal(feed.week[0].interpretationMethod, 'alchemystic-interpretation.v1');
  assert.equal(feed.week[0].aspectGlyph, '□');
  assert.equal(feed.calendar.range.start, '2026-07-02');
  assert.equal(feed.calendar.range.end, '2026-08-31');
  assert.equal(feed.calendar.records.length, 1);
});

test('labels one-sided OOI contact as a Forced Aspect', () => {
  const feed = buildForecastFeed({
    now: '2026-08-01T12:00:00Z',
    forecast: {
      generatedAt: '2026-08-01T12:00:00Z',
      window: { start: '2026-08-01T12:00:00Z' },
      arcs: [{
        ...completeArc,
        events: [
          { type: 'true_aspect_activation', contact: 'forced' },
          { type: 'point_of_exactitude', contact: 'forced' },
        ],
      }],
    },
    interpretations: {
      [completeArc.key]: approvedEditorial(completeArc),
    },
  });

  assert.equal(feed.week[0].contactType, 'Forced Aspect');
});

test('places complete approved arcs after the weekly focus in the rolling calendar', () => {
  const futureArc = {
    ...completeArc,
    key: 'chiron:square:mercury',
    planetOne: 'chiron',
    moments: {
      activating: '2026-08-10T12:00:00Z',
      pointOfExactitude: '2026-08-12T12:00:00Z',
      releasing: '2026-08-14T12:00:00Z',
    },
  };
  const feed = buildForecastFeed({
    now: '2026-08-01T12:00:00Z',
    forecast: {
      generatedAt: '2026-08-01T12:00:00Z',
      window: { start: '2026-08-01T12:00:00Z' },
      arcs: [futureArc],
    },
    interpretations: {
      [futureArc.key]: approvedEditorial(futureArc, {
        interpretation: 'Insecurity is pressing directly into the message.',
        alignment: 'Support the mind instead of letting insecurity run the meeting.',
      }),
    },
  });

  assert.deepEqual(feed.week, []);
  assert.equal(feed.calendar.records.length, 1);
  assert.equal(feed.calendar.records[0].planetOne, 'Chiron');
  assert.equal(feed.calendar.records[0].planetTwo, 'Mercury');
});

test('keeps calculated calendar arcs without inventing copy and omits incomplete arcs', () => {
  const feed = buildForecastFeed({
    now: '2026-08-01T12:00:00Z',
    forecast: {
      generatedAt: '2026-08-01T12:00:00Z',
      window: { start: '2026-08-01T12:00:00Z' },
      arcs: [completeArc, { ...completeArc, key: 'venus:square:mars', moments: { ...completeArc.moments, releasing: null } }],
    },
    interpretations: {},
  });

  assert.deepEqual(feed.week, []);
  assert.equal(feed.calendar.records.length, 1);
  assert.equal(feed.calendar.records[0].hasInterpretation, false);
  assert.equal(feed.calendar.records[0].interpretation, '');
});

test('suppresses prose unless both planetary conditions feed the matching aspect synthesis', () => {
  const base = {
    now: '2026-08-01T12:00:00Z',
    forecast: {
      generatedAt: '2026-08-01T12:00:00Z',
      window: { start: '2026-08-01T12:00:00Z' },
      arcs: [completeArc],
    },
  };
  const missingMethod = buildForecastFeed({
    ...base,
    interpretations: {
      [completeArc.key]: {
        interpretation: 'An unverified isolated aspect meaning.',
        alignment: 'This must not be published.',
      },
    },
  });
  const wrongPlanet = buildForecastFeed({
    ...base,
    interpretations: {
      [completeArc.key]: approvedEditorial(completeArc, {
        method: {
          ...approvedEditorial(completeArc).method,
          planetTwo: { body: 'venus', condition: 'The wrong second planet.' },
        },
      }),
    },
  });

  assert.equal(missingMethod.week.length, 0);
  assert.equal(missingMethod.calendar.records[0].hasInterpretation, false);
  assert.equal(wrongPlanet.week.length, 0);
  assert.equal(wrongPlanet.calendar.records[0].hasInterpretation, false);
});
