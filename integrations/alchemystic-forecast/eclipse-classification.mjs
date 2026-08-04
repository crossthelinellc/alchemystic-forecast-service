import { normalizeLongitude } from './engine.mjs';

export const ECLIPSE_THRESHOLDS = Object.freeze({ true: 3, forced: 10, fringe: 13 });

export const NODE_AXIS = Object.freeze({
  mean_north_node: Object.freeze({
    label: 'Mean North Node',
    orientation: 'Northern',
    definition: 'Direction rather than origin: an uncomfortable evolutionary field that must be reworked rather than copied.',
    alchemy: 'Lean into the discomfort slowly. Evolve the energy instead of copying it.',
  }),
  mean_south_node: Object.freeze({
    label: 'Mean South Node',
    orientation: 'Southern',
    definition: 'Inherited coding and familiar defaults that come easily, but become stagnant when overused for safety.',
    alchemy: 'Refine the energy. Keep the gift and release the dependency.',
  }),
});

export function classifyAlchemysticEclipse({ phase, positions }) {
  if (!['New Moon', 'Full Moon'].includes(phase) || !Array.isArray(positions)) return null;
  const byKey = new Map(positions.map((position) => [position?.key, position]));
  const moon = byKey.get('moon');
  const sun = byKey.get('sun');
  const north = byKey.get('mean_north_node');
  const south = byKey.get('mean_south_node');
  if (![moon, sun, north, south].every(hasLongitude)) return null;
  const relevant = [north, south].map((node) => ({
    node,
    distanceFromMoon: angularDistance(moon.longitude, node.longitude),
  })).sort((one, two) => one.distanceFromMoon - two.distanceFromMoon)[0];
  const eclipseClass = contactClass(relevant.distanceFromMoon);
  if (!eclipseClass) return null;
  const relevantNode = NODE_AXIS[relevant.node.key];
  const otherNodeKey = relevant.node.key === 'mean_north_node' ? 'mean_south_node' : 'mean_north_node';
  const eclipseKind = phase === 'New Moon' ? 'Solar' : 'Lunar';
  return {
    eclipseClass,
    eclipseKind,
    orientation: relevantNode.orientation,
    title: `${eclipseClass} ${relevantNode.orientation} ${eclipseKind} Eclipse`,
    relevantNodeKey: relevant.node.key,
    otherNodeKey,
    nodeDistance: Number(relevant.distanceFromMoon.toFixed(6)),
    thresholds: ECLIPSE_THRESHOLDS,
    nodeAxis: [
      { key: relevant.node.key, ...relevantNode, highlighted: true },
      { key: otherNodeKey, ...NODE_AXIS[otherNodeKey], highlighted: false },
    ],
  };
}

export function angularDistance(one, two) {
  const distance = normalizeLongitude(one - two);
  return Math.min(distance, 360 - distance);
}

function contactClass(distance) {
  if (distance <= ECLIPSE_THRESHOLDS.true) return 'True';
  if (distance <= ECLIPSE_THRESHOLDS.forced) return 'Forced';
  if (distance <= ECLIPSE_THRESHOLDS.fringe) return 'Fringe';
  return '';
}

function hasLongitude(position) {
  return Number.isFinite(position?.longitude);
}
