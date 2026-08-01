import assert from 'node:assert/strict';
import test from 'node:test';

import { scanUniversalForecast } from './forecast-scanner.mjs';

const start = new Date('2026-01-01T00:00:00Z');

function syntheticProvider(at) {
  const elapsedDays = (at.getTime() - start.getTime()) / 86_400_000;
  return {
    positions: [
      { key: 'mercury', longitude: 20 + elapsedDays, speed: 1 },
      { key: 'saturn', longitude: 90, speed: 0 },
    ],
  };
}

test('finds activation, exactitude, and release across a directional aspect arc', async () => {
  const forecast = await scanUniversalForecast({
    start,
    days: 18,
    stepHours: 12,
    precisionMinutes: 1,
    bodyKeys: ['mercury', 'saturn'],
    positionProvider: syntheticProvider,
  });

  const activation = forecast.events.find(({ type }) => type === 'true_aspect_activation');
  const exactitude = forecast.events.find(({ type }) => type === 'point_of_exactitude');
  const release = forecast.events.find(({ type }) => type === 'aspect_release');

  assert.equal(activation.timestamp.slice(0, 10), '2026-01-03');
  assert.equal(exactitude.timestamp.slice(0, 10), '2026-01-11');
  assert.equal(release.timestamp.slice(0, 10), '2026-01-18');
  assert.equal(exactitude.planetOne, 'mercury');
  assert.equal(exactitude.planetTwo, 'saturn');
  assert.equal(exactitude.aspect, 'sextile');
  assert.ok(exactitude.deviation <= 1 / 60);
  assert.ok(forecast.events.every(({ timestamp }) => new Date(timestamp) >= start));
  assert.equal(forecast.arcs.length, 1);
  assert.equal(forecast.arcs[0].moments.activating.slice(0, 10), '2026-01-03');
  assert.equal(forecast.arcs[0].moments.pointOfExactitude.slice(0, 10), '2026-01-11');
  assert.equal(forecast.arcs[0].moments.releasing.slice(0, 10), '2026-01-18');
});

test('uses a seven-day focus inside the configurable sixty-day default scan', async () => {
  const forecast = await scanUniversalForecast({
    start,
    bodyKeys: ['mercury', 'saturn'],
    positionProvider: syntheticProvider,
  });

  assert.equal(forecast.window.focusDays, 7);
  assert.equal(forecast.window.scanDays, 60);
});
