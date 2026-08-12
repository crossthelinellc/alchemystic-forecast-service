import { buildAspectArcDossier } from './interpretation-dossier.mjs';
import {
  ASPECT_VOCABULARY,
  BODY_VOCABULARY,
  INTERPRETATION_VOCABULARY_VERSION,
  SIGN_VOCABULARY,
} from './interpretation-vocabulary.mjs';

const PHASES = Object.freeze(['activating', 'exactitude', 'releasing']);
const DOSSIER_PHASE = Object.freeze({
  activating: 'activating',
  exactitude: 'pointOfExactitude',
  releasing: 'releasing',
});

const BODY_LABELS = Object.freeze({
  sun: 'Sun', moon: 'Moon', mercury: 'Mercury', venus: 'Venus', mars: 'Mars',
  jupiter: 'Jupiter', saturn: 'Saturn', uranus: 'Uranus', neptune: 'Neptune',
  pluto: 'Pluto', chiron: 'Chiron', vesta: 'Vesta', juno: 'Juno', ceres: 'Ceres',
  pallas: 'Pallas', mean_black_moon_lilith: 'Mean Black Moon Lilith',
  mean_north_node: 'Mean North Node', mean_south_node: 'Mean South Node',
});

const SIGN_LABELS = Object.freeze({
  aries: 'Aries', taurus: 'Taurus', gemini: 'Gemini', cancer: 'Cancer',
  leo: 'Leo', virgo: 'Virgo', libra: 'Libra', scorpio: 'Scorpio',
  sagittarius: 'Sagittarius', capricorn: 'Capricorn', aquarius: 'Aquarius', pisces: 'Pisces',
});

const ASPECT_LABELS = Object.freeze({
  conjunction: 'Conjunction', semi_sextile: 'Semi-sextile', sextile: 'Sextile',
  square: 'Square', trine: 'Trine', quincunx: 'Quincunx', opposition: 'Opposition',
});

const ASPECT_VERBS = Object.freeze({
  conjunction: 'Conjuncts', semi_sextile: 'Semi-sextiles', sextile: 'Sextiles',
  square: 'Squares', trine: 'Trines', quincunx: 'Quincunxes', opposition: 'Opposes',
});

const THROUGH_POINT_THEMES = Object.freeze({
  aries: 'direct action, assertion, initiation, and physical effort',
  taurus: 'resources, money, possessions, taste, and personal worth',
  gemini: 'thought, curiosity, information, words, and choices',
  cancer: 'feeling, memory, needs, home, and safety',
  leo: 'vitality, will, purpose, joy, visibility, and creative presence',
  virgo: 'observation, criticism, scrutiny, details, function, and efficiency',
  libra: 'mutual exchange, conversation, relationship, fairness, and diplomacy',
  scorpio: 'hidden depth, investigation, trauma, power, and transformation',
  sagittarius: 'possibility, abundance, belief, learning, and larger perspective',
  capricorn: 'time, discipline, limits, goals, responsibility, and completion',
  aquarius: 'objective insight, invention, disruption, technology, and improvement',
  pisces: 'the unseen, imagination, dreams, uncertainty, compassion, and release',
});

const DAILY_THROUGH_POINTS = Object.freeze({
  aries: 'direct action and immediate effort',
  taurus: 'what is valuable, workable, and worth keeping',
  gemini: 'the words, choices, and information in motion',
  cancer: 'feeling, memory, needs, and safety',
  leo: 'purpose, visibility, and creative presence',
  virgo: 'scrutiny, details, function, and efficiency',
  libra: 'relationship, exchange, fairness, and cooperation',
  scorpio: 'what is hidden, consequential, and changing underneath',
  sagittarius: 'belief, possibility, learning, and the larger view',
  capricorn: 'limits, responsibility, endurance, and completion',
  aquarius: 'disruption, objective insight, and improvement',
  pisces: 'what cannot yet be clearly seen or contained',
});

