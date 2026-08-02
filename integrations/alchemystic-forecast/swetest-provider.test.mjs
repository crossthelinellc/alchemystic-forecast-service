import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateSwissEclipses,
  calculateSwissPositions,
  parseSwissEclipseOutput,
  parseSwetestOutput,
} from './swetest-provider.mjs';

const fixture = `Sun            , 128.3109139,  0.9561591
Moon           , 329.8793712, 12.5223543
Mercury        , 109.1317546,  0.7522702
Venus          , 173.5397464,  1.0402832
Mars           , 82.7305166,  0.6762589
Jupiter        , 126.8509679,  0.2214131
Saturn         , 14.7313301, -0.0079810
Uranus         , 64.9932835,  0.0328967
Neptune        ,  4.2654182, -0.0124663
Pluto          , 304.1871233, -0.0233728
Chiron         , 30.8617948,  0.0029916
mean Node      , 330.9721369, -0.0529673
mean Apogee    , 264.9463969,  0.1118356
Ceres          , 85.4467088,  0.3817421
Pallas         , 22.0872048,  0.0781103
Juno           , 302.5749944, -0.2406175
Vesta          , 25.5748937,  0.1691649`;

test('parses all authoritative version-one Swiss positions', () => {
  const result = parseSwetestOutput(fixture, new Date('2026-07-31T12:00:00Z'));

  assert.equal(result.frame, 'geocentric_tropical_apparent');
  assert.equal(result.positions.length, 18);
  assert.deepEqual(result.positions.at(-1), {
    key: 'mean_south_node',
    longitude: 150.9721369,
    speed: -0.0529673,
  });
});

test('rejects Swiss warnings instead of accepting a silent fallback', () => {
  assert.throws(
    () => parseSwetestOutput(`${fixture}\nwarning: using Moshier eph.`),
    /authoritative data/,
  );
});

test('can verify against a locally compiled official swetest binary', {
  skip: !process.env.SWETEST_BIN || !process.env.SWISSEPH_PATH,
}, () => {
  const result = calculateSwissPositions({
    at: '2026-07-31T12:00:00Z',
    binaryPath: process.env.SWETEST_BIN,
    ephemerisPath: process.env.SWISSEPH_PATH,
  });

  assert.equal(result.positions.length, 18);
  assert.ok(result.positions.every(({ longitude, speed }) => (
    Number.isFinite(longitude) && Number.isFinite(speed)
  )));
});

test('parses authoritative Swiss Ephemeris solar and lunar eclipse searches', () => {
  const solar = parseSwissEclipseOutput(`
total solar\t12.08.2026\t  17:45:59.2\t-132.445826 km\t1.0395/1.0178/1.0806
`, 'solar');
  const lunar = parseSwissEclipseOutput(`
partial lunar eclipse\t28.08.2026\t  04:12:58.0\t0.9299/1.9646
penumb. lunar eclipse\t20.02.2027\t  23:12:52.8\t0.0000/0.9266
`, 'lunar');

  assert.deepEqual(solar[0], {
    kind: 'solar_eclipse',
    eclipseType: 'total',
    timestamp: '2026-08-12T17:45:59.200Z',
    source: 'swiss_ephemeris_global_eclipse_search',
  });
  assert.equal(lunar[0].eclipseType, 'partial');
  assert.equal(lunar[0].timestamp, '2026-08-28T04:12:58.000Z');
  assert.equal(lunar[1].eclipseType, 'penumbral');
});

test('finds the August 2026 eclipses with the pinned official swetest binary', {
  skip: !process.env.SWETEST_BIN || !process.env.SWISSEPH_PATH,
}, () => {
  const eclipses = calculateSwissEclipses({
    start: '2026-08-01T00:00:00Z',
    end: '2026-08-31T23:59:59Z',
    binaryPath: process.env.SWETEST_BIN,
    ephemerisPath: process.env.SWISSEPH_PATH,
  });
  assert.deepEqual(eclipses.map(({ kind, eclipseType }) => [kind, eclipseType]), [
    ['solar_eclipse', 'total'],
    ['lunar_eclipse', 'partial'],
  ]);
});
