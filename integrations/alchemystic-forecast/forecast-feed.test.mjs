import assert from 'node:assert/strict';
import test from 'node:test';

import { BODY_GLYPHS, buildForecastFeed } from './forecast-feed.mjs';
import { INTERPRETATION_VOCABULARY_VERSION } from './interpretation-vocabulary.mjs';

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
    { type: 'contact_transition', timestamp: '2026-08-01T18:00:00Z', fromContact: 'forced', toContact: 'direct', contact: 'direct', fromForcedBy: 'mercury', deviation: 1, exactAspectAngle: 90, angularSeparation: 89, planetOneOoi: 1, planetTwoOoi: 3 },
    { type: 'point_of_exactitude', timestamp: '2026-08-02T12:00:00Z', contact: 'direct' },
    { type: 'contact_transition', timestamp: '2026-08-03T18:00:00Z', fromContact: 'direct', toContact: 'forced', contact: 'forced', toForcedBy: 'mercury', deviation: 1, exactAspectAngle: 90, angularSeparation: 91, planetOneOoi: 1, planetTwoOoi: 3 },
    { type: 'aspect_release', contact: 'fringe', fromContact: 'forced' },
  ],
};

test('uses canonical astrological glyphs for asteroids and Mean Black Moon Lilith', () => {
  assert.deepEqual({
    ceres: BODY_GLYPHS.ceres,
    pallas: BODY_GLYPHS.pallas,
    juno: BODY_GLYPHS.juno,
    vesta: BODY_GLYPHS.vesta,
    meanBlackMoonLilith: BODY_GLYPHS.mean_black_moon_lilith,
  }, {
    ceres: '⚳',
    pallas: '⚴',
    juno: '⚵',
    vesta: '⚶',
    meanBlackMoonLilith: '⚸',
  });
});

function approvedEditorial(arc, overrides = {}) {
  const occurrenceId = occurrenceIdFor(arc);
  const dualRulership = (body) => {
    const fields = body === 'mercury'
      ? [['gemini', 'inferior_mercury'], ['virgo', 'superior_mercury']]
      : body === 'venus'
        ? [['taurus', 'inferior_venus'], ['libra', 'superior_venus']]
        : null;
    return fields ? {
      phases: ['activating', 'exactitude', 'releasing'],
      fields: fields.map(([sign, expression]) => ({
        sign,
        expression,
        conditions: { activating: [], exactitude: [], releasing: [] },
      })),
    } : undefined;
  };
  return {
    interpretation: 'Strategy is pressing on the message.',
    alignment: 'Make sure the plan and the words solve the same problem.',
    method: {
      version: 'alchemystic-interpretation.v3',
      vocabularyVersion: INTERPRETATION_VOCABULARY_VERSION,
      occurrenceId,
      planetOne: {
        body: arc.planetOne,
        condition: 'Planet one was assessed independently.',
        dualRulership: dualRulership(arc.planetOne),
      },
      planetTwo: {
        body: arc.planetTwo,
        condition: 'Planet two was assessed independently.',
        dualRulership: dualRulership(arc.planetTwo),
      },
      aspect: { type: arc.aspect, synthesis: 'The aspect was applied to both assessed conditions.' },
    },
    ...overrides,
  };
}

function occurrenceIdFor(arc) {
  return [arc.key, new Date(arc.moments.pointOfExactitude).toISOString()].join(':');
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
      [occurrenceIdFor(completeArc)]: approvedEditorial(completeArc),
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
  assert.deepEqual(feed.week[0].contactTimeline.slice(1).map(({ display }) => display), [
    'Saturday · August 1 · 1:00 PM CDT',
    'Monday · August 3 · 1:00 PM CDT',
  ]);
  assert.deepEqual(feed.week[0].contactTimeline.slice(1).map((entry) => ({
    side: entry.side,
    fromForcedBy: entry.fromForcedBy,
    toForcedBy: entry.toForcedBy,
    deviation: entry.deviation,
    exactAspectAngle: entry.exactAspectAngle,
    angularSeparation: entry.angularSeparation,
    planetOneOoi: entry.planetOneOoi,
    planetTwoOoi: entry.planetTwoOoi,
  })), [
    { side: 'applying', fromForcedBy: 'mercury', toForcedBy: '', deviation: 1, exactAspectAngle: 90, angularSeparation: 89, planetOneOoi: 1, planetTwoOoi: 3 },
    { side: 'separating', fromForcedBy: '', toForcedBy: 'mercury', deviation: 1, exactAspectAngle: 90, angularSeparation: 91, planetOneOoi: 1, planetTwoOoi: 3 },
  ]);
  assert.equal(feed.week[0].moments.activating.contactType, 'Forced Aspect');
  assert.equal(feed.week[0].moments.exactitude.contactType, 'True Aspect');
  assert.equal(feed.week[0].moments.releasing.contactType, 'Forced Aspect');
  assert.equal(feed.week[0].moments.exactitude.display, 'Sunday · August 2');
  assert.equal(feed.week[0].moments.exactitude.dateKey, '2026-08-02');
  assert.equal(feed.week[0].planetOneGlyph, '⚴');
  assert.equal(feed.week[0].interpretationMethod, 'alchemystic-interpretation.v3');
  assert.equal(feed.week[0].aspectGlyph, '□');
  assert.equal(feed.week[0].articleUrl, '');
  assert.equal(feed.calendar.range.start, '2026-07-02');
  assert.equal(feed.calendar.range.end, '2026-08-31');
  assert.equal(feed.calendar.records.length, 1);
});