const DAILY_BODY_LANGUAGE = Object.freeze({
  sun: 'your sense of purpose and aliveness',
  moon: 'your need for safety and emotional steadiness',
  mercury: 'the message, the decision, and what needs to make sense',
  venus: 'what you value, desire, and want to keep',
  mars: 'the move you are ready to make',
  jupiter: 'what wants more room to grow',
  saturn: 'the boundary, responsibility, or limit that has to hold',
  uranus: 'the change that refuses to stay contained',
  neptune: 'what you can feel before you can fully explain it',
  pluto: 'what can no longer remain buried',
  chiron: 'the tender place asking for a wiser response',
  vesta: 'the purpose that deserves your devotion',
  juno: 'the agreement you are willing to live inside',
  ceres: 'what needs care, sustenance, and enough support to continue',
  pallas: 'the pattern you can see and the strategy it suggests',
  mean_black_moon_lilith: 'the truth or desire that will not keep asking permission',
  mean_north_node: 'the unfamiliar direction asking to be developed',
  mean_south_node: 'the familiar pattern that comes easily but cannot lead forever',
});

export async function buildFoundationalTranslations({ forecast, positionProvider }) {
  if (!Array.isArray(forecast?.arcs)) throw new TypeError('A scanned universal forecast is required.');
  if (typeof positionProvider !== 'function') throw new TypeError('A position provider is required.');

  const translations = {};
  for (const arc of forecast.arcs.filter(isEligibleArc)) {
    const dossier = await buildAspectArcDossier({ arc, positionProvider });
    translations[dossier.id] = foundationalTranslationForDossier(dossier);
  }
  return translations;
}

export function foundationalTranslationForDossier(dossier) {
  assertDossier(dossier);
  const { arc, phases } = dossier;
  const exactitude = phases.pointOfExactitude;
  const one = exactitude.planetOne;
  const two = exactitude.planetTwo;
  const aspect = requiredVocabulary(ASPECT_VOCABULARY, arc.aspect, 'aspect');
  const oneReading = conditionReading(one, arc.planetTwo);
  const twoReading = conditionReading(two, arc.planetOne);
  const contactReading = contactArcReading(dossier);
  const aspectName = requiredLabel(ASPECT_LABELS, arc.aspect);
  const oneName = requiredLabel(BODY_LABELS, arc.planetOne);
  const twoName = requiredLabel(BODY_LABELS, arc.planetTwo);

  const interpretation = [
    oneReading.interpretation,
    twoReading.interpretation,
    `The ${aspectName} is ${lowerFirst(aspect.core)}: ${personalizeAspect(`${aspect.directional.fromPlanet} ${aspect.directional.toPlanet}`, oneName, twoName)}`,
    contactReading,
    `At Point of Exactitude, the current hands off from ${oneName} → ${twoName} to ${twoName} → ${oneName}.`,
  ].join(' ');

  const alignment = alchemyFor({ aspectKey: arc.aspect, one, two });

  const conditionSummary = [
    oneReading.conditionSummary,
    twoReading.conditionSummary,
    thematicLayerSummary(exactitude.thematicLayers, [arc.planetOne, arc.planetTwo]),
  ].filter(Boolean).join(' ');

  return {
    tier: 'foundational',
    interpretation,
    alignment,
    daily: dailyTranslationForDossier(dossier),
    conditionSummary,
    articleUrl: '',
    method: {
      version: 'alchemystic-interpretation.v3',
      vocabularyVersion: INTERPRETATION_VOCABULARY_VERSION,
      occurrenceId: dossier.id,
      planetOne: methodCondition(dossier, arc.planetOne, conditionSummaryForBody(one)),
      planetTwo: methodCondition(dossier, arc.planetTwo, conditionSummaryForBody(two)),
      aspect: {
        type: arc.aspect,
        synthesis: `The ${aspectName} applies ${lowerFirst(aspect.core)} to the separately assessed conditions of ${oneName} and ${twoName}, preserving the directional handoff at exactitude.`,
      },
    },
  };
}

