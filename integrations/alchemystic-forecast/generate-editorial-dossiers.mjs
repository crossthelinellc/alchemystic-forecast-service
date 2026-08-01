import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { hasCompleteInterpretationMethod } from './forecast-feed.mjs';
import { scanUniversalForecast } from './forecast-scanner.mjs';
import { startOfDayInTimeZone } from './forecast-service.mjs';
import { buildWeeklyInterpretationDossiers } from './interpretation-dossier.mjs';
import { calculateSwissPositions } from './swetest-provider.mjs';

const DAY_MS = 86_400_000;

export async function createEditorialDossierQueue({
  positionProvider,
  loadInterpretations,
  scanForecast = scanUniversalForecast,
  createDossiers = buildWeeklyInterpretationDossiers,
  now = () => new Date(),
  timeZone = 'America/Chicago',
}) {
  if (typeof positionProvider !== 'function') throw new TypeError('A position provider is required.');
  if (typeof loadInterpretations !== 'function') throw new TypeError('An interpretation loader is required.');

  const focusStart = startOfDayInTimeZone(now(), timeZone);
  const forecast = await scanForecast({
    start: new Date(focusStart.getTime() - 60 * DAY_MS),
    days: 120,
    stepHours: 6,
    precisionMinutes: 1,
    positionProvider,
  });
  const [dossiers, interpretations] = await Promise.all([
    createDossiers({ forecast, positionProvider, now: focusStart }),
    loadInterpretations(),
  ]);
  const arcsById = new Map(forecast.arcs.map((arc) => [occurrenceIdFor(arc), arc]));

  return {
    ...dossiers,
    visibility: 'private_editorial_working_file',
    records: dossiers.records.map((record) => {
      const arc = arcsById.get(record.id);
      const editorial = interpretations[record.id];
      const approved = Boolean(
        editorial?.interpretation
        && editorial?.alignment
        && hasCompleteInterpretationMethod(arc, editorial.method, record.id)
      );
      return {
        ...record,
        editorialStatus: approved ? 'approved_and_published' : 'awaiting_approved_copy',
      };
    }),
  };
}

export async function writeEditorialDossierQueue({ queue, outputPath }) {
  if (queue?.schema !== 'mystic-rebels.alchemystic-interpretation-dossiers.v1') {
    throw new TypeError('A valid interpretation dossier queue is required.');
  }
  if (!outputPath) throw new Error('An explicit private dossier output path is required.');
  const destination = resolve(outputPath);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(queue, null, 2)}\n`, 'utf8');
  return destination;
}

function occurrenceIdFor(arc) {
  if (!arc?.moments?.pointOfExactitude) return '';
  return [arc.key, new Date(arc.moments.pointOfExactitude).toISOString()].join(':');
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const binaryPath = requiredEnvironment('SWETEST_BIN');
  const ephemerisPath = requiredEnvironment('SWISSEPH_PATH');
  const editorialPath = requiredEnvironment('ALCHEMYSTIC_EDITORIAL_PATH');
  const outputPath = requiredEnvironment('ALCHEMYSTIC_DOSSIER_OUTPUT_PATH');
  const queue = await createEditorialDossierQueue({
    positionProvider: (at) => calculateSwissPositions({ at, binaryPath, ephemerisPath }),
    loadInterpretations: async () => JSON.parse(await readFile(editorialPath, 'utf8')),
  });
  const destination = await writeEditorialDossierQueue({ queue, outputPath });
  console.log(`Wrote private editorial dossier queue to ${destination}`);
}

function requiredEnvironment(key) {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is required.`);
  return value;
}
