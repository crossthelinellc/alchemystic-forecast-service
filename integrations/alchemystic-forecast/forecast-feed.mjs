const DAY_MS = 86_400_000;
const HISTORY_DAYS = 30;
const FUTURE_DAYS = 30;

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

const BODY_GLYPHS = Object.freeze({
  sun: '☉', moon: '☽', mercury: '☿', venus: '♀', mars: '♂', jupiter: '♃',
  saturn: '♄', uranus: '♅', neptune: '♆', pluto: '♇', chiron: '⚷',
  vesta: 'V', juno: 'J', ceres: 'C', pallas: 'P', mean_black_moon_lilith: 'L',
  mean_north_node: '☊', mean_south_node: '☋',
});

const ASPECT_GLYPHS = Object.freeze({
  conjunction: '☌', semi_sextile: '⚺', sextile: '⚹', square: '□',
  trine: '△', quincunx: '⚻', opposition: '☍',
});

const BODY_FAMILIES = Object.freeze({
  sun: 'luminary', moon: 'luminary',
  mercury: 'personal', venus: 'personal', mars: 'personal',
  jupiter: 'social', saturn: 'social',
  uranus: 'outer', neptune: 'outer', pluto: 'outer',
  chiron: 'asteroid', vesta: 'asteroid', juno: 'asteroid', ceres: 'asteroid', pallas: 'asteroid',
  mean_black_moon_lilith: 'point', mean_north_node: 'point', mean_south_node: 'point',
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
  const calendarStart = currentTime - HISTORY_DAYS * DAY_MS;
  const calendarEnd = currentTime + FUTURE_DAYS * DAY_MS;
  const records = forecast.arcs
    .map((arc) => serializeArc(arc, interpretations[arc.key], currentTime, timeZone))
    .filter(Boolean)
    .filter(({ range }) => toTime(range.end) >= calendarStart && toTime(range.start) <= calendarEnd)
    .sort((one, two) => one.range.focus.localeCompare(two.range.focus));

  return {
    schema: 'mystic-rebels.alchemystic-forecast.v1',
    generatedAt: forecast.generatedAt,
    timeZone,
    week: records.filter(({ hasInterpretation, range }) => (
      hasInterpretation && toTime(range.end) >= currentTime && toTime(range.start) <= weekEnd
    )),
    calendar: {
      range: {
        start: dateKey(calendarStart, timeZone),
        end: dateKey(calendarEnd, timeZone),
      },
      records,
    },
  };
}

function serializeArc(arc, editorial, now, timeZone) {
  const moments = arc?.moments;
  if (!moments?.activating || !moments?.pointOfExactitude || !moments?.releasing) return null;
  const hasInterpretation = Boolean(
    editorial?.interpretation
    && editorial?.alignment
    && hasCompleteInterpretationMethod(arc, editorial.method)
  );

  const activationEvent = arc.events?.find(({ type }) => type === 'true_aspect_activation');
  const releaseEvent = arc.events?.find(({ type }) => type === 'aspect_release');
  const transitionEvents = arc.events?.filter(({ type }) => type === 'contact_transition') || [];
  const activationContact = contactLabel(activationEvent?.toContact || activationEvent?.contact);
  const finalTransitionContact = transitionEvents.at(-1)?.toContact;
  const releaseContact = contactLabel(releaseEvent?.fromContact || finalTransitionContact || activationEvent?.contact);
  const activating = { ...moment(moments.activating, timeZone), contactType: activationContact };
  const exactitude = { ...moment(moments.pointOfExactitude, timeZone), contactType: 'True Aspect' };
  const releasing = { ...moment(moments.releasing, timeZone), contactType: releaseContact };
  const contactTimeline = [
    { datetime: activating.datetime, dateKey: activating.dateKey, contactType: activationContact },
    ...transitionEvents.map((event) => ({
      ...moment(event.timestamp, timeZone),
      contactType: contactLabel(event.toContact),
      fromContact: contactLabel(event.fromContact),
      toContact: contactLabel(event.toContact),
      forcedBy: event.forcedBy || '',
    })),
  ].filter(({ contactType }) => contactType).sort((one, two) => one.datetime.localeCompare(two.datetime));
  const currentPhase = now < toTime(exactitude.datetime)
    ? 'Activating'
    : now < toTime(releasing.datetime) ? 'Point of Exactitude' : 'Releasing';
  const currentContactType = contactTimeline.reduce((contactType, entry) => (
    toTime(entry.datetime) <= now ? entry.contactType : contactType
  ), contactTimeline[0]?.contactType || 'True Aspect');

  return {
    id: [arc.key, exactitude.datetime].join(':'),
    key: arc.key,
    planetOneKey: arc.planetOne,
    planetOne: labelFor(BODY_LABELS, arc.planetOne),
    planetOneGlyph: labelFor(BODY_GLYPHS, arc.planetOne),
    planetOneFamily: BODY_FAMILIES[arc.planetOne] || 'other',
    aspectKey: arc.aspect,
    aspect: labelFor(ASPECT_LABELS, arc.aspect),
    aspectGlyph: labelFor(ASPECT_GLYPHS, arc.aspect),
    planetTwoKey: arc.planetTwo,
    planetTwo: labelFor(BODY_LABELS, arc.planetTwo),
    planetTwoGlyph: labelFor(BODY_GLYPHS, arc.planetTwo),
    planetTwoFamily: BODY_FAMILIES[arc.planetTwo] || 'other',
    currentPhase,
    contactType: currentContactType,
    contactTimeline,
    moments: { activating, exactitude, releasing },
    hasInterpretation,
    interpretation: hasInterpretation ? editorial.interpretation : '',
    alignment: hasInterpretation ? editorial.alignment : '',
    conditionSummary: hasInterpretation ? editorial.conditionSummary || '' : '',
    interpretationMethod: hasInterpretation ? editorial.method.version : '',
    articleUrl: hasInterpretation ? editorial.articleUrl || '' : '',
    range: {
      start: activating.datetime,
      focus: exactitude.datetime,
      end: releasing.datetime,
      startDate: activating.dateKey,
      focusDate: exactitude.dateKey,
      endDate: releasing.dateKey,
    },
  };
}

export function hasCompleteInterpretationMethod(arc, method) {
  const hasText = (value) => typeof value === 'string' && value.trim().length > 0;
  return method?.version === 'alchemystic-interpretation.v1'
    && method.planetOne?.body === arc?.planetOne
    && hasText(method.planetOne.condition)
    && method.planetTwo?.body === arc?.planetTwo
    && hasText(method.planetTwo.condition)
    && method.aspect?.type === arc?.aspect
    && hasText(method.aspect.synthesis);
}

function contactLabel(contact) {
  if (contact === 'forced') return 'Forced Aspect';
  if (contact === 'direct') return 'True Aspect';
  return '';
}

function moment(value, timeZone) {
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) throw new TypeError(`Invalid Aspect Arc timestamp: ${value}`);
  return {
    datetime: instant.toISOString(),
    dateKey: dateKey(instant, timeZone),
    display: new Intl.DateTimeFormat('en-US', {
      timeZone, weekday: 'long', month: 'long', day: 'numeric',
    }).format(instant).replace(',', ' ·'),
  };
}

function dateKey(value, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(value));
  const fields = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return [fields.year, fields.month, fields.day].join('-');
}

function labelFor(labels, key) {
  return labels[key] || String(key).replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function toTime(value) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) throw new TypeError('A valid current forecast time is required.');
  return time;
}