function dailyTranslationForDossier(dossier) {
  const { arc } = dossier;
  const exactitude = dossier.phases.pointOfExactitude;
  const one = exactitude.planetOne;
  const two = exactitude.planetTwo;
  const oneName = requiredLabel(BODY_LABELS, arc.planetOne);
  const twoName = requiredLabel(BODY_LABELS, arc.planetTwo);
  const oneLife = requiredLabel(DAILY_BODY_LANGUAGE, arc.planetOne);
  const twoLife = requiredLabel(DAILY_BODY_LANGUAGE, arc.planetTwo);
  const oneThrough = requiredLabel(DAILY_THROUGH_POINTS, one.throughPoint.sign);
  const twoThrough = requiredLabel(DAILY_THROUGH_POINTS, two.throughPoint.sign);
  const language = dailyAspectLanguage(arc.aspect, { oneName, twoName, oneLife, twoLife });
  const setting = one.throughPoint.sign === two.throughPoint.sign
    ? `Both ${oneLife} and ${twoLife} are moving through ${oneThrough}.`
    : `${capitalize(oneLife)} is moving through ${oneThrough}. At the same time, ${twoLife} is moving through ${twoThrough}.`;

  return {
    headline: language.headline,
    current: `${setting} ${language.current}`,
    watchFor: language.watchFor,
    alchemy: language.alchemy,
    withBodies: unique((exactitude.thematicLayers?.with || []).map(({ body }) => body)),
    whileBodies: unique((exactitude.thematicLayers?.while || []).map(({ body }) => body)),
  };
}

function dailyAspectLanguage(aspectKey, names) {
  const { oneName, twoName, oneLife, twoLife } = names;
  const language = {
    conjunction: {
      headline: 'Everything is converging on one honest priority.',
      current: 'Two needs are asking for the same attention. The choice is not which one matters; it is what they are meant to accomplish together.',
      watchFor: `Tunnel vision. ${oneName} or ${twoName} can quietly take over the whole story.`,
      alchemy: `Choose one clear priority. Let ${oneLife} and ${twoLife} serve it together without allowing either one to disappear.`,
    },
    semi_sextile: {
      headline: 'Something small needs to be named before this can move.',
      current: 'What looks like hesitation may actually be a missing requirement. The next step gets cleaner once the quiet need underneath it is acknowledged.',
      watchFor: `Pushing ${oneName} forward before hearing what ${twoName} needs.`,
      alchemy: `Name what ${twoLife} needs first. Then let ${oneLife} move only what can genuinely work with it.`,
    },
    sextile: {
      headline: 'The opening is real—but it needs your participation.',
      current: 'Two parts of the situation can help one another without losing their separate jobs. Cooperation is available, but it will not organize itself.',
      watchFor: 'Treating an available opportunity like a finished result.',
      alchemy: `Create one deliberate exchange between ${oneLife} and ${twoLife}. Give the opening something useful to do.`,
    },
    square: {
      headline: 'Two real needs are competing for the same room.',
      current: 'The pressure is not asking you to choose a winner. It is showing where two legitimate needs have not yet been given a way to function at the same time.',
      watchFor: `Using ${oneName} to overpower, correct, or dismiss what ${twoName} is trying to protect.`,
      alchemy: `Stop making one need defeat the other. Build a response that gives both ${oneLife} and ${twoLife} a workable role.`,
    },
    trine: {
      headline: 'Momentum is here. Direction is the question.',
      current: 'Something is moving with very little resistance. That can feel easy or inevitable, but ease does not decide whether the destination is actually useful.',
      watchFor: 'Letting momentum choose the outcome simply because nothing immediately stops it.',
      alchemy: `Give the movement a destination. Aim ${oneLife} toward a result ${twoLife} can make useful.`,
    },
    quincunx: {
      headline: 'Not everything belongs in the same room.',
      current: 'These needs can help one another, but they cannot do the same job or live inside the same answer. Separation is what keeps both of them honest and functional.',
      watchFor: `Forcing ${oneName} and ${twoName} into one answer just to make the tension disappear.`,
      alchemy: `Give ${oneLife} and ${twoLife} separate containers. Let them exchange what is useful without demanding a merger.`,
    },
    opposition: {
      headline: 'Both sides are telling the truth.',
      current: 'The distance between two real positions is revealing what neither side can see alone. Balance comes through exchange—not by pretending the contrast is gone.',
      watchFor: `Choosing one side and pretending the counterpoint carried by ${twoName} no longer matters.`,
      alchemy: `Keep ${oneLife} and ${twoLife} visible. Let each side answer the blind spot in the other without collapsing the difference.`,
    },
  };
  return requiredLabel(language, aspectKey);
}

