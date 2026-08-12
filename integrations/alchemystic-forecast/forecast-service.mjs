import { createHash, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

import { buildForecastFeed } from './forecast-feed.mjs';
import { scanUniversalForecast } from './forecast-scanner.mjs';
import { buildFoundationalTranslations } from './foundational-translation.mjs';
import {
  calculateSwissEclipses,
  calculateSwissNatalChart,
  calculateSwissPositions,
} from './swetest-provider.mjs';

const DAY_MS = 86_400_000;
const DEFAULT_CACHE_MS = 6 * 60 * 60 * 1000;
const ALLOWED_ORIGINS = new Set([
  'https://mysticrebels.com',
  'https://www.mysticrebels.com',
  'https://mysticrebels.myshopify.com',
]);

export function createForecastService({
  positionProvider,
  eclipseProvider = async () => [],
  loadInterpretations,
  createFoundationalTranslations = buildFoundationalTranslations,
  scanForecast = scanUniversalForecast,
  presentForecast = buildForecastFeed,
  now = () => new Date(),
  cacheTtlMs = DEFAULT_CACHE_MS,
  timeZone = 'America/Chicago',
  sourceUrl,
  natalChartProvider,
  natalCalculationToken,
}) {
  if (typeof positionProvider !== 'function') throw new TypeError('A position provider is required.');
  if (typeof eclipseProvider !== 'function') throw new TypeError('An eclipse provider is required.');
  if (typeof loadInterpretations !== 'function') throw new TypeError('An interpretation loader is required.');
  if (typeof createFoundationalTranslations !== 'function') throw new TypeError('A foundational translation builder is required.');
  assertPublicSourceUrl(sourceUrl);

  let cached = null;
  let pending = null;

  async function generate() {
    const current = now();
    const focusStart = startOfDayInTimeZone(current, timeZone);
    const scanStart = new Date(focusStart.getTime() - 14 * DAY_MS);
    const forecast = await scanForecast({
      start: scanStart,
      days: 42,
      stepHours: 6,
      precisionMinutes: 1,
      positionProvider,
    });
    const [approvedInterpretations, foundationalInterpretations, eclipses, lunarSnapshots] = await Promise.all([
      loadInterpretations(),
      createFoundationalTranslations({ forecast, positionProvider }),
      eclipseProvider({ start: scanStart, end: new Date(scanStart.getTime() + 42 * DAY_MS) }),
      lunarExactitudeSnapshots(forecast.arcs, positionProvider),
    ]);
    const feed = presentForecast({
      forecast,
      interpretations: mergeInterpretations(foundationalInterpretations, approvedInterpretations),
      eclipses,
      lunarSnapshots,
      now: current,
      timeZone,
    });
    return { ...feed, sourceUrl };
  }

  async function getPayload() {
    const currentTime = now().getTime();
    if (cached && currentTime < cached.expiresAt) return cached;
    if (!pending) {
      pending = generate().then((feed) => {
        const body = JSON.stringify(feed);
        cached = {
          body,
          etag: `"${createHash('sha256').update(body).digest('base64url')}"`,
          expiresAt: now().getTime() + cacheTtlMs,
        };
        return cached;
      }).finally(() => { pending = null; });
    }
    return pending;
  }

  return async function handle(request, response) {
    const url = new URL(request.url, 'http://forecast.local');
    const origin = request.headers.origin;
    if (origin && ALLOWED_ORIGINS.has(origin)) response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');

    if (request.method === 'OPTIONS') {
      response.writeHead(origin && !ALLOWED_ORIGINS.has(origin) ? 403 : 204, {
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Accept',
      });
      response.end();
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/alchemystic-natal-chart') {
      if (typeof natalChartProvider !== 'function' || !natalCalculationToken) {
        return json(response, 404, { error: 'Not found' });
      }
      if (!validBearer(request.headers.authorization, natalCalculationToken)) {
        return json(response, 401, { error: 'Unauthorized' });
      }
      try {
        const input = await readJson(request);
        const chart = await natalChartProvider({
          at: new Date(input.at),
          latitude: Number(input.latitude),
          longitude: Number(input.longitude),
        });
        return json(response, 200, chart);
      } catch (error) {
        console.error('Alchemystic natal calculation failed.', error);
        return json(response, 422, { error: 'natal_calculation_failed' });
      }
    }

    if (request.method !== 'GET') return json(response, 405, { error: 'Method not allowed' });
    if (url.pathname === '/healthz') return json(response, 200, { status: 'ok' });
    if (url.pathname === '/source') {
      response.writeHead(302, { Location: sourceUrl });
      response.end();
      return;
    }
    if (url.pathname !== '/api/alchemystic-forecast') return json(response, 404, { error: 'Not found' });
    if (origin && !ALLOWED_ORIGINS.has(origin)) return json(response, 403, { error: 'Origin not allowed' });

    try {
      const payload = await getPayload();
      response.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.setHeader('ETag', payload.etag);
      if (request.headers['if-none-match'] === payload.etag) {
        response.writeHead(304);
        response.end();
        return;
      }
      response.writeHead(200);
      response.end(payload.body);
    } catch (error) {
      console.error('Alchemystic forecast generation failed.', error);
      json(response, 503, { error: 'Forecast temporarily unavailable' });
    }
  };
}

function mergeInterpretations(foundational, approved) {
  const merged = { ...foundational };
  Object.entries(approved || {}).forEach(([occurrenceId, editorial]) => {
    merged[occurrenceId] = {
      ...foundational[occurrenceId],
      ...editorial,
      daily: editorial?.daily || foundational[occurrenceId]?.daily,
    };
  });
  return merged;
}

async function lunarExactitudeSnapshots(arcs, positionProvider) {
  const timestamps = [...new Set((arcs || []).filter((arc) => {
    const bodies = new Set([arc?.planetOne, arc?.planetTwo]);
    return bodies.has('sun') && bodies.has('moon') && ['conjunction', 'opposition'].includes(arc?.aspect);
  }).map((arc) => new Date(arc.moments?.pointOfExactitude).toISOString()))];
  return Promise.all(timestamps.map(async (timestamp) => ({
    timestamp,
    positions: (await positionProvider(new Date(timestamp)))?.positions || [],
  })));
}

export function createProductionService(env = process.env) {
  const binaryPath = requiredEnvironment(env, 'SWETEST_BIN');
  const ephemerisPath = requiredEnvironment(env, 'SWISSEPH_PATH');
  const sourceUrl = requiredEnvironment(env, 'ALCHEMYSTIC_SOURCE_URL');
  const editorialJson = env.ALCHEMYSTIC_EDITORIAL_JSON;
  const editorialPath = env.ALCHEMYSTIC_EDITORIAL_PATH;
  const natalCalculationToken = env.NATAL_CALCULATION_TOKEN;
  if (!editorialJson && !editorialPath) {
    throw new Error('ALCHEMYSTIC_EDITORIAL_JSON or ALCHEMYSTIC_EDITORIAL_PATH is required.');
  }
  return createForecastService({
    sourceUrl,
    positionProvider: (at) => calculateSwissPositions({ at, binaryPath, ephemerisPath }),
    eclipseProvider: ({ start, end }) => calculateSwissEclipses({ start, end, binaryPath, ephemerisPath }),
    natalChartProvider: ({ at, latitude, longitude }) => calculateSwissNatalChart({
      at, latitude, longitude, binaryPath, ephemerisPath,
    }),
    natalCalculationToken,
    loadInterpretations: async () => JSON.parse(editorialJson || await readFile(editorialPath, 'utf8')),
  });
}

export function startOfDayInTimeZone(value, timeZone) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError('The service clock returned an invalid date.');
  const day = dateParts(date, timeZone);
  const wallClockMidnight = Date.UTC(day.year, day.month - 1, day.day);
  let result = wallClockMidnight - offsetAt(new Date(wallClockMidnight), timeZone);
  result = wallClockMidnight - offsetAt(new Date(result), timeZone);
  return new Date(result);
}

function dateParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return { year: Number(values.year), month: Number(values.month), day: Number(values.day) };
}

function offsetAt(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const representedAsUtc = Date.UTC(
    Number(values.year), Number(values.month) - 1, Number(values.day),
    Number(values.hour), Number(values.minute), Number(values.second),
  );
  return representedAsUtc - date.getTime();
}

function requiredEnvironment(env, key) {
  if (!env[key]) throw new Error(`${key} is required.`);
  return env[key];
}

function assertPublicSourceUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError('A public HTTPS corresponding-source URL is required.');
  }
  if (url.protocol !== 'https:') throw new TypeError('The corresponding-source URL must use HTTPS.');
}

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function validBearer(header, expected) {
  const supplied = header?.startsWith('Bearer ') ? header.slice(7) : '';
  if (!supplied || !expected || supplied.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

async function readJson(request, limit = 16_384) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new RangeError('Request body is too large.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const port = Number(process.env.PORT || 8787);
  const server = createServer(createProductionService());
  server.listen(port, () => console.log(`Alchemystic forecast service listening on ${port}`));
}