test('publishes New Moons, Full Moons, and authoritative eclipse classifications separately', () => {
  const newMoonArc = {
    ...completeArc,
    key: 'sun:conjunction:moon',
    planetOne: 'sun',
    planetTwo: 'moon',
    aspect: 'conjunction',
    moments: {
      activating: '2026-08-09T12:00:00Z',
      pointOfExactitude: '2026-08-12T17:46:00Z',
      releasing: '2026-08-15T12:00:00Z',
    },
  };
  const fullMoonArc = {
    ...newMoonArc,
    key: 'sun:opposition:moon',
    aspect: 'opposition',
    moments: {
      activating: '2026-08-25T12:00:00Z',
      pointOfExactitude: '2026-08-28T04:13:00Z',
      releasing: '2026-08-31T12:00:00Z',
    },
  };
  const feed = buildForecastFeed({
    now: '2026-08-01T12:00:00Z',
    timeZone: 'America/Chicago',
    forecast: {
      generatedAt: '2026-08-01T12:00:00Z',
      window: { start: '2026-08-01T12:00:00Z' },
      arcs: [newMoonArc, fullMoonArc],
    },
    eclipses: [
      { kind: 'solar_eclipse', eclipseType: 'total', timestamp: '2026-08-12T17:45:59.200Z', source: 'swiss_ephemeris_global_eclipse_search' },
      { kind: 'lunar_eclipse', eclipseType: 'partial', timestamp: '2026-08-28T04:12:58.000Z', source: 'swiss_ephemeris_global_eclipse_search' },
    ],
    interpretations: {},
  });

  assert.deepEqual(feed.calendar.lunarEvents.map(({ title, phase, dateKey, source }) => ({ title, phase, dateKey, source })), [
    { title: 'Total Solar Eclipse', phase: 'New Moon', dateKey: '2026-08-12', source: 'swiss_ephemeris_global_eclipse_search' },
    { title: 'Partial Lunar Eclipse', phase: 'Full Moon', dateKey: '2026-08-27', source: 'swiss_ephemeris_global_eclipse_search' },
  ]);
});

test('publishes a Chronicle link only when editorial supplies a specific article URL', () => {
  const articleUrl = '/blogs/mystic-chronicles/a-selected-transit';
  const feed = buildForecastFeed({
    now: '2026-08-01T12:00:00Z',
    forecast: {
      generatedAt: '2026-08-01T12:00:00Z',
      window: { start: '2026-08-01T12:00:00Z' },
      arcs: [completeArc],
    },
    interpretations: {
      [occurrenceIdFor(completeArc)]: approvedEditorial(completeArc, { articleUrl }),
    },
  });

  assert.equal(feed.week[0].articleUrl, articleUrl);
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
      [occurrenceIdFor(completeArc)]: approvedEditorial(completeArc),
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
      [occurrenceIdFor(futureArc)]: approvedEditorial(futureArc, {
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
      [occurrenceIdFor(completeArc)]: {
        interpretation: 'An unverified isolated aspect meaning.',
        alignment: 'This must not be published.',
      },
    },
  });
  const wrongPlanet = buildForecastFeed({
    ...base,
    interpretations: {
      [occurrenceIdFor(completeArc)]: approvedEditorial(completeArc, {
        method: {
          ...approvedEditorial(completeArc).method,
          planetTwo: { body: 'venus', condition: 'The wrong second planet.' },
        },
      }),
    },
  });
  const incompleteDualRulership = buildForecastFeed({
    ...base,
    interpretations: {
      [occurrenceIdFor(completeArc)]: approvedEditorial(completeArc, {
        method: {
          ...approvedEditorial(completeArc).method,
          planetTwo: {
            ...approvedEditorial(completeArc).method.planetTwo,
            dualRulership: {
              phases: ['activating', 'exactitude', 'releasing'],
              fields: [{
                sign: 'gemini',
                expression: 'inferior_mercury',
                conditions: { activating: [], exactitude: [], releasing: [] },
              }],
            },
          },
        },
      }),
    },
  });
  const staleVocabulary = buildForecastFeed({
    ...base,
    interpretations: {
      [occurrenceIdFor(completeArc)]: approvedEditorial(completeArc, {
        method: {
          ...approvedEditorial(completeArc).method,
          vocabularyVersion: 'alchemystic-vocabulary.stale',
        },
      }),
    },
  });

  assert.equal(missingMethod.week.length, 0);
  assert.equal(missingMethod.calendar.records[0].hasInterpretation, false);
  assert.equal(wrongPlanet.week.length, 0);
  assert.equal(wrongPlanet.calendar.records[0].hasInterpretation, false);
  assert.equal(incompleteDualRulership.week.length, 0);
  assert.equal(incompleteDualRulership.calendar.records[0].hasInterpretation, false);
  assert.equal(staleVocabulary.week.length, 0);
  assert.equal(staleVocabulary.calendar.records[0].hasInterpretation, false);
});

test('does not reuse one occurrence editorial on a different Aspect Arc occurrence', () => {
  const laterArc = {
    ...completeArc,
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
      arcs: [completeArc, laterArc],
    },
    interpretations: {
      [occurrenceIdFor(laterArc)]: approvedEditorial(laterArc),
    },
  });

  const earlier = feed.calendar.records.find(({ id }) => id === occurrenceIdFor(completeArc));
  const later = feed.calendar.records.find(({ id }) => id === occurrenceIdFor(laterArc));
  assert.equal(earlier.hasInterpretation, false);
  assert.equal(later.hasInterpretation, true);
});