function conditionReading(condition, counterpart) {
  const bodyName = requiredLabel(BODY_LABELS, condition.body);
  const body = requiredVocabulary(BODY_VOCABULARY, condition.body, 'body');
  const signKey = condition.throughPoint?.sign;
  const signName = requiredLabel(SIGN_LABELS, signKey);
  requiredVocabulary(SIGN_VOCABULARY, signKey, 'sign');
  const rulerName = requiredLabel(BODY_LABELS, condition.direction?.ruler);
  const rulerSign = condition.direction?.placement?.sign;
  const rulerPlacement = rulerSign ? ` in ${requiredLabel(SIGN_LABELS, rulerSign)}` : '';
  const motion = condition.motion === 'retrograde'
    ? ' retrograde'
    : condition.motion === 'stationary_inertial' ? ' stationary' : '';
  const bodyThemes = body.keywords.slice(0, 4).join(', ');
  const signThemes = requiredLabel(THROUGH_POINT_THEMES, signKey);
  const channels = channelThemeSummary(condition, counterpart);
  const dual = dualRulershipSummary(condition.dualRulership);
  const base = `${bodyName} is${motion} in ${signName}, carrying ${lowerFirst(body.core)} through ${signThemes}. Its core field includes ${bodyThemes}. It directs through ${rulerName}${rulerPlacement}.`;

  return {
    interpretation: [base, channels, dual].filter(Boolean).join(' '),
    conditionSummary: conditionSummaryForBody(condition),
  };
}

function conditionSummaryForBody(condition) {
  const bodyName = requiredLabel(BODY_LABELS, condition.body);
  const signName = requiredLabel(SIGN_LABELS, condition.throughPoint?.sign);
  const rulerName = requiredLabel(BODY_LABELS, condition.direction?.ruler);
  const rulerSign = condition.direction?.placement?.sign;
  const motion = condition.motion === 'retrograde'
    ? ' retrograde'
    : condition.motion === 'stationary_inertial' ? ' stationary' : '';
  const directed = `${bodyName}${motion} in ${signName} directs through ${rulerName}${rulerSign ? ` in ${requiredLabel(SIGN_LABELS, rulerSign)}` : ''}.`;
  const channelList = channelListSummary(condition);
  const dual = dualRulershipSummary(condition.dualRulership);
  return [directed, channelList, dual].filter(Boolean).join(' ');
}

function channelThemeSummary(condition, counterpart) {
  const channels = strongestChannels(condition, counterpart);
  if (!channels.length) return '';
  const bodyName = requiredLabel(BODY_LABELS, condition.body);
  const total = uniqueChannels(condition.channels).filter((channel) => otherBody(channel, condition.body) !== counterpart).length;
  const themes = channels.map((channel) => {
    const otherKey = channel.planetOne === condition.body ? channel.planetTwo : channel.planetOne;
    const other = requiredVocabulary(BODY_VOCABULARY, otherKey, 'body');
    const aspect = requiredVocabulary(ASPECT_VOCABULARY, channel.aspect, 'aspect');
    const side = channel.role === 'aspecting' ? 'leading' : 'receiving';
    return `${lowerFirst(aspect.core)} with ${requiredLabel(BODY_LABELS, otherKey)}’s ${lowerFirst(other.core)} on the ${side} side`;
  });
  return `${bodyName}’s full condition includes ${total} additional active With ${total === 1 ? 'channel' : 'channels'}; the closest ${channels.length === 1 ? 'one brings' : 'ones bring'} ${joinList(themes)}.`;
}

function channelListSummary(condition) {
  const allChannels = uniqueChannels(condition.channels).sort(channelStrength);
  const channels = allChannels.slice(0, 5);
  if (!channels.length) return '';
  const bodyName = requiredLabel(BODY_LABELS, condition.body);
  const labels = channels.map((channel) => (
    `${requiredLabel(BODY_LABELS, channel.planetOne)} ${requiredLabel(ASPECT_VERBS, channel.aspect)} ${requiredLabel(BODY_LABELS, channel.planetTwo)} (${contactLabel(channel.contact)})`
  ));
  const remainder = allChannels.length - channels.length;
  return `${bodyName}’s closest active channels are ${joinList(labels)}${remainder ? `, with ${remainder} additional calculated ${remainder === 1 ? 'channel' : 'channels'} retained in its condition` : ''}.`;
}

