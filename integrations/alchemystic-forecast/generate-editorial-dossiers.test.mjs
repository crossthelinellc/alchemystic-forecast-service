import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  createEditorialDossierQueue,
  writeEditorialDossierQueue,
} from './generate-editorial-dossiers.mjs';

const occurrenceId = 'pallas:square:mercury:2026-08-03T12:00:00.000Z';
const arc = {
  key: 'pallas:square:mercury',
  planetOne: 'pallas',
  aspect: 'square',
  planetTwo: 'mercury',
  moments: {
    activating: '2026-08-01T12:00:00.000Z',
    pointOfExactitude: '2026-08-03T12:00:00.000Z',
    releasing: '2026-08-05T12:00:00.000Z',
  },
};

test('creates a private queue and marks only integrity-checked editorial as approved', async () => {
  let scanInput;
  const queue = await createEditorialDossierQueue({
    positionProvider: async () => ({ positions: [] }),
    now: () => new Date('2026-08-01T12:00:00.000Z'),
    scanForecast: async (input) => {
      scanInput = input;
      return { generatedAt: '2026-08-01T12:00:00.000Z', arcs: [arc] };
    },
    createDossiers: async () => ({
      schema: 'mystic-rebels.alchemystic-interpretation-dossiers.v1',
      generatedAt: '2026-08-01T12:00:00.000Z',
      window: {},
      records: [{ id: occurrenceId, status: 'calculation_ready_for_editorial_review' }],
    }),
    loadInterpretations: async () => ({
      [occurrenceId]: {
        interpretation: 'Approved copy.',
        alignment: 'Approved guidance.',
        method: {
          version: 'alchemystic-interpretation.v3',
          vocabularyVersion: 'alchemystic-vocabulary.2026-08-04.1',
          occurrenceId,
          planetOne: { body: 'pallas', condition: 'Assessed independently.' },
          planetTwo: {
            body: 'mercury',
            condition: 'Assessed independently.',
            dualRulership: {
              phases: ['activating', 'exactitude', 'releasing'],
              fields: [
                { sign: 'gemini', expression: 'inferior_mercury', conditions: { activating: [], exactitude: [], releasing: [] } },
                { sign: 'virgo', expression: 'superior_mercury', conditions: { activating: [], exactitude: [], releasing: [] } },
              ],
            },
          },
          aspect: { type: 'square', synthesis: 'Applied to both conditions.' },
        },
      },
    }),
  });

  assert.equal(scanInput.start.toISOString(), '2026-06-02T05:00:00.000Z');
  assert.equal(scanInput.days, 120);
  assert.equal(queue.visibility, 'private_editorial_working_file');
  assert.equal(queue.records[0].editorialStatus, 'approved_and_published');
});

test('writes the dossier queue only to an explicit local path', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'alchemystic-dossiers-'));
  const outputPath = join(directory, 'queue.json');
  const queue = {
    schema: 'mystic-rebels.alchemystic-interpretation-dossiers.v1',
    visibility: 'private_editorial_working_file',
    records: [],
  };

  try {
    assert.equal(await writeEditorialDossierQueue({ queue, outputPath }), outputPath);
    assert.deepEqual(JSON.parse(await readFile(outputPath, 'utf8')), queue);
    await assert.rejects(
      () => writeEditorialDossierQueue({ queue }),
      /explicit private dossier output path/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
