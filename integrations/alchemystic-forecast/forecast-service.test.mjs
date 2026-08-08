import assert from 'node:assert/strict';
import test from 'node:test';

import { createForecastService, startOfDayInTimeZone } from './forecast-service.mjs';

async function request(handler, { url = '/api/alchemystic-forecast', method = 'GET', headers = {} } = {}) {
  const response = {
    headers: new Map(),
    status: null,
    body: '',
    setHeader(key, value) { this.headers.set(key.toLowerCase(), value); },
    writeHead(status, headersToAdd = {}) {
      this.status = status;
      Object.entries(headersToAdd).forEach(([key, value]) => this.setHeader(key, value));
    },
    end(chunk = '') { this.body += chunk; },
  };
  await handler({ url, method, headers }, response);
  return response;
}

test('serves a cached, conditional forecast only to Mystic Rebels storefront origins', async () => {
  let scans = 0;
  const handler = createForecastService({
    sourceUrl: 'https://code.example.com/alchemystic-forecast',
    positionProvider: async () => ({ positions: [] }),
    loadInterpretations: async () => ({ approved: true }),
    now: () => new Date('2026-08-01T12:00:00Z'),
    scanForecast: async () => ({ window: { start: '2026-07-18T00:00:00Z' }, arcs: [], generatedAt: '2026-08-01T12:00:00Z', scan: ++scans }),
    presentForecast: ({ forecast }) => ({ schema: 'mystic-rebels.alchemystic-forecast.v1', scan: forecast.scan, week: [], outlook: [] }),
  });

  const origin = 'https://mysticrebels.com';
  const first = await request(handler, { headers: { origin } });
    assert.equal(first.status, 200);
    assert.equal(first.headers.get('access-control-allow-origin'), origin);
    const firstFeed = JSON.parse(first.body);
    assert.equal(firstFeed.scan, 1);
    assert.equal(firstFeed.sourceUrl, 'https://code.example.com/alchemystic-forecast');

    const second = await request(handler, {
      headers: { origin, 'if-none-match': first.headers.get('etag') },
    });
    assert.equal(second.status, 304);
    assert.equal(scans, 1);

    const blocked = await request(handler, {
      headers: { origin: 'https://example.com' },
    });
    assert.equal(blocked.status, 403);

    const source = await request(handler, { url: '/source' });
    assert.equal(source.status, 302);
    assert.equal(source.headers.get('location'), 'https://code.example.com/alchemystic-forecast');
});

test('coalesces simultaneous cache misses into one forecast calculation', async () => {
  let scans = 0;
  const handler = createForecastService({
    sourceUrl: 'https://code.example.com/alchemystic-forecast',
    positionProvider: async () => ({ positions: [] }),
    loadInterpretations: async () => ({}),
    scanForecast: async () => {
      scans += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { window: { start: '2026-07-18T00:00:00Z' }, arcs: [], generatedAt: '2026-08-01T12:00:00Z' };
    },
    presentForecast: () => ({ schema: 'mystic-rebels.alchemystic-forecast.v1', week: [], outlook: [] }),
  });

  await Promise.all([request(handler), request(handler), request(handler)]);
  assert.equal(scans, 1);
});

test('refuses to initialize without a public HTTPS corresponding-source location', () => {
  assert.throws(() => createForecastService({
    positionProvider: async () => ({ positions: [] }),
    loadInterpretations: async () => ({}),
  }), /public HTTPS/);
});

test('anchors the forecast day to the configured display timezone', () => {
  assert.equal(
    startOfDayInTimeZone('2026-08-01T03:29:00Z', 'America/Chicago').toISOString(),
    '2026-07-31T05:00:00.000Z',
  );
  assert.equal(
    startOfDayInTimeZone('2026-01-15T18:00:00Z', 'America/Chicago').toISOString(),
    '2026-01-15T06:00:00.000Z',
  );
});

test('presents current phases using the actual instant instead of midnight', async () => {
  let presentedNow;
  const instant = new Date('2026-08-01T17:42:00Z');
  const handler = createForecastService({
    sourceUrl: 'https://code.example.com/alchemystic-forecast',
    positionProvider: async () => ({ positions: [] }),
    loadInterpretations: async () => ({}),
    now: () => instant,
    scanForecast: async () => ({ window: { start: '2026-07-18T00:00:00Z' }, arcs: [], generatedAt: instant.toISOString() }),
    presentForecast: ({ now }) => {
      presentedNow = now;
      return { schema: 'mystic-rebels.alchemystic-forecast.v1', week: [], calendar: { records: [] } };
    },
  });

  const response = await request(handler);
  assert.equal(response.status, 200);
  assert.equal(presentedNow.toISOString(), instant.toISOString());
});

test('passes authoritative eclipse events into the forecast presentation', async () => {
  let receivedEclipses;
  const handler = createForecastService({
    sourceUrl: 'https://code.example.com/alchemystic-forecast',
    positionProvider: async () => ({ positions: [] }),
    eclipseProvider: async () => [{ kind: 'solar_eclipse', timestamp: '2026-08-12T17:45:59.200Z' }],
    loadInterpretations: async () => ({}),
    now: () => new Date('2026-08-01T12:00:00Z'),
    scanForecast: async () => ({ window: { start: '2026-07-18T00:00:00Z' }, arcs: [], generatedAt: '2026-08-01T12:00:00Z' }),
    presentForecast: ({ eclipses }) => {
      receivedEclipses = eclipses;
      return { schema: 'mystic-rebels.alchemystic-forecast.v1', week: [], calendar: { records: [] } };
    },
  });

  const response = await request(handler);
  assert.equal(response.status, 200);
  assert.equal(receivedEclipses[0].kind, 'solar_eclipse');
});

test('lets approved occurrence editorial override a generated foundational translation', async () => {
  let receivedInterpretations;
  const handler = createForecastService({
    sourceUrl: 'https://code.example.com/alchemystic-forecast',
    positionProvider: async () => ({ positions: [] }),
    loadInterpretations: async () => ({ occurrence: { tier: 'editorial', interpretation: 'Approved.' } }),
    createFoundationalTranslations: async () => ({
      occurrence: { tier: 'foundational', interpretation: 'Generated.' },
      baselineOnly: { tier: 'foundational', interpretation: 'Baseline.' },
    }),
    scanForecast: async () => ({ window: { start: '2026-07-18T00:00:00Z' }, arcs: [], generatedAt: '2026-08-01T12:00:00Z' }),
    presentForecast: ({ interpretations }) => {
      receivedInterpretations = interpretations;
      return { schema: 'mystic-rebels.alchemystic-forecast.v1', week: [], calendar: { records: [] } };
    },
  });

  const response = await request(handler);
  assert.equal(response.status, 200);
  assert.equal(receivedInterpretations.occurrence.interpretation, 'Approved.');
  assert.equal(receivedInterpretations.occurrence.tier, 'editorial');
  assert.equal(receivedInterpretations.baselineOnly.interpretation, 'Baseline.');
});