function dualRulershipSummary(dualRulership) {
  if (!dualRulership) return '';
  const planetName = requiredLabel(BODY_LABELS, dualRulership.planet);
  const fields = dualRulership.fields.map((field) => {
    const occupants = field.conditions.map(({ body }) => requiredLabel(BODY_LABELS, body));
    return `${expressionLabel(field.expression)} in ${requiredLabel(SIGN_LABELS, field.sign)} ${occupants.length ? `carries ${joinList(occupants)}` : 'is unoccupied'}`;
  });
  return `${planetName} must also be read through both signs it rules: ${fields.join('; ')}.`;
}

function thematicLayerSummary(layers, focusBodies) {
  const focus = new Set(focusBodies);
  const withBodies = unique((layers?.with || []).map(({ body }) => body).filter((body) => !focus.has(body)));
  const whileBodies = unique((layers?.while || []).map(({ body }) => body));
  const withText = withBodies.length
    ? `The connected With layer contains ${withBodies.length} additional ${withBodies.length === 1 ? 'body' : 'bodies'}, all retained in the calculation.`
    : 'No additional body is directly connected through the With layer.';
  const whileText = whileBodies.length
    ? `${whileBodies.length} simultaneous While ${whileBodies.length === 1 ? 'body remains' : 'bodies remain'} separate and are not folded into this transit.`
    : '';
  return [withText, whileText].filter(Boolean).join(' ');
}

function contactArcReading(dossier) {
  const { activating, pointOfExactitude, releasing } = dossier.phases;
  const parts = [
    `Activating enters as ${contactPhrase(activating.contact)}.`,
    'At exactitude, a True Aspect places both bodies at the nucleus of the contact.',
    `Releasing leaves as ${contactPhrase(releasing.contact)}.`,
  ];
  return parts.join(' ');
}

function alchemyFor({ aspectKey, one, two }) {
  const oneName = requiredLabel(BODY_LABELS, one.body);
  const twoName = requiredLabel(BODY_LABELS, two.body);
  const oneEnergy = `${oneName}’s ${lowerFirst(requiredVocabulary(BODY_VOCABULARY, one.body, 'body').core)}`;
  const twoEnergy = `${twoName}’s ${lowerFirst(requiredVocabulary(BODY_VOCABULARY, two.body, 'body').core)}`;
  const oneThrough = `${requiredLabel(SIGN_LABELS, one.throughPoint.sign)}’s ${requiredLabel(THROUGH_POINT_THEMES, one.throughPoint.sign)}`;
  const twoThrough = `${requiredLabel(SIGN_LABELS, two.throughPoint.sign)}’s ${requiredLabel(THROUGH_POINT_THEMES, two.throughPoint.sign)}`;
  const templates = {
    conjunction: `Give ${oneEnergy} and ${twoEnergy} one shared assignment. Let ${oneThrough} establish the focus, while ${twoThrough} keeps the joined force responsive to both conditions. Concentrate the energy around one honest purpose instead of letting either character disappear inside the other.`,
    semi_sextile: `Before pushing ${oneEnergy} forward, ask what ${twoEnergy} needs in order to participate. Use ${twoThrough} to supply that need, then let ${oneThrough} activate only what can function with it. Keep the useful adjustment concrete; confusion clears when the requirement is named instead of guessed.`,
    sextile: `Choose a deliberate way for ${oneEnergy} to cooperate with ${twoEnergy}. Use ${oneThrough} to initiate the move and ${twoThrough} to supply the companion function. Make one concrete exchange between them; this opportunity becomes useful through participation, not by waiting for it to run itself.`,
    square: `Stop asking ${oneEnergy} to overpower ${twoEnergy}. Give ${twoEnergy} equal authority through ${twoThrough}, then recalibrate ${oneEnergy} through ${oneThrough} until both can operate at once. Build the solution around two legitimate needs instead of choosing a winner.`,
    trine: `Aim the uninterrupted flow from ${oneEnergy} into ${twoEnergy} at a chosen result. Use ${oneThrough} to set the direction and ${twoThrough} to decide what the current becomes. Because this energy can run easily, direct it deliberately instead of assuming that ease automatically makes it useful.`,
    quincunx: `Give ${oneEnergy} and ${twoEnergy} separate containers. Let ${oneEnergy} lend what it can through ${oneThrough} without demanding a merger, and protect what ${twoEnergy} needs through ${twoThrough}. Name which condition is active and use separation as precision rather than treating it as failure.`,
    opposition: `Keep ${oneEnergy} and ${twoEnergy} visible at opposite ends of the same decision. Let ${oneThrough} represent one side and ${twoThrough} represent the other, then create a conscious exchange that includes both without collapsing either. Use the contrast to reveal what each condition cannot see alone.`,
  };
  return requiredLabel(templates, aspectKey);
}

