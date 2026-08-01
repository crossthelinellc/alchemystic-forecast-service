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
