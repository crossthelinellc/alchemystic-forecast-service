import assert from 'node:assert/strict';
import test from 'node:test';

import { createForecastService, startOfDayInTimeZone } from './forecast-service.mjs';

async function request(handler, { url = '/api/alchemystic-forecast', method = 'GET', headers = {}, body = '' } = {}) {
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
  await handler({
    url, method, headers,
    async *[Symbol.asyncIterator]() { if (body) yield Buffer.from(body); },
  }, response);
  return response;
}

test('serves authenticated Swiss natal calculation without exposing it publicly', async () => {
  const handler = createForecastService({
    sourceUrl: 'https://code.example.com/alchemystic-forecast',
    positionProvider: async () => ({ positions: [] }),
    loadInterpretations: async () => ({}),
    natalCalculationToken: 'calculation-secret',
    natalChartProvider: async ({ at, latitude, longitude }) => ({
      timestamp: at.toISOString(), latitude, longitude, ephemeris: 'swiss', ascendantLongitude: 12, positions: [],
    }),
  });
  const unauthorized = await request(handler, { url: '/api/alchemystic-natal-chart', method: 'POST', body: '{}' });
  assert.equal(unauthorized.status, 401);
  const response = await request(handler, {
    url: '/api/alchemystic-natal-chart', method: 'POST',
    headers: { authorization: 'Bearer calculation-secret' },
    body: JSON.stringify({ at: '1982-06-12T13:49:00.000Z', latitude: 39.29, longitude: -76.61 }),
  });
  assert.equal(response.status, 200);
  assert.equal(JSON.parse(response.body).ephemeris, 'swiss');
});

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
