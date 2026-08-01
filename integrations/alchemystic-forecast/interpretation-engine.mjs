import { BODY_CATALOG, inspectRelationship, normalizeLongitude } from './engine.mjs';
import { vocabularyForInterpretation } from './interpretation-vocabulary.mjs';

export const ZODIAC_SIGNS = Object.freeze([
  { key: 'aries', label: 'Aries', ruler: 'mars' },
  { key: 'taurus', label: 'Taurus', ruler: 'venus' },
  { key: 'gemini', label: 'Gemini', ruler: 'mercury' },
  { key: 'cancer', label: 'Cancer', ruler: 'moon' },
  { key: 'leo', label: 'Leo', ruler: 'sun' },
  { key: 'virgo', label: 'Virgo', ruler: 'mercury' },
  { key: 'libra', label: 'Libra', ruler: 'venus' },
  { key: 'scorpio', label: 'Scorpio', ruler: 'pluto' },
  { key: 'sagittarius', label: 'Sagittarius', ruler: 'jupiter' },
  { key: 'capricorn', label: 'Capricorn', ruler: 'saturn' },
  { key: 'aquarius', label: 'Aquarius', ruler: 'uranus' },
  { key: 'pisces', label: 'Pisces', ruler: 'neptune' },
]);

export const DUAL_RULERSHIP_FIELDS = Object.freeze({
  mercury: Object.freeze([
    Object.freeze({ sign: 'gemini', expression: 'inferior_mercury' }),
    Object.freeze({ sign: 'virgo', expression: 'superior_mercury' }),
  ]),
  venus: Object.freeze([
    Object.freeze({ sign: 'taurus', expression: 'inferior_venus' }),
    Object.freeze({ sign: 'libra', expression: 'superior_venus' }),
  ]),
});

export function zodiacPlacement(longitude) {
  const normalized = normalizeLongitude(longitude);
  const sign = ZODIAC_SIGNS[Math.floor(normalized / 30)];
  return {
    sign: sign.key,
    signLabel: sign.label,
    signRuler: sign.ruler,
    degreeInSign: normalized % 30,
    longitude: normalized,
  };
}

export function buildUniversalInterpretation({ positions, focus }) {
  const byKey = normalizePositions(positions);
  const relationships = buildRelationships([...byKey.values()]);
  const focusReading = inspectRelationship([
    requiredPosition(byKey, focus[0]),
    requiredPosition(byKey, focus[1]),
  ]);
  const focusKeys = [focusReading.planetOne.key, focusReading.planetTwo.key];
  const withKeys = directlyLinkedKeys(byKey, relationships, focusKeys);
  const whileKeys = [...byKey.keys()].filter((key) => !withKeys.has(key));

  return {
    focus: {
      planetOne: focusReading.planetOne.key,
      planetTwo: focusReading.planetTwo.key,
      aspect: focusReading.aspect.key,
      contact: focusReading.contact.kind,
      deviation: focusReading.aspect.deviation,
    },
    planetaryCondition: Object.fromEntries(
      [...byKey.keys()].map((key) => [key, describeCondition(key, byKey, relationships)]),
    ),
    thematicLayers: {
      with: [...withKeys].map((key) => describeLayer(key, byKey)),
      while: whileKeys.map((key) => describeLayer(key, byKey)),
    },
  };
}

export function groupAspectArcs(events) {
  const arcs = [];
  const open = new Map();
  const sorted = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  for (const event of sorted) {
    const key = [event.planetOne, event.aspect, event.planetTwo].join(':');
    let arc = open.get(key);
    if (event.type === 'true_aspect_activation' || !arc) {
      arc = {
        key,
        planetOne: event.planetOne,
        planetTwo: event.planetTwo,
        aspect: event.aspect,
        moments: { activating: null, pointOfExactitude: null, releasing: null },
        events: [],
      };
      arcs.push(arc);
      open.set(key, arc);
    }

    arc.events.push(event);
    if (event.type === 'true_aspect_activation') arc.moments.activating = event.timestamp;
    if (event.type === 'point_of_exactitude') {
      arc.moments.pointOfExactitude = event.timestamp;
      arc.handoff = {
        before: `${event.planetOne}_to_${event.planetTwo}`,
        after: `${event.planetTwo}_to_${event.planetOne}`,
      };
    }
    if (event.type === 'aspect_release') {
      arc.moments.releasing = event.timestamp;
      open.delete(key);
    }
  }

  return arcs;
}

