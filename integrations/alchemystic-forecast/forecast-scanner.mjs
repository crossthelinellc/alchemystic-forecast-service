import {
  BODY_CATALOG,
  classifyRelationship,
  inspectRelationship,
} from './engine.mjs';
import { groupAspectArcs } from './interpretation-engine.mjs';

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const DEFAULT_BODY_KEYS = Object.freeze(Object.keys(BODY_CATALOG));

export async function scanUniversalForecast({
  start,
  days = 14,
  stepHours = 6,
  precisionMinutes = 1,
  bodyKeys = DEFAULT_BODY_KEYS,
  positionProvider,
}) {
  const startTime = toTimestamp(start);
  if (!Number.isFinite(days) || days <= 0) throw new RangeError('Forecast days must be positive.');
  if (!Number.isFinite(stepHours) || stepHours <= 0) throw new RangeError('Step hours must be positive.');
  if (typeof positionProvider !== 'function') throw new TypeError('A position provider is required.');

  const stepMs = stepHours * HOUR_MS;
  const endTime = startTime + days * 24 * HOUR_MS;
  const requestedKeys = validateBodyKeys(bodyKeys);
  const cache = new Map();
  const snapshotAt = async (timestamp) => {
    const cacheKey = new Date(timestamp).toISOString();
    if (!cache.has(cacheKey)) {
      const result = await positionProvider(new Date(timestamp));
      cache.set(cacheKey, normalizeSnapshot(result, requestedKeys, timestamp));
    }
    return cache.get(cacheKey);
  };

  const timestamps = [];
  for (let time = startTime - stepMs; time <= endTime + stepMs; time += stepMs) {
    timestamps.push(time);
  }

  const snapshots = await Promise.all(timestamps.map(snapshotAt));
  const pairs = createPairs(requestedKeys);
  const active = [];
  const events = [];

  for (const [firstKey, secondKey] of pairs) {
    const measurements = snapshots.map((snapshot) => inspectAt(snapshot, firstKey, secondKey));

    for (let index = 1; index < timestamps.length - 1; index += 1) {
      const timestamp = timestamps[index];
      if (timestamp < startTime || timestamp > endTime) continue;

      const relationship = classifyRelationship(
        pairAt(snapshots[index - 1], firstKey, secondKey),
        pairAt(snapshots[index], firstKey, secondKey),
        pairAt(snapshots[index + 1], firstKey, secondKey),
      );

      if (relationship.contact.kind !== 'out_of_orb') {
        active.push({ timestamp: new Date(timestamp).toISOString(), ...relationship });
      }

      const previous = measurements[index - 1];
      const current = measurements[index];

      if (previous.contact.directImpact !== current.contact.directImpact) {
        const boundary = await refineBooleanBoundary({
          low: timestamps[index - 1],
          high: timestamp,
          precisionMs: precisionMinutes * MINUTE_MS,
          test: async (time) => inspectAt(await snapshotAt(time), firstKey, secondKey).contact.directImpact,
        });
        const refined = inspectAt(await snapshotAt(boundary), firstKey, secondKey);
        events.push(serializeEvent(
          current.contact.directImpact ? 'true_aspect_activation' : 'aspect_release',
          boundary,
          refined,
        ));
      }

      const next = measurements[index + 1];
      if (isExactitudeBracket(previous, current, next)) {
        const exactTime = await refineExactitude({
          low: timestamps[index - 1],
          high: timestamps[index + 1],
          precisionMs: precisionMinutes * MINUTE_MS,
          inspect: async (time) => inspectAt(await snapshotAt(time), firstKey, secondKey),
          aspectKey: current.aspect.key,
        });
        const exact = inspectAt(await snapshotAt(exactTime), firstKey, secondKey);
        if (exact.aspect.key === current.aspect.key && exact.aspect.deviation <= 1 / 60) {
          events.push(serializeEvent('point_of_exactitude', exactTime, exact));
        }
      }
    }
  }

  const forecastEvents = deduplicateEvents(events)
    .filter((event) => {
      const timestamp = new Date(event.timestamp).getTime();
      return timestamp >= startTime && timestamp <= endTime;
    })
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return {
    generatedAt: new Date().toISOString(),
    window: {
      start: new Date(startTime).toISOString(),
      end: new Date(endTime).toISOString(),
      focusDays: Math.min(7, days),
      outlookDays: days,
    },
    bodyKeys: requestedKeys,
    events: forecastEvents,
    arcs: groupAspectArcs(forecastEvents),
    active,
  };
}

