export const INTERPRETATION_VOCABULARY_VERSION = 'alchemystic-vocabulary.2026-08-01.1';

export const VOCABULARY_SOURCES = deepFreeze({
  book: 'I Fixed Astrology, Original Edition',
  sections: {
    bodies: ['Keywords, pp. 134-140', 'Chiron, pp. 683-694', 'Ceres, pp. 701-703', 'Juno, pp. 735-738', 'Pallas Athene, pp. 752-753', 'Vesta, pp. 767-768'],
    signs: ['Signs, pp. 197-206', 'Bidirectional Rulership, pp. 207-208'],
    aspects: ['Defining the Major Aspects, pp. 310-316', 'Aspect Spectrum and Energy Flow, pp. 316-346'],
    points: ['Lunar Nodes, pp. 601-609', 'Black Moon Lilith and Lilith Arc, pp. 611-617'],
  },
  authorConfirmed: ['OOI and Fringe rules', 'Activating / Point of Exactitude / Releasing behavior', 'True Aspect / Forced Aspect terminology', 'Inferior and Superior Mercury / Venus culmination'],
});

const entry = (core, functionText, keywords, exclusions = []) => ({ core, function: functionText, keywords, exclusions });

export const BODY_VOCABULARY = deepFreeze({
  sun: entry('Vitality', 'Concentrates life force, will, purpose, creative expression, visibility, pride, and authentic presence.', ['vitality', 'life force', 'will', 'purpose', 'play', 'creative expression', 'visibility', 'pride', 'authenticity', 'leadership'], ['generic drama']),
  moon: entry('Safety', 'Concentrates subjective feeling, memory, emotional response, needs, home, family, roots, and maternal care.', ['safety', 'feeling', 'memory', 'emotion', 'security', 'needs', 'home', 'family', 'roots', 'maternal care'], ['soul destiny']),
  mercury: { ...entry('Mind', 'Concentrates thought, perception, communication, analysis, discernment, information, decisions, and mental function.', ['mind', 'thought', 'perception', 'communication', 'analysis', 'discernment', 'information', 'decisions', 'mental function']), requiredExpressions: ['inferior_mercury', 'superior_mercury'] },
  venus: { ...entry('Value', 'Concentrates worth, resources, taste, exchange, relationship, fairness, diplomacy, and what is offered or received.', ['value', 'worth', 'resources', 'taste', 'exchange', 'relationship', 'fairness', 'diplomacy']), requiredExpressions: ['inferior_venus', 'superior_venus'] },
  mars: entry('Action', 'Concentrates motion originating from the self: assertion, initiation, physical effort, competition, heat, conflict, and direct impact.', ['action', 'motion', 'assertion', 'initiation', 'physical effort', 'competition', 'heat', 'conflict', 'impact']),
  jupiter: entry('Expansion', 'Concentrates possibility, abundance, opportunity, experience, belief, higher learning, wisdom, teaching, and larger perspective.', ['expansion', 'abundance', 'opportunity', 'adventure', 'belief', 'higher learning', 'wisdom', 'teaching', 'larger perspective'], ['money']),
  saturn: entry('Structure', 'Concentrates time, discipline, rules, limits, goals, endurance, responsibility, authority, mastery, and completion.', ['structure', 'time', 'discipline', 'rules', 'limits', 'goals', 'endurance', 'responsibility', 'authority', 'completion']),
  uranus: entry('Innovation', 'Concentrates objective pattern-breaking through science, mechanics, invention, individuality, disruption, networks, technology, and progress.', ['innovation', 'improve', 'better', 'science', 'mechanics', 'invention', 'individuality', 'disruption', 'networks', 'technology', 'progress']),
  neptune: entry('Unknown', 'Concentrates what cannot be clearly seen or contained: spirituality, imagination, dreams, illusion, uncertainty, compassion, sacrifice, and release.', ['unknown', 'spirituality', 'imagination', 'dreams', 'illusion', 'uncertainty', 'compassion', 'sacrifice', 'release']),
  pluto: entry('Depth', 'Concentrates hidden material, intensity, investigation, psychology, trauma, power, transformation, intimacy, survival, and regeneration.', ['depth', 'hidden', 'intensity', 'investigation', 'psychology', 'trauma', 'power', 'transformation', 'intimacy', 'survival', 'regeneration']),
  chiron: entry('Fractured structures', 'Concentrates insecurity formed by structures that do not fit, the personal method developed outside those structures, and the armor created by owning that difference.', ['fracture', 'insecurity', 'not fitting', 'personal method', 'authentic difference', 'armor', 'possibility'], ['wounded healer', 'automatic healing']),
  ceres: entry('Sustenance', 'Concentrates cyclical care, nourishment, preservation, loss, severance, resilience, and the substance required for life to continue.', ['sustenance', 'nourishment', 'care', 'preservation', 'loss', 'severance', 'resilience', 'growth'], ['generic nurturing', 'sentimental care']),
  pallas: entry('Creative-strategic pattern recognition', 'Concentrates non-linear pattern recognition, practical strategy, intuitive logic, and solutions seen from outside the system.', ['pattern recognition', 'strategy', 'practical solutions', 'non-linear logic', 'reorientation', 'creative problem-solving'], ['generic intelligence']),
  juno: entry('Terms of commitment', 'Concentrates the conditions, agreements, loyalty, purpose, sovereignty, and periodic reassessment required for commitment.', ['commitment', 'conditions', 'agreement', 'loyalty', 'contract', 'devotion', 'reassessment', 'sovereignty'], ['relationship itself', 'jealousy', 'infidelity', 'soulmate']),
  vesta: entry('The eternal flame', 'Concentrates the protected inner fire that survives impact and becomes devotion, integrity, purpose, and sacred endurance.', ['eternal flame', 'devotion', 'integrity', 'purpose', 'survival', 'endurance', 'protected energy'], ['generic domesticity']),
  mean_black_moon_lilith: entry('Forbidden desire and liberation', 'Receives influence around internalized guilt, shame, regret, forbidden wants, emotional permission, and liberation that must remain reflected into real-life consequences.', ['guilt', 'shame', 'regret', 'forbidden desire', 'permission', 'liberation', 'deep wants', 'invisible mirror'], ['unrestrained reaction', 'mythological Lilith']),
  mean_north_node: entry('Foreign growth trajectory', 'Receives influence as an unfamiliar future-facing direction of growth; it is a trajectory rather than a destination or fate.', ['foreign', 'uncomfortable', 'growth', 'future trajectory', 'forward alignment', 'evolution'], ['destiny', 'fate', 'past life', 'final destination']),
  mean_south_node: entry('Familiar default', 'Receives influence as emotional familiarity, learned habit, security, present-or-past default settings, and strengths that support the North Node trajectory.', ['familiarity', 'habit', 'security', 'comfort zone', 'default setting', 'learned strength', 'past and present'], ['past life', 'something to abandon']),
});

