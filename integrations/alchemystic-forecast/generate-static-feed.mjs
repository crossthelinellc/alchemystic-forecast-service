import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { createProductionService } from './forecast-service.mjs';

export async function writeStaticForecast({ handler, outputDirectory }) {
  if (typeof handler !== 'function') throw new TypeError('A forecast request handler is required.');
  const destination = resolve(outputDirectory);
  const response = createResponse();
  await handler({ url: '/api/alchemystic-forecast', method: 'GET', headers: {} }, response);
  if (response.status !== 200) throw new Error(`Forecast generation returned ${response.status}.`);

  const feed = JSON.parse(response.body);
  if (feed.schema !== 'mystic-rebels.alchemystic-forecast.v1') {
    throw new Error('Forecast generation returned an unsupported schema.');
  }

  const feedPath = join(destination, 'api', 'alchemystic-forecast.json');
  await mkdir(dirname(feedPath), { recursive: true });
  await Promise.all([
    writeFile(feedPath, `${JSON.stringify(feed)}\n`, 'utf8'),
    writeFile(join(destination, '.nojekyll'), '', 'utf8'),
    writeFile(join(destination, 'index.html'), landingPage(feed), 'utf8'),
  ]);
  return { feed, feedPath };
}

function createResponse() {
  return {
    status: null,
    body: '',
    setHeader() {},
    writeHead(status) { this.status = status; },
    end(chunk = '') { this.body += chunk; },
  };
}

function landingPage(feed) {
  const sourceUrl = escapeHtml(feed.sourceUrl);
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Alchemystic forecast service</title>
<main>
  <h1>Alchemystic forecast service</h1>
  <p>Current universal forecast data for Mystic Rebels.</p>
  <p><a href="api/alchemystic-forecast.json">Forecast JSON</a> · <a href="${sourceUrl}">Corresponding source</a></p>
</main>
</html>
`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const outputDirectory = process.env.ALCHEMYSTIC_OUTPUT_DIR || 'dist';
  const { feedPath } = await writeStaticForecast({
    handler: createProductionService(),
    outputDirectory,
  });
  console.log(`Wrote ${feedPath}`);
}