export function buildInterpretationPlan({ context, arc }) {
  if (!context?.focus || !context?.planetaryCondition) {
    throw new TypeError('A universal interpretation context is required.');
  }
  if (!arc?.moments) throw new TypeError('An Aspect Arc record is required.');

  const one = context.focus.planetOne;
  const two = context.focus.planetTwo;
  const oneCondition = context.planetaryCondition[one];
  const twoCondition = context.planetaryCondition[two];
  if (!oneCondition || !twoCondition) throw new Error('Both focus planets require condition records.');
  assertDualRulershipComplete(one, oneCondition);
  assertDualRulershipComplete(two, twoCondition);
  const planetOneStep = conditionStep('planet_one_condition', one, oneCondition);
  const planetTwoStep = conditionStep('planet_two_condition', two, twoCondition);

  return {
    transit: `${one}:${context.focus.aspect}:${two}`,
    vocabulary: vocabularyForInterpretation({
      planetOne: one,
      aspect: context.focus.aspect,
      planetTwo: two,
    }),
    requiredMoments: {
      activating: {
        timestamp: arc.moments.activating,
        purpose: 'wake_up_call_and_new_theme_entry',
      },
      pointOfExactitude: {
        timestamp: arc.moments.pointOfExactitude,
        purpose: 'directional_handoff',
        from: `${one}_to_${two}`,
        to: `${two}_to_${one}`,
      },
      releasing: {
        timestamp: arc.moments.releasing,
        purpose: 'final_heightened_expression_before_dropoff',
      },
    },
    orderedReading: [
      planetOneStep,
      planetTwoStep,
      {
        step: 'ordered_aspect_synthesis',
        planetOne: one,
        aspect: context.focus.aspect,
        planetTwo: two,
        contact: context.focus.contact,
        inputs: {
          planetOneCondition: planetOneStep,
          planetTwoCondition: planetTwoStep,
        },
        requirement: 'apply_aspect_to_both_assessed_planetary_conditions',
      },
      { step: 'with_layers', bodies: context.thematicLayers.with.map(({ body }) => body) },
      { step: 'while_layers', bodies: context.thematicLayers.while.map(({ body }) => body) },
      { step: 'alignment_guidance', requirement: 'specific_practical_non_deterministic' },
    ],
    prohibitions: [
      'isolated_aspect_interpretation',
      'sign_as_final_destination',
      'final_dispositor',
      'merge_while_layers_into_with_theme',
      'generic_good_bad_scoring',
      'unassessed_planet_in_aspect_synthesis',
      'partial_mercury_venus_rulership_field',
    ],
  };
}

function describeCondition(key, byKey, relationships) {
  const position = requiredPosition(byKey, key);
  const placement = zodiacPlacement(position.longitude);
  const rulerPosition = byKey.get(placement.signRuler);
  const channels = describeChannels(key, relationships);
  const ruledSigns = ZODIAC_SIGNS.filter((sign) => sign.ruler === key).map((sign) => sign.key);
  const conditionsCarriedForward = [...byKey.values()]
    .filter((candidate) => ruledSigns.includes(zodiacPlacement(candidate.longitude).sign))
    .map((candidate) => summarizeCarriedCondition(candidate, relationships));
  const dualRulership = describeDualRulership(key, conditionsCarriedForward);

  return {
    body: key,
    motion: motionFromSpeed(position),
    throughPoint: placement,
    direction: rulerPosition ? {
      ruler: placement.signRuler,
      placement: zodiacPlacement(rulerPosition.longitude),
    } : { ruler: placement.signRuler, placement: null },
    delegate: {
      ruledSigns,
      bodiesCarriedForward: conditionsCarriedForward.map(({ body }) => body),
      conditionsCarriedForward,
    },
    dualRulership,
    channels,
  };
}