export const SIGN_VOCABULARY = deepFreeze({
  aries: sign('mars', 'personal_action', 'Action performed directly, physically, assertively, competitively, and from the self.', ['act', 'begin', 'move', 'assert', 'physical', 'direct', 'first']),
  taurus: sign('venus', 'inferior_venus', 'Value handled personally through resources, money, possessions, taste, worth, comfort, and what the individual keeps.', ['personal value', 'money', 'resources', 'possessions', 'taste', 'worth', 'comfort']),
  gemini: sign('mercury', 'inferior_mercury', 'Mind operating personally through thoughts, choices, curiosity, words, information, tools, and the immediate environment.', ['personal mind', 'thoughts', 'choices', 'curiosity', 'communication', 'information', 'tools']),
  cancer: sign('moon', 'subjective_safety', 'Safety processed subjectively through feeling, memory, needs, home, family, roots, and maternal care.', ['safety', 'feeling', 'memory', 'needs', 'home', 'family', 'roots']),
  leo: sign('sun', 'personal_vitality', 'Vitality expressed through life force, will, purpose, joy, visibility, pride, and authentic creative presence.', ['vitality', 'will', 'purpose', 'joy', 'visibility', 'pride', 'creative expression'], ['theatrical performance']),
  virgo: sign('mercury', 'superior_mercury', 'Mind applied outwardly through observation, criticism, scrutiny, analysis, discernment, details, organization, service, routine, function, and efficiency.', ['observation', 'criticize', 'criticism', 'scrutinize', 'scrutiny', 'analysis', 'details', 'discernment', 'organization', 'service', 'routine', 'function', 'efficiency'], ['improve', 'improvement', 'innovation']),
  libra: sign('venus', 'superior_venus', 'Value offered outwardly through mutual exchange, conversation, relationship, fairness, diplomacy, peace, and cooperation.', ['mutual exchange', 'conversation', 'relationship', 'fairness', 'diplomacy', 'peace', 'cooperation']),
  scorpio: sign('pluto', 'depth', 'Experience carried beneath the visible surface through intensity, investigation, trauma, power, transformation, intimacy, and regeneration.', ['depth', 'hidden', 'intensity', 'investigation', 'trauma', 'power', 'transformation', 'intimacy', 'regeneration']),
  sagittarius: sign('jupiter', 'expansion', 'Experience expanded through possibility, opportunity, adventure, belief, learning, teaching, performance, and larger perspective.', ['expansion', 'opportunity', 'adventure', 'belief', 'learning', 'teaching', 'performance', 'perspective']),
  capricorn: sign('saturn', 'structure', 'Experience structured through time, discipline, rules, limits, goals, endurance, responsibility, authority, and completion.', ['structure', 'time', 'discipline', 'rules', 'limits', 'goals', 'authority', 'completion']),
  aquarius: sign('uranus', 'innovation', 'Patterns changed through objective insight, science, mechanics, invention, individuality, disruption, networks, technology, and improvement.', ['innovation', 'improve', 'improvement', 'better', 'objective', 'science', 'mechanics', 'invention', 'disruption', 'networks', 'technology', 'progress']),
  pisces: sign('neptune', 'unknown', 'Experience filtered through what is unseen or uncontained: spirituality, imagination, dreams, illusion, uncertainty, compassion, sacrifice, and release.', ['unknown', 'spirituality', 'imagination', 'dreams', 'illusion', 'uncertainty', 'compassion', 'sacrifice', 'release']),
});

