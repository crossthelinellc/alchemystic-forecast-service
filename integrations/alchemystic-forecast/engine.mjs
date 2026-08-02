export const BODY_CATALOG = Object.freeze({
  sun: { label: 'Sun', ooi: 10, type: 'planet' },
  moon: { label: 'Moon', ooi: 3, type: 'planet' },
  mercury: { label: 'Mercury', ooi: 3, type: 'planet' },
  venus: { label: 'Venus', ooi: 5, type: 'planet' },
  mars: { label: 'Mars', ooi: 4, type: 'planet' },
  jupiter: { label: 'Jupiter', ooi: 8, type: 'planet' },
  saturn: { label: 'Saturn', ooi: 7.5, type: 'planet' },
  uranus: { label: 'Uranus', ooi: 5, type: 'planet' },
  neptune: { label: 'Neptune', ooi: 3, type: 'planet' },
  pluto: { label: 'Pluto', ooi: 1.5, type: 'planet' },
  chiron: { label: 'Chiron', ooi: 1, type: 'asteroid' },
  ceres: { label: 'Ceres', ooi: 1, type: 'asteroid' },
  pallas: { label: 'Pallas Athene', ooi: 1, type: 'asteroid' },
  juno: { label: 'Juno', ooi: 1, type: 'asteroid' },
  vesta: { label: 'Vesta', ooi: 1, type: 'asteroid' },
  mean_black_moon_lilith: {
    label: 'Mean Black Moon Lilith',
    ooi: 3,
    type: 'mathematical_point',
  },
  mean_north_node: {
    label: 'Mean Lunar North Node',
    ooi: 0,
    type: 'mathematical_point',
  },
  mean_south_node: {
    label: 'Mean Lunar South Node',
    ooi: 0,
    type: 'mathematical_point',
  },
});

export const MAJOR_ASPECTS = Object.freeze([
  { key: 'conjunction', label: 'Conjunction', angle: 0 },
  { key: 'semi_sextile', label: 'Semi-sextile', angle: 30 },
  { key: 'sextile', label: 'Sextile', angle: 60 },
  { key: 'square', label: 'Square', angle: 90 },
  { key: 'trine', label: 'Trine', angle: 120 },
  { key: 'quincunx', label: 'Quincunx', angle: 150 },
  { key: 'opposition', label: 'Opposition', angle: 180 },
]);

const EXACTITUDE_EPSILON = 1 / 3600;

export function normalizeLongitude(value) {
  if (!Number.isFinite(value)) throw new TypeError('Longitude must be a finite number.');
  return ((value % 360) + 360) % 360;
}

export function forwardDistance(fromLongitude, toLongitude) {
  return normalizeLongitude(toLongitude - fromLongitude);
}

export function directedArc(firstBody, secondBody) {
  const firstToSecond = forwardDistance(firstBody.longitude, secondBody.longitude);

  if (firstToSecond < 180) {
    return { planetOne: firstBody, planetTwo: secondBody, angle: firstToSecond };
  }

  if (firstToSecond > 180) {
    return { planetOne: secondBody, planetTwo: firstBody, angle: 360 - firstToSecond };
  }

  return fasterFirst(firstBody, secondBody, 180);
}

export function nearestMajorAspect(angle) {
  if (!Number.isFinite(angle) || angle < 0 || angle > 180) {
    throw new RangeError('Aspect angle must be between 0° and 180°.');
  }

  return MAJOR_ASPECTS.reduce((nearest, aspect) => {
    const deviation = Math.abs(angle - aspect.angle);
    return deviation < nearest.deviation ? { ...aspect, deviation } : nearest;
  }, { ...MAJOR_ASPECTS[0], deviation: Math.abs(angle) });
}

export function classifyContact(planetOne, planetTwo, deviation) {
  const oneReaches = deviation <= planetOne.ooi;
  const twoReaches = deviation <= planetTwo.ooi;

  if (oneReaches && twoReaches) {
    return { kind: 'direct', directImpact: true, forcedBy: null };
  }

  if (oneReaches || twoReaches) {
    return {
      kind: 'forced',
      directImpact: true,
      forcedBy: oneReaches ? planetOne.key : planetTwo.key,
    };
  }

  if (deviation <= planetOne.ooi + planetTwo.ooi) {
    return { kind: 'fringe', directImpact: false, forcedBy: null };
  }

  return { kind: 'out_of_orb', directImpact: false, forcedBy: null };
}

