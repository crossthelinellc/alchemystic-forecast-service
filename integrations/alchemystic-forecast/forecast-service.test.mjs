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
