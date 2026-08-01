import {
  buildInterpretationPlan,
  buildUniversalInterpretation,
} from './interpretation-engine.mjs';

const DAY_MS = 86_400_000;
const RELEASE_SAMPLE_OFFSET_MS = 60_000;

export const INTERPRETATION_DOSSIER_SCHEMA = 'mystic-rebels.alchemystic-interpretation-dossiers.v1';

export async function buildWeeklyInterpretationDossiers({
  forecast,
  positionProvider,
  now,
  days = 7,
  includeMoon = false,
}) {
  if (!Array.isArray(forecast?.arcs)) throw new TypeError('A scanned universal forecast is required.');
  if (typeof positionProvider !== 'function') throw new TypeError('A position provider is required.');
  if (!Number.isFinite(days) || days <= 0) throw new RangeError('Dossier days must be positive.');

  const windowStart = toTime(now ?? forecast.window?.start);
  const windowEnd = windowStart + days * DAY_MS;
  const eligibleArcs = forecast.arcs
    .filter(hasCompleteArc)
    .filter((arc) => includeMoon || (arc.planetOne !== 'moon' && arc.planetTwo !== 'moon'))
    .map((arc) => ({ arc, weeklyAttention: attentionMoments(arc, windowStart, windowEnd) }))
    .filter(({ weeklyAttention }) => weeklyAttention.length > 0)
    .sort((one, two) => one.weeklyAttention[0].timestamp.localeCompare(two.weeklyAttention[0].timestamp));

  const records = [];
  for (const { arc, weeklyAttention } of eligibleArcs) {
    records.push({
      ...await buildAspectArcDossier({ arc, positionProvider }),
      weeklyAttention,
    });
  }

  return {
    schema: INTERPRETATION_DOSSIER_SCHEMA,
    generatedAt: forecast.generatedAt,
    window: {
      start: new Date(windowStart).toISOString(),
      end: new Date(windowEnd).toISOString(),
      days,
      selection: 'phase_moment_in_window',
      moonPolicy: includeMoon ? 'included' : 'separate_lunar_calendar',
    },
    records,
  };
}

function attentionMoments(arc, windowStart, windowEnd) {
  return [
    ['activating', arc.moments.activating],
    ['pointOfExactitude', arc.moments.pointOfExactitude],
    ['releasing', arc.moments.releasing],
  ].filter(([_phase, timestamp]) => {
    const time = toTime(timestamp);
    return time >= windowStart && time <= windowEnd;
  }).map(([phase, timestamp]) => ({ phase, timestamp: new Date(timestamp).toISOString() }));
}

export async function buildAspectArcDossier({ arc, positionProvider }) {
  if (!hasCompleteArc(arc)) throw new TypeError('A complete Aspect Arc is required.');
  if (typeof positionProvider !== 'function') throw new TypeError('A position provider is required.');

  const phaseDefinitions = [
    ['activating', arc.moments.activating, 0],
    ['pointOfExactitude', arc.moments.pointOfExactitude, 0],
    ['releasing', arc.moments.releasing, -RELEASE_SAMPLE_OFFSET_MS],
  ];
  const phases = {};

  for (const [phase, timestamp, offset] of phaseDefinitions) {
    const sampleTimestamp = new Date(toTime(timestamp) + offset).toISOString();
    const snapshot = await positionProvider(new Date(sampleTimestamp));
    const calculatedContext = buildUniversalInterpretation({
      positions: normalizePositions(snapshot),
      focus: [arc.planetOne, arc.planetTwo],
    });
    const context = normalizeFocusOrder(arc, calculatedContext, phase);
    phases[phase] = phaseDossier({ arc, phase, timestamp, sampleTimestamp, context });
  }

  const plan = buildInterpretationPlan({
    context: phases.pointOfExactitude.context,
    arc,
  });

  return {
    id: occurrenceIdFor(arc),
    status: 'calculation_ready_for_editorial_review',
    arc: {
      key: arc.key,
      planetOne: arc.planetOne,
      aspect: arc.aspect,
      planetTwo: arc.planetTwo,
      handoff: arc.handoff || {
        before: `${arc.planetOne}_to_${arc.planetTwo}`,
        after: `${arc.planetTwo}_to_${arc.planetOne}`,
      },
    },
    phases: Object.fromEntries(Object.entries(phases).map(([phase, dossier]) => [
      phase,
      withoutContext(dossier),
    ])),
    editorialContract: {
      vocabulary: plan.vocabulary,
      requiredMoments: plan.requiredMoments,
      orderedReading: plan.orderedReading.map(({ step, requirement, bodies }) => ({
        step,
        ...(requirement ? { requirement } : {}),
        ...(bodies ? { bodies } : {}),
      })),
      prohibitions: plan.prohibitions,
    },
  };
}

