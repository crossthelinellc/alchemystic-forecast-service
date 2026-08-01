import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateSwissPositions, parseSwetestOutput } from './swetest-provider.mjs';

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
