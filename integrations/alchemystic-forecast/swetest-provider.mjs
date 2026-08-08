import { execFileSync } from 'node:child_process';

import { normalizeLongitude } from './engine.mjs';

const BODY_SEQUENCE = '0123456789DmAFGHI';
const OUTPUT_TO_KEY = Object.freeze({
  Sun: 'sun',
  Moon: 'moon',
  Mercury: 'mercury',
  Venus: 'venus',
  Mars: 'mars',
  Jupiter: 'jupiter',
  Saturn: 'saturn',
  Uranus: 'uranus',
  Neptune: 'neptune',
  Pluto: 'pluto',
  Chiron: 'chiron',
  'mean Node': 'mean_north_node',
  'mean Apogee': 'mean_black_moon_lilith',
  Ceres: 'ceres',
  Pallas: 'pallas',
  Juno: 'juno',
  Vesta: 'vesta',
});

export function calculateSwissPositions({ at, binaryPath, ephemerisPath }) {
  const instant = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(instant.getTime())) throw new TypeError('A valid forecast timestamp is required.');
  if (!binaryPath) throw new TypeError('The swetest binary path is required.');
  if (!ephemerisPath) throw new TypeError('The Swiss Ephemeris data path is required.');

  const output = execFileSync(binaryPath, buildArguments(instant, ephemerisPath), {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return parseSwetestOutput(output, instant);
}

export function calculateSwissNatalChart({ at, latitude, longitude, binaryPath, ephemerisPath }) {
  const instant = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(instant.getTime())) throw new TypeError('A valid UTC birth instant is required.');
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new RangeError('Birth latitude must be between -90 and 90 degrees.');
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new RangeError('Birth longitude must be between -180 and 180 degrees.');
  }
  if (!binaryPath) throw new TypeError('The swetest binary path is required.');
  if (!ephemerisPath) throw new TypeError('The Swiss Ephemeris data path is required.');

  const positions = calculateSwissPositions({ at: instant, binaryPath, ephemerisPath });
  const houseOutput = execFileSync(
    binaryPath,
    buildHouseArguments(instant, longitude, latitude, ephemerisPath),
    { encoding: 'utf8', maxBuffer: 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const houses = parseSwetestHouses(houseOutput);
  return {
    ...positions,
    ascendantLongitude: houses.ascendantLongitude,
    midheavenLongitude: houses.midheavenLongitude,
    wholeSignCusps: houses.wholeSignCusps,
    location: { latitude, longitude },
    houseModel: 'alchemystic_whole_sign_earth_contexts',
  };
}

export function calculateSwissEclipses({ start, end, binaryPath, ephemerisPath }) {
  const startInstant = start instanceof Date ? start : new Date(start);
  const endInstant = end instanceof Date ? end : new Date(end);
  if (Number.isNaN(startInstant.getTime()) || Number.isNaN(endInstant.getTime()) || endInstant <= startInstant) {
    throw new TypeError('A valid eclipse search range is required.');
  }
  if (!binaryPath) throw new TypeError('The swetest binary path is required.');
  if (!ephemerisPath) throw new TypeError('The Swiss Ephemeris data path is required.');

  return ['solar', 'lunar'].flatMap((kind) => {
    const output = execFileSync(binaryPath, buildEclipseArguments(startInstant, ephemerisPath, kind), {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return parseSwissEclipseOutput(output, kind);
  }).filter(({ timestamp }) => {
    const time = new Date(timestamp).getTime();
    return time >= startInstant.getTime() && time <= endInstant.getTime();
  }).sort((one, two) => one.timestamp.localeCompare(two.timestamp));
}

export function parseSwetestOutput(output, instant = new Date()) {
  if (/\b(error|warning):/i.test(output)) {
    throw new Error(`Swiss Ephemeris did not produce authoritative data:\n${output.trim()}`);
  }

  const positions = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parsePositionLine);

  const expectedCount = Object.keys(OUTPUT_TO_KEY).length;
  if (positions.length !== expectedCount) {
    throw new Error(`Expected ${expectedCount} Swiss Ephemeris positions; received ${positions.length}.`);
  }

  const meanNorthNode = positions.find(({ key }) => key === 'mean_north_node');
  positions.push({
    key: 'mean_south_node',
    longitude: normalizeLongitude(meanNorthNode.longitude + 180),
    speed: meanNorthNode.speed,
  });

  return {
    timestamp: instant.toISOString(),
    frame: 'geocentric_tropical_apparent',
    ephemeris: 'swiss',
    positions,
  };
}

export function parseSwissEclipseOutput(output, requestedKind) {
  if (!['solar', 'lunar'].includes(requestedKind)) throw new RangeError('Eclipse kind must be solar or lunar.');
  if (/\b(error|warning):/i.test(output)) {
    throw new Error(`Swiss Ephemeris did not produce authoritative eclipse data:\n${output.trim()}`);
  }

  const eventPattern = /^(total|partial|annular|annular-total|penumb\.)\s+(solar|lunar)(?:\s+eclipse)?\s+(\d{1,2}\.\d{1,2}\.\d{4})\s+(\d{1,2}:\s*\d{1,2}:\d{1,2}(?:\.\d+)?)/i;
  return output.split(/\r?\n/).map((line) => line.trim()).flatMap((line) => {
    const match = line.match(eventPattern);
    if (!match) return [];
    const [, rawType, kind, rawDate, rawTime] = match;
    if (kind.toLowerCase() !== requestedKind) return [];
    return [{
      kind: `${requestedKind}_eclipse`,
      eclipseType: rawType.toLowerCase() === 'penumb.' ? 'penumbral' : rawType.toLowerCase(),
      timestamp: eclipseTimestamp(rawDate, rawTime),
      source: 'swiss_ephemeris_global_eclipse_search',
    }];
  });
}

export function parseSwetestHouses(output) {
  if (/\b(error|warning):/i.test(output)) {
    throw new Error(`Swiss Ephemeris did not produce authoritative house data:\n${output.trim()}`);
  }
  if (!/Houses system W \(equal\/ whole sign\)/.test(output)) {
    throw new Error('Swiss Ephemeris did not confirm Whole-Sign house output.');
  }
  const cusps = [...output.matchAll(/^house\s+(\d{1,2})\s+(-?\d+(?:\.\d+)?)/gm)]
    .map((match) => ({ house: Number(match[1]), longitude: normalizeLongitude(Number(match[2])) }));
  const ascendant = output.match(/^Ascendant\s+(-?\d+(?:\.\d+)?)/m);
  const midheaven = output.match(/^MC\s+(-?\d+(?:\.\d+)?)/m);
  if (cusps.length !== 12 || !ascendant || !midheaven) {
    throw new Error('Swiss Ephemeris returned incomplete Whole-Sign house data.');
  }
  return {
    wholeSignCusps: cusps.map(({ longitude }) => longitude),
    ascendantLongitude: normalizeLongitude(Number(ascendant[1])),
    midheavenLongitude: normalizeLongitude(Number(midheaven[1])),
  };
}

function buildArguments(instant, ephemerisPath) {
  const day = instant.getUTCDate();
  const month = instant.getUTCMonth() + 1;
  const year = instant.getUTCFullYear();
  const hour = String(instant.getUTCHours()).padStart(2, '0');
  const minute = String(instant.getUTCMinutes()).padStart(2, '0');
  const second = String(instant.getUTCSeconds()).padStart(2, '0');

  return [
    `-edir${ephemerisPath}`,
    `-b${day}.${month}.${year}`,
    `-ut${hour}:${minute}:${second}`,
    `-p${BODY_SEQUENCE}`,
    '-fPls',
    '-g,',
    '-head',
    '-eswe',
    '-speed',
  ];
}

function buildHouseArguments(instant, longitude, latitude, ephemerisPath) {
  const hour = String(instant.getUTCHours()).padStart(2, '0');
  const minute = String(instant.getUTCMinutes()).padStart(2, '0');
  const second = String(instant.getUTCSeconds()).padStart(2, '0');
  return [
    `-edir${ephemerisPath}`,
    `-b${instant.getUTCDate()}.${instant.getUTCMonth() + 1}.${instant.getUTCFullYear()}`,
    `-ut${hour}:${minute}:${second}`,
    `-house${longitude},${latitude},W`,
    '-fPls',
    '-eswe',
  ];
}

function buildEclipseArguments(instant, ephemerisPath, kind) {
  return [
    `-edir${ephemerisPath}`,
    `-b${instant.getUTCDate()}.${instant.getUTCMonth() + 1}.${instant.getUTCFullYear()}`,
    kind === 'solar' ? '-solecl' : '-lunecl',
    '-n8',
    '-eswe',
  ];
}

function eclipseTimestamp(rawDate, rawTime) {
  const [day, month, year] = rawDate.split('.').map(Number);
  const [hour, minute, rawSecond] = rawTime.replace(/\s+/g, '').split(':');
  const seconds = Number(rawSecond);
  const wholeSeconds = Math.trunc(seconds);
  const milliseconds = Math.round((seconds - wholeSeconds) * 1000);
  return new Date(Date.UTC(
    year,
    month - 1,
    day,
    Number(hour),
    Number(minute),
    wholeSeconds,
    milliseconds,
  )).toISOString();
}

function parsePositionLine(line) {
  const [rawName, rawLongitude, rawSpeed, ...extra] = line.split(',');
  const name = rawName?.trim();
  const key = OUTPUT_TO_KEY[name];
  const longitude = Number(rawLongitude);
  const speed = Number(rawSpeed);

  if (extra.length || !key || !Number.isFinite(longitude) || !Number.isFinite(speed)) {
    throw new Error(`Unexpected Swiss Ephemeris output: ${line}`);
  }

  return { key, longitude: normalizeLongitude(longitude), speed };
}