export function classifyRelationship(previousPair, currentPair, nextPair) {
  const previous = measurePair(previousPair);
  const current = measurePair(currentPair);
  const next = measurePair(nextPair);
  const contact = classifyContact(current.planetOne, current.planetTwo, current.aspect.deviation);
  const applicableOoi = Math.max(current.planetOne.ooi, current.planetTwo.ooi);
  const priorContact = classifyContact(
    previous.planetOne,
    previous.planetTwo,
    previous.aspect.deviation,
  );
  const nextContact = classifyContact(next.planetOne, next.planetTwo, next.aspect.deviation);

  return {
    planetOne: serializeBody(current.planetOne),
    planetTwo: serializeBody(current.planetTwo),
    aspect: current.aspect,
    applicableOoi,
    contact,
    phase: determinePhase({ previous, current, next, priorContact, contact, nextContact }),
    flow: determineFlow(previous, current, next),
  };
}

export function inspectRelationship(pair) {
  const measured = measurePair(pair);
  const contact = classifyContact(
    measured.planetOne,
    measured.planetTwo,
    measured.aspect.deviation,
  );

  return {
    planetOne: serializeBody(measured.planetOne),
    planetTwo: serializeBody(measured.planetTwo),
    aspect: measured.aspect,
    signedDeviation: measured.angle - measured.aspect.angle,
    applicableOoi: Math.max(measured.planetOne.ooi, measured.planetTwo.ooi),
    contact,
  };
}

function measurePair(pair) {
  if (!Array.isArray(pair) || pair.length !== 2) {
    throw new TypeError('A pair must contain exactly two body positions.');
  }

  const bodies = pair.map(hydrateBody);
  const arc = directedArc(bodies[0], bodies[1]);
  const aspect = nearestMajorAspect(arc.angle);

  return { ...arc, aspect };
}

function hydrateBody(body) {
  const definition = BODY_CATALOG[body.key];
  if (!definition) throw new RangeError(`Unknown Alchemystic body: ${body.key}`);

  return {
    ...definition,
    ...body,
    longitude: normalizeLongitude(body.longitude),
    speed: Number(body.speed),
  };
}

function fasterFirst(firstBody, secondBody, angle) {
  const firstSpeed = Math.abs(firstBody.speed);
  const secondSpeed = Math.abs(secondBody.speed);
  const firstIsFaster = firstSpeed !== secondSpeed
    ? firstSpeed > secondSpeed
    : firstBody.key.localeCompare(secondBody.key) < 0;

  return firstIsFaster
    ? { planetOne: firstBody, planetTwo: secondBody, angle }
    : { planetOne: secondBody, planetTwo: firstBody, angle };
}

function determinePhase({ previous, current, next, priorContact, contact, nextContact }) {
  const deviation = current.aspect.deviation;

  if (deviation <= EXACTITUDE_EPSILON) return 'point_of_exactitude';

  if (contact.kind === 'fringe') {
    return next.aspect.deviation < deviation ? 'fringe_activation' : 'fringe_residual';
  }

  if (contact.kind === 'out_of_orb') return 'inactive';
  if (!priorContact.directImpact && contact.directImpact) return 'true_aspect_activation';
  if (contact.directImpact && !nextContact.directImpact) return 'aspect_release';

  return next.aspect.deviation < deviation ? 'applying_aspect' : 'separating_aspect';
}

function determineFlow(previous, current, next) {
  if (current.aspect.deviation <= EXACTITUDE_EPSILON) return 'balanced_at_nucleus';
  if (next.aspect.deviation < current.aspect.deviation) return 'planet_one_to_planet_two';
  if (next.aspect.deviation > current.aspect.deviation) return 'planet_two_pulls_planet_one';
  if (previous.aspect.deviation !== current.aspect.deviation) return 'stationary_transition';
  return 'inertial';
}

function serializeBody(body) {
  return {
    key: body.key,
    label: body.label,
    type: body.type,
    ooi: body.ooi,
    longitude: body.longitude,
    speed: body.speed,
  };
}