export const ASPECT_VOCABULARY = deepFreeze({
  conjunction: aspect(0, 'Unification', 'Planet One leads the shared focus.', 'Planet Two aligns with Planet One inside the same operating space.', 'Assess the two conditions as one concentrated force without calling the result automatically helpful or harmful.'),
  semi_sextile: aspect(30, 'Conditional activation', 'Planet One wants to function but can be blocked or confused.', 'Planet Two supplies the need that must be understood before Planet One can activate cleanly.', 'Feed Planet One into Planet Two\'s requirements; use the friction as precision rather than treating it as mild harmony.'),
  sextile: aspect(60, 'Active cooperation', 'Planet One acts with intention and retains its own function.', 'Planet Two participates as a cooperative factor inside Planet One\'s action.', 'Engage both conditions deliberately; they work in tandem without blending or running on autopilot.'),
  square: aspect(90, 'Synchronizing pressure', 'Planet One attempts to usurp or control Planet Two when it treats Planet Two as the problem.', 'Planet Two resists and has needs of equal importance.', 'Support Planet Two\'s needs and recalibrate Planet One so both conditions activate in synchrony.'),
  trine: aspect(120, 'Uninterrupted flow', 'Planet One enters an unavoidable current toward Planet Two.', 'Planet Two receives and continues that current without inherent interruption.', 'Direct the seamless flow intentionally; inevitability and ease are not synonyms for positive outcome.'),
  quincunx: aspect(150, 'Separated coexistence', 'Planet One adjusts and lends its talents without forcing merger.', 'Planet Two retains needs that cannot occupy the same space as Planet One.', 'Compartmentalize the two conditions and let them coexist; forced integration shuts the system down.'),
  opposition: aspect(180, 'Balanced contrast', 'Planet One retains its pure condition on one side of the relationship.', 'Planet Two retains its pure condition at the counterpoint and cannot be ignored.', 'Include both through conscious cooperation across distance; balance is not fusion.'),
});