function normalizeSnapshot(result, bodyKeys, timestamp) {
  const positions = Array.isArray(result) ? result : result?.positions;
  if (!Array.isArray(positions)) throw new TypeError('Position provider must return a positions array.');

  const byKey = new Map(positions.map((position) => [position.key, position]));
  const missing = bodyKeys.filter((key) => !byKey.has(key));
  if (missing.length) throw new Error(`Position provider omitted: ${missing.join(', ')}`);

  return {
    timestamp: new Date(timestamp).toISOString(),
    positions: Object.fromEntries(bodyKeys.map((key) => [key, byKey.get(key)])),
  };
}

function inspectAt(snapshot, firstKey, secondKey) {
  return inspectRelationship(pairAt(snapshot, firstKey, secondKey));
}

function pairAt(snapshot, firstKey, secondKey) {
  return [snapshot.positions[firstKey], snapshot.positions[secondKey]];
}

function createPairs(keys) {
  const pairs = [];
  for (let first = 0; first < keys.length - 1; first += 1) {
    for (let second = first + 1; second < keys.length; second += 1) {
      pairs.push([keys[first], keys[second]]);
    }
  }
  return pairs;
}

async function refineBooleanBoundary({ low, high, precisionMs, test }) {
  const lowState = await test(low);
  while (high - low > precisionMs) {
    const middle = Math.round((low + high) / 2);
    if (await test(middle) === lowState) low = middle;
    else high = middle;
  }
  return high;
}

async function refineExactitude({ low, high, precisionMs, inspect, aspectKey }) {
  while (high - low > precisionMs) {
    const third = (high - low) / 3;
    const left = Math.round(low + third);
    const right = Math.round(high - third);
    const leftReading = await inspect(left);
    const rightReading = await inspect(right);
    const leftDeviation = leftReading.aspect.key === aspectKey ? leftReading.aspect.deviation : Infinity;
    const rightDeviation = rightReading.aspect.key === aspectKey ? rightReading.aspect.deviation : Infinity;
    if (leftDeviation <= rightDeviation) high = right;
    else low = left;
  }
  return Math.round((low + high) / 2);
}

function isExactitudeBracket(previous, current, next) {
  return current.aspect.key === previous.aspect.key
    && current.aspect.key === next.aspect.key
    && current.aspect.deviation <= previous.aspect.deviation
    && current.aspect.deviation < next.aspect.deviation;
}

function serializeEvent(type, timestamp, reading) {
  return {
    type,
    timestamp: new Date(timestamp).toISOString(),
    planetOne: reading.planetOne.key,
    planetTwo: reading.planetTwo.key,
    aspect: reading.aspect.key,
    deviation: reading.aspect.deviation,
    contact: reading.contact.kind,
    forcedBy: reading.contact.forcedBy,
  };
}

function deduplicateEvents(events) {
  const unique = new Map();
  for (const event of events) {
    const minute = event.timestamp.slice(0, 16);
    const key = [event.type, event.planetOne, event.aspect, event.planetTwo, minute].join(':');
    unique.set(key, event);
  }
  return [...unique.values()];
}

function validateBodyKeys(bodyKeys) {
  const keys = [...new Set(bodyKeys)];
  const unknown = keys.filter((key) => !BODY_CATALOG[key]);
  if (unknown.length) throw new RangeError(`Unknown Alchemystic bodies: ${unknown.join(', ')}`);
  if (keys.length < 2) throw new RangeError('At least two bodies are required.');
  return keys;
}

function toTimestamp(value) {
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (!Number.isFinite(timestamp)) throw new TypeError('A valid forecast start time is required.');
  return timestamp;
}
