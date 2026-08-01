const DAY_MS = 86_400_000;

const BODY_LABELS = Object.freeze({
  sun: 'Sun', moon: 'Moon', mercury: 'Mercury', venus: 'Venus', mars: 'Mars',
  jupiter: 'Jupiter', saturn: 'Saturn', uranus: 'Uranus', neptune: 'Neptune',
  pluto: 'Pluto', chiron: 'Chiron', vesta: 'Vesta', juno: 'Juno', ceres: 'Ceres',
  pallas: 'Pallas', mean_black_moon_lilith: 'Mean Lilith',
  mean_north_node: 'Mean North Node', mean_south_node: 'Mean South Node',
});

const ASPECT_LABELS = Object.freeze({
  conjunction: 'Conjuncts', semi_sextile: 'Semi-sextiles', sextile: 'Sextiles',
  square: 'Squares', trine: 'Trines', quincunx: 'Quincunxes', opposition: 'Opposes',
});

export function buildForecastFeed({ forecast, interpretations, now, timeZone = 'America/Chicago' }) {
  if (!forecast?.window || !Array.isArray(forecast.arcs)) {
    throw new TypeError('A scanned universal forecast is required.');
  }
  if (!interpretations || typeof interpretations !== 'object') {
    throw new TypeError('Editorial interpretations are required.');
  }

  const currentTime = toTime(now ?? forecast.window.start);
  const weekEnd = currentTime + 7 * DAY_MS;
  const outlookEnd = currentTime + 14 * DAY_MS;
  const records = forecast.arcs
    .map((arc) => serializeArc(arc, interpretations[arc.key], currentTime, timeZone))
    .filter(Boolean)
    .filter(({ range }) => toTime(range.end) >= currentTime && toTime(range.start) <= outlookEnd)
    .sort((one, two) => one.range.focus.localeCompare(two.range.focus));

  return {
    schema: 'mystic-rebels.alchemystic-forecast.v1',
    generatedAt: forecast.generatedAt,
    timeZone,
    week: records.filter(({ range }) => toTime(range.start) <= weekEnd),
    outlook: records.filter(({ range }) => toTime(range.start) > weekEnd),
  };
}

function serializeArc(arc, editorial, now, timeZone) {
  const moments = arc?.moments;
  if (!moments?.activating || !moments?.pointOfExactitude || !moments?.releasing) return null;
  if (!editorial?.interpretation || !editorial?.alignment) return null;

  const activating = moment(moments.activating, timeZone);
  const exactitude = moment(moments.pointOfExactitude, timeZone);
  const releasing = moment(moments.releasing, timeZone);
  const currentPhase = now < toTime(exactitude.datetime)
    ? 'Activating'
    : now < toTime(releasing.datetime) ? 'Point of Exactitude' : 'Releasing';
  const contact = arc.events?.find(({ contact }) => contact)?.contact;

  return {
    key: arc.key,
    planetOne: labelFor(BODY_LABELS, arc.planetOne),
    aspect: labelFor(ASPECT_LABELS, arc.aspect),
    planetTwo: labelFor(BODY_LABELS, arc.planetTwo),
    currentPhase,
    contactType: contact === 'forced' ? 'Forced aspect' : 'Direct impact',
    moments: { activating, exactitude, releasing },
    interpretation: editorial.interpretation,
    alignment: editorial.alignment,
    conditionSummary: editorial.conditionSummary || '',
    articleUrl: editorial.articleUrl || '',
    range: {
      start: activating.datetime,
      focus: exactitude.datetime,
      end: releasing.datetime,
    },
  };
}

function moment(value, timeZone) {
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) throw new TypeError(`Invalid Aspect Arc timestamp: ${value}`);
  return {
    datetime: instant.toISOString(),
    display: new Intl.DateTimeFormat('en-US', {
      timeZone, weekday: 'long', month: 'long', day: 'numeric',
    }).format(instant).replace(',', ' ·'),
  };
}

function labelFor(labels, key) {
  return labels[key] || String(key).replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function toTime(value) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) throw new TypeError('A valid current forecast time is required.');
  return time;
}