export const PHASE_VOCABULARY = deepFreeze({
  activating: { core: 'Wake-up call', rule: 'The first moment inside the applicable OOI introduces a new theme and is felt relatively strongly.' },
  point_of_exactitude: { core: 'Nucleus and directional handoff', rule: 'The aspect reaches its nucleus and greatest intensity in the incoming direction, then makes the directional handoff from Planet One -> Planet Two to Planet Two -> Planet One.' },
  releasing: { core: 'Final heightened expression', rule: 'The outgoing edge produces a slight heightened expression before the aspect lets go; it is the opposite boundary of Activating.' },
});

export const CONTACT_VOCABULARY = deepFreeze({
  true_aspect: { rule: 'Both bodies are within their own OOI of the exact aspect.', interpretation: 'Mutual contact; both assessed conditions directly participate.' },
  forced_aspect: { rule: 'Only one body reaches the exact aspect through its OOI.', interpretation: 'One-sided contact; identify the body whose OOI forces the relationship and preserve that asymmetry.' },
  fringe: { rule: 'The bodies are outside direct OOI contact but within the separately calculated Fringe range.', interpretation: 'Context only; never relabel Fringe as a True or Forced Aspect.' },
});

export const DOCTRINE_BOUNDARIES = deepFreeze([
  'Planets and points are the concentrated what; signs are the how or Through Point; neither substitutes for the other.',
  'Assess Planet One and Planet Two separately before applying the ordered aspect.',
  'The aspect is directional: from Planet One and to Planet Two are different interpretive roles.',
  'At Point of Exactitude, preserve the directional handoff instead of reversing the aspect title.',
  'Gemini and Virgo both culminate in Mercury; Taurus and Libra both culminate in Venus.',
  'Improvement belongs to Aquarius and Uranus. Virgo observes, criticizes, scrutinizes, analyzes details, and applies efficiency.',
  'Connected aspect and rulership paths are With layers. Unconnected simultaneous bodies are While layers.',
  'Do not use mythology, essential dignity, good/bad scoring, a final dispositor, or isolated aspect boilerplate as doctrine.',
]);

export function vocabularyForInterpretation({ planetOne, aspect: aspectKey, planetTwo }) {
  const one = BODY_VOCABULARY[planetOne];
  const two = BODY_VOCABULARY[planetTwo];
  const orderedAspect = ASPECT_VOCABULARY[aspectKey];
  if (!one || !two || !orderedAspect) throw new RangeError('Unknown interpretation vocabulary key.');
  return {
    version: INTERPRETATION_VOCABULARY_VERSION,
    sources: VOCABULARY_SOURCES,
    planetOne: { body: planetOne, ...one },
    planetTwo: { body: planetTwo, ...two },
    aspect: { key: aspectKey, ...orderedAspect },
    phases: PHASE_VOCABULARY,
    contacts: CONTACT_VOCABULARY,
    boundaries: DOCTRINE_BOUNDARIES,
  };
}

function sign(ruler, expression, functionText, keywords, exclusions = []) {
  return { role: 'through_point', ruler, expression, function: functionText, keywords, exclusions };
}

function aspect(angle, core, fromPlanet, toPlanet, synthesis) {
  return { angle, core, directional: { fromPlanet, toPlanet }, synthesis };
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