function describeChannels(key, relationships) {
  return relationships
    .filter((relationship) => relationship.contact.kind !== 'out_of_orb')
    .filter((relationship) => (
      relationship.planetOne.key === key || relationship.planetTwo.key === key
    ))
    .map((relationship) => ({
      role: relationship.planetOne.key === key ? 'aspecting' : 'receiving',
      planetOne: relationship.planetOne.key,
      planetTwo: relationship.planetTwo.key,
      aspect: relationship.aspect.key,
      contact: relationship.contact.kind,
      deviation: relationship.aspect.deviation,
    }));
}

function summarizeCarriedCondition(position, relationships) {
  const throughPoint = zodiacPlacement(position.longitude);
  return {
    body: position.key,
    motion: motionFromSpeed(position),
    throughPoint,
    direction: { ruler: throughPoint.signRuler },
    channels: describeChannels(position.key, relationships),
  };
}

function describeDualRulership(key, conditionsCarriedForward) {
  const configuredFields = DUAL_RULERSHIP_FIELDS[key];
  if (!configuredFields) return null;
  return {
    planet: key,
    requirement: 'both_ruled_sign_fields_culminate_in_planetary_condition',
    fields: configuredFields.map(({ sign, expression }) => ({
      sign,
      expression,
      conditions: conditionsCarriedForward.filter(({ throughPoint }) => throughPoint.sign === sign),
    })),
  };
}

function assertDualRulershipComplete(body, condition) {
  const configuredFields = DUAL_RULERSHIP_FIELDS[body];
  if (!configuredFields) return;
  const fields = condition.dualRulership?.fields;
  const complete = condition.dualRulership?.requirement === 'both_ruled_sign_fields_culminate_in_planetary_condition'
    && configuredFields.every(({ sign, expression }) => fields?.some((field) => (
      field.sign === sign && field.expression === expression && Array.isArray(field.conditions)
    )));
  if (!complete) throw new Error(`Both ruled-sign fields are required for ${body}.`);
}

function conditionStep(step, body, condition) {
  return {
    step,
    body,
    motion: condition.motion,
    channels: condition.channels,
    throughPoint: condition.throughPoint,
    direction: condition.direction,
    delegate: condition.delegate,
    dualRulership: condition.dualRulership,
  };
}

function buildRelationships(positions) {
  const relationships = [];
  for (let first = 0; first < positions.length - 1; first += 1) {
    for (let second = first + 1; second < positions.length; second += 1) {
      relationships.push(inspectRelationship([positions[first], positions[second]]));
    }
  }
  return relationships;
}

function directlyLinkedKeys(byKey, relationships, focusKeys) {
  const linked = new Set(focusKeys);
  for (const relationship of relationships) {
    if (relationship.contact.kind === 'out_of_orb') continue;
    const one = relationship.planetOne.key;
    const two = relationship.planetTwo.key;
    if (focusKeys.includes(one)) linked.add(two);
    if (focusKeys.includes(two)) linked.add(one);
  }

  for (const key of focusKeys) {
    linked.add(zodiacPlacement(requiredPosition(byKey, key).longitude).signRuler);
  }
  return new Set([...linked].filter((key) => byKey.has(key)));
}

function describeLayer(key, byKey) {
  const position = requiredPosition(byKey, key);
  const placement = zodiacPlacement(position.longitude);
  return { body: key, sign: placement.sign, ruler: placement.signRuler };
}

function normalizePositions(positions) {
  if (!Array.isArray(positions)) throw new TypeError('Positions must be an array.');
  const byKey = new Map();
  for (const position of positions) {
    if (!BODY_CATALOG[position.key]) throw new RangeError(`Unknown Alchemystic body: ${position.key}`);
    byKey.set(position.key, { ...position, longitude: normalizeLongitude(position.longitude) });
  }
  return byKey;
}

function requiredPosition(byKey, key) {
  const position = byKey.get(key);
  if (!position) throw new Error(`Position omitted: ${key}`);
  return position;
}

function motionFromSpeed(position) {
  if (position.key === 'mean_north_node' || position.key === 'mean_south_node') return 'retrograde';
  if (position.key === 'sun' || position.key === 'moon') return 'prograde';
  if (Math.abs(position.speed) <= 0.0001) return 'stationary_inertial';
  return position.speed < 0 ? 'retrograde' : 'prograde';
}