function phaseDossier({ arc, phase, timestamp, sampleTimestamp, context }) {
  const contact = contactForPhase(arc, phase, context.focus.contact);
  return {
    timestamp: new Date(timestamp).toISOString(),
    sampleTimestamp,
    direction: directionForPhase(arc, phase),
    contact,
    planetOne: context.planetaryCondition[arc.planetOne],
    planetTwo: context.planetaryCondition[arc.planetTwo],
    thematicLayers: context.thematicLayers,
    context,
  };
}

function contactForPhase(arc, phase, calculatedContact) {
  const type = phase === 'activating'
    ? 'true_aspect_activation'
    : phase === 'pointOfExactitude' ? 'point_of_exactitude' : 'aspect_release';
  const event = arc.events?.find((candidate) => candidate.type === type);
  const key = phase === 'activating'
    ? event?.toContact || event?.contact
    : phase === 'releasing'
      ? event?.fromContact || event?.contact
      : event?.contact || calculatedContact;
  return {
    type: contactLabel(key || calculatedContact),
    forcedBy: event?.forcedBy || null,
  };
}

function directionForPhase(arc, phase) {
  if (phase === 'activating') return `${arc.planetOne}_to_${arc.planetTwo}`;
  if (phase === 'releasing') return `${arc.planetTwo}_to_${arc.planetOne}`;
  return {
    from: `${arc.planetOne}_to_${arc.planetTwo}`,
    to: `${arc.planetTwo}_to_${arc.planetOne}`,
    event: 'directional_handoff',
  };
}

function normalizeFocusOrder(arc, context, phase) {
  const calculatedBodies = new Set([context.focus.planetOne, context.focus.planetTwo]);
  if (!calculatedBodies.has(arc.planetOne)
    || !calculatedBodies.has(arc.planetTwo)
    || context.focus.aspect !== arc.aspect) {
    throw new Error(`Calculated ${phase} conditions do not match ${arc.key}.`);
  }
  return {
    ...context,
    focus: {
      ...context.focus,
      planetOne: arc.planetOne,
      planetTwo: arc.planetTwo,
      aspect: arc.aspect,
    },
  };
}

function normalizePositions(snapshot) {
  const positions = Array.isArray(snapshot) ? snapshot : snapshot?.positions;
  if (!Array.isArray(positions)) throw new TypeError('Position provider must return a positions array.');
  return positions;
}

function withoutContext({ context: _context, ...dossier }) {
  return dossier;
}

function contactLabel(contact) {
  if (contact === 'direct') return 'True Aspect';
  if (contact === 'forced') return 'Forced Aspect';
  if (contact === 'fringe') return 'Fringe';
  return 'Out of Orb';
}

function hasCompleteArc(arc) {
  return Boolean(
    arc?.key
    && arc.planetOne
    && arc.aspect
    && arc.planetTwo
    && arc.moments?.activating
    && arc.moments?.pointOfExactitude
    && arc.moments?.releasing
  );
}

function occurrenceIdFor(arc) {
  return [arc.key, new Date(arc.moments.pointOfExactitude).toISOString()].join(':');
}

function toTime(value) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) throw new TypeError('A valid dossier timestamp is required.');
  return time;
}
