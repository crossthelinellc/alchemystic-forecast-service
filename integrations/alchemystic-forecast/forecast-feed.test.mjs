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
    { type: 'true_aspect_activation', contact: 'forced' },
    { type: 'point_of_exactitude', contact: 'direct' },
  ],
};

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
      [completeArc.key]: {
        interpretation: 'Strategy is pressing on the message.',
        alignment: 'Make sure the plan and the words solve the same problem.',
      },
    },
  });

  assert.equal(feed.schema, 'mystic-rebels.alchemystic-forecast.v1');
  assert.equal(feed.week.length, 1);
  assert.equal(feed.week[0].planetOne, 'Pallas');
  assert.equal(feed.week[0].aspect, 'Squares');
  assert.equal(feed.week[0].planetTwo, 'Mercury');
  assert.equal(feed.week[0].currentPhase, 'Activating');
  assert.equal(feed.week[0].contactType, 'Direct impact');
  assert.equal(feed.week[0].moments.exactitude.display, 'Sunday · August 2');
});

test('labels one-sided OOI contact as a Forced aspect', () => {
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
      [completeArc.key]: {
        interpretation: 'Strategy is pressing on the message.',
        alignment: 'Make sure the plan and the words solve the same problem.',
      },
    },
  });

  assert.equal(feed.week[0].contactType, 'Forced aspect');
});

test('omits incomplete arcs and arcs without approved copy', () => {
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
  assert.deepEqual(feed.outlook, []);
});
