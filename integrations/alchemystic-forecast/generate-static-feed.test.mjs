import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { writeStaticForecast } from './generate-static-feed.mjs';

test('writes a Pages-ready forecast artifact from the HTTP contract', async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), 'alchemystic-static-'));
  const feed = {
    schema: 'mystic-rebels.alchemystic-forecast.v1',
    sourceUrl: 'https://github.com/crossthelinellc/alchemystic-forecast-service',
    week: [],
    outlook: [],
  };
  const handler = async (_request, response) => {
    response.writeHead(200);
    response.end(JSON.stringify(feed));
  };

  try {
    const result = await writeStaticForecast({ handler, outputDirectory });
    assert.equal(result.feedPath, join(outputDirectory, 'api', 'alchemystic-forecast.json'));
    assert.deepEqual(JSON.parse(await readFile(result.feedPath, 'utf8')), feed);
    assert.match(await readFile(join(outputDirectory, 'index.html'), 'utf8'), /Forecast JSON/);
    assert.equal(await readFile(join(outputDirectory, '.nojekyll'), 'utf8'), '');
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
});