function contactPhrase(contact) {
  if (contact.type === 'Forced Aspect' && contact.forcedBy) {
    return `a Forced Aspect led into contact by ${requiredLabel(BODY_LABELS, contact.forcedBy)}`;
  }
  if (contact.type === 'Forced Aspect') return 'a Forced Aspect with one-sided OOI contact';
  if (contact.type === 'True Aspect') return 'a True Aspect with both bodies inside their own OOI';
  return contact.type === 'Fringe' ? 'Fringe context rather than direct impact' : 'outside direct OOI contact';
}

function methodCondition(dossier, body, condition) {
  const exactitude = dossier.phases.pointOfExactitude[body === dossier.arc.planetOne ? 'planetOne' : 'planetTwo'];
  const dualRulership = exactitude.dualRulership ? {
    phases: [...PHASES],
    fields: exactitude.dualRulership.fields.map(({ sign, expression }) => ({
      sign,
      expression,
      conditions: Object.fromEntries(PHASES.map((phase) => {
        const phaseCondition = dossier.phases[DOSSIER_PHASE[phase]][body === dossier.arc.planetOne ? 'planetOne' : 'planetTwo'];
        const field = phaseCondition.dualRulership.fields.find((candidate) => (
          candidate.sign === sign && candidate.expression === expression
        ));
        return [phase, field.conditions.map(({ body: occupant }) => occupant)];
      })),
    })),
  } : undefined;
  return {
    body,
    condition,
    ...(dualRulership ? { dualRulership } : {}),
  };
}

function isEligibleArc(arc) {
  return Boolean(
    arc?.key
    && arc.moments?.activating
    && arc.moments?.pointOfExactitude
    && arc.moments?.releasing
  );
}

function assertDossier(dossier) {
  if (!dossier?.id || !dossier.arc || !dossier.phases?.pointOfExactitude) {
    throw new TypeError('A complete Alchemystic interpretation dossier is required.');
  }
}

function uniqueChannels(channels = []) {
  const seen = new Set();
  return channels.filter((channel) => {
    const key = [channel.planetOne, channel.aspect, channel.planetTwo, channel.role].join(':');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function unique(values) {
  return [...new Set(values)];
}

function strongestChannels(condition, counterpart) {
  return uniqueChannels(condition.channels)
    .filter((channel) => otherBody(channel, condition.body) !== counterpart)
    .sort(channelStrength)
    .slice(0, 3);
}

function otherBody(channel, body) {
  return channel.planetOne === body ? channel.planetTwo : channel.planetOne;
}

function channelStrength(one, two) {
  return Math.abs(one.deviation ?? Number.POSITIVE_INFINITY) - Math.abs(two.deviation ?? Number.POSITIVE_INFINITY);
}

function personalizeAspect(value, oneName, twoName) {
  return `${value}`
    .replaceAll('Planet One', oneName)
    .replaceAll('Planet Two', twoName);
}

function expressionLabel(expression) {
  return expression.split('_').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');
}

function contactLabel(contact) {
  if (contact === 'direct') return 'True Aspect';
  if (contact === 'forced') return 'Forced Aspect';
  if (contact === 'fringe') return 'Fringe';
  return 'Out of Orb';
}

function joinList(values) {
  if (values.length < 2) return values[0] || '';
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`;
}

function lowerFirst(value) {
  return `${value}`.charAt(0).toLowerCase() + `${value}`.slice(1);
}

function capitalize(value) {
  return `${value}`.charAt(0).toUpperCase() + `${value}`.slice(1);
}

function requiredLabel(catalog, key) {
  const value = catalog[key];
  if (!value) throw new RangeError(`Unknown Alchemystic label: ${key}`);
  return value;
}

function requiredVocabulary(catalog, key, type) {
  const value = catalog[key];
  if (!value) throw new RangeError(`Unknown Alchemystic ${type}: ${key}`);
  return value;
}
