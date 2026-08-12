import { INTERPRETATION_VOCABULARY_VERSION } from './interpretation-vocabulary.mjs';
import { classifyAlchemysticEclipse } from './eclipse-classification.mjs';

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

export const BODY_GLYPHS = Object.freeze({
  sun: '☉', moon: '☽', mercury: '☿', venus: '♀', mars: '♂', jupiter: '♃',
  saturn: '♄', uranus: '♅', neptune: '♆', pluto: '♇', chiron: '⚷',
  vesta: '⚶', juno: '⚵', ceres: '⚳', pallas: '⚴', mean_black_moon_lilith: '⚸',
  mean_north_node: '☊', mean_south_node: '☋',
});

const ASPECT_GLYPHS = Object.freeze({
  conjunction: '☌', semi_sextile: '⚺', sextile: '⚹', square: '□',
  trine: '△', quincunx: '⚻', opposition: '☍',
});

const LUNAR_EVENT_ASPECTS = new Set(Object.keys(ASPECT_LABELS));

const BODY_FAMILIES = Object.freeze({
  sun: 'luminary', moon: 'luminary',
  mercury: 'personal', venus: 'personal', mars: 'personal',
  jupiter: 'social', saturn: 'social',
  uranus: 'outer', neptune: 'outer', pluto: 'outer',
  chiron: 'asteroid', vesta: 'asteroid', juno: 'asteroid', ceres: 'asteroid', pallas: 'asteroid',
  mean_black_moon_lilith: 'point', mean_north_node: 'point', mean_south_node: 'point',
});

export function buildForecastFeed({ forecast, interpretations, eclipses = [], lunarSnapshots = [], now, timeZone = 'America/Chicago' }) {
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
    .map((arc) => {
      const occurrenceId = occurrenceIdFor(arc);
      return serializeArc(arc, interpretations[occurrenceId], currentTime, timeZone, occurrenceId);
    })
    .filter(Boolean)
    .filter(({ range }) => toTime(range.end) >= calendarStart && toTime(range.start) <= calendarEnd)
    .sort((one, two) => one.range.focus.localeCompare(two.range.focus));
  const lunarEvents = serializeLunarEvents(forecast.arcs, eclipses, lunarSnapshots, interpretations, currentTime, timeZone)
    .filter(({ datetime }) => toTime(datetime) >= calendarStart && toTime(datetime) <= calendarEnd);
  const dailyForecasts = buildDailyForecasts(records, lunarEvents, currentTime, timeZone);

  return {
    schema: 'mystic-rebels.alchemystic-forecast.v1',
    generatedAt: forecast.generatedAt,
    timeZone,
    week: records.filter(({ hasInterpretation, interpretationTier, range }) => (
      hasInterpretation
      && interpretationTier === 'editorial'
      && toTime(range.end) >= currentTime
      && toTime(range.start) <= weekEnd
    )),
    dailyForecasts,
    calendar: {
      range: {
        start: dateKey(calendarStart, timeZone),
        end: dateKey(calendarEnd, timeZone),
      },
      records,
      lunarEvents,
    },
  };
}

function serializeLunarEvents(arcs, eclipses, lunarSnapshots, interpretations, currentTime, timeZone) {
  const eclipseEvents = Array.isArray(eclipses) ? eclipses : [];
  const snapshots = new Map((Array.isArray(lunarSnapshots) ? lunarSnapshots : [])
    .map((snapshot) => [new Date(snapshot?.timestamp).toISOString(), snapshot?.positions || []]));
  return arcs.filter((arc) => {
    const bodies = new Set([arc?.planetOne, arc?.planetTwo]);
    return bodies.has('sun') && bodies.has('moon') && LUNAR_EVENT_ASPECTS.has(arc?.aspect);
  }).map((arc) => {
    const phase = arc.aspect === 'conjunction' ? 'New Moon' : arc.aspect === 'opposition' ? 'Full Moon' : '';
    const relationship = `${labelFor(BODY_LABELS, arc.planetOne)} ${labelFor(ASPECT_LABELS, arc.aspect)} ${labelFor(BODY_LABELS, arc.planetTwo)}`;
    const eclipseKind = arc.aspect === 'conjunction' ? 'solar_eclipse' : arc.aspect === 'opposition' ? 'lunar_eclipse' : '';
    const phaseTimestamp = new Date(arc.moments?.pointOfExactitude).toISOString();
    const classification = phase ? classifyAlchemysticEclipse({
      phase,
      positions: snapshots.get(phaseTimestamp),
    }) : null;
    const eclipse = eclipseEvents.find((candidate) => (
      eclipseKind && candidate.kind === eclipseKind
      && Math.abs(toTime(candidate.timestamp) - toTime(phaseTimestamp)) <= 18 * 60 * 60 * 1000
    ));
    const datetime = eclipse?.timestamp || phaseTimestamp;
    const astronomicalLabel = eclipse ? `${titleCase(eclipse.eclipseType)} ${eclipseKind === 'solar_eclipse' ? 'Solar' : 'Lunar'} Eclipse` : '';
    const occurrenceId = occurrenceIdFor(arc);
    const transit = serializeArc(arc, interpretations[occurrenceId], currentTime, timeZone, occurrenceId);
    if (!transit) return null;
    return {
      id: `lunar:${arc.aspect}:${datetime}`,
      recordId: occurrenceId,
      kind: classification ? eclipseKind : phase ? (arc.aspect === 'conjunction' ? 'new_moon' : 'full_moon') : 'sun_moon_aspect',
      title: classification?.title || phase || relationship,
      phase,
      relationship,
      planetOneKey: arc.planetOne,
      planetOne: labelFor(BODY_LABELS, arc.planetOne),
      aspectKey: arc.aspect,
      aspect: labelFor(ASPECT_LABELS, arc.aspect),
      aspectGlyph: labelFor(ASPECT_GLYPHS, arc.aspect),
      planetTwoKey: arc.planetTwo,
      planetTwo: labelFor(BODY_LABELS, arc.planetTwo),
      eclipseClass: classification?.eclipseClass || '',
      eclipseOrientation: classification?.orientation || '',
      relevantNodeKey: classification?.relevantNodeKey || '',
      nodeDistance: classification?.nodeDistance ?? null,
      nodeAxis: classification?.nodeAxis || [],
      astronomicalType: eclipse?.eclipseType || '',
      astronomicalLabel,
      glyph: classification ? '◉' : phase ? (arc.aspect === 'conjunction' ? '●' : '○') : labelFor(ASPECT_GLYPHS, arc.aspect),
      datetime,
      phaseDatetime: phaseTimestamp,
      dateKey: dateKey(datetime, timeZone),
      display: moment(datetime, timeZone, { includeTime: true }).display,
      source: eclipse?.source || 'swiss_ephemeris_sun_moon_exactitude',
      hasInterpretation: Boolean(transit?.hasInterpretation),
      interpretation: transit?.interpretation || '',
      alignment: transit?.alignment || '',
      conditionSummary: transit?.conditionSummary || '',
    };
  }).filter(Boolean).sort((one, two) => one.datetime.localeCompare(two.datetime));
}

function serializeArc(arc, editorial, now, timeZone, occurrenceId = occurrenceIdFor(arc)) {
  const moments = arc?.moments;
  if (!moments?.activating || !moments?.pointOfExactitude || !moments?.releasing) return null;
  const hasInterpretation = Boolean(
    editorial?.interpretation
    && editorial?.alignment
    && hasCompleteInterpretationMethod(arc, editorial.method, occurrenceId)
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
      id: `${occurrenceId}:contact-shift:${event.timestamp}`,
      ...moment(event.timestamp, timeZone, { includeTime: true }),
      contactType: contactLabel(event.toContact),
      fromContact: contactLabel(event.fromContact),
      toContact: contactLabel(event.toContact),
      forcedBy: event.forcedBy || '',
      fromForcedBy: event.fromForcedBy || '',
      toForcedBy: event.toForcedBy || event.forcedBy || '',
      deviation: finiteNumber(event.deviation),
      exactAspectAngle: finiteNumber(event.exactAspectAngle),
      angularSeparation: finiteNumber(event.angularSeparation),
      planetOneOoi: finiteNumber(event.planetOneOoi),
      planetTwoOoi: finiteNumber(event.planetTwoOoi),
      side: toTime(event.timestamp) < toTime(moments.pointOfExactitude) ? 'applying' : 'separating',
    })),
  ].filter(({ contactType }) => contactType).sort((one, two) => one.datetime.localeCompare(two.datetime));
  const currentPhase = now < toTime(activating.datetime)
    ? 'Upcoming'
    : now < toTime(exactitude.datetime)
      ? 'Activating'
      : now < toTime(releasing.datetime) ? 'Point of Exactitude' : 'Releasing';
  const currentContactType = contactTimeline.reduce((contactType, entry) => (
    toTime(entry.datetime) <= now ? entry.contactType : contactType
  ), contactTimeline[0]?.contactType || 'True Aspect');

  return {
    id: occurrenceId,
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
    interpretationTier: hasInterpretation ? editorial.tier || 'editorial' : '',
    interpretation: hasInterpretation ? editorial.interpretation : '',
    alignment: hasInterpretation ? editorial.alignment : '',
    conditionSummary: hasInterpretation ? editorial.conditionSummary || '' : '',
    interpretationMethod: hasInterpretation ? editorial.method.version : '',
    daily: hasInterpretation && editorial.daily ? editorial.daily : null,
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

function buildDailyForecasts(records, lunarEvents, currentTime, timeZone) {
  const lunarEventsByRecord = new Map((lunarEvents || []).map((event) => [event.recordId, event]));
  return [-1, 0, 1].map((offset) => {
    const key = dateKey(currentTime + offset * DAY_MS, timeZone);
    const active = records
      .filter(({ hasInterpretation, daily, range }) => (
        hasInterpretation && daily && range.startDate <= key && range.endDate >= key
      ))
      .sort((one, two) => dailyPriority(two, key) - dailyPriority(one, key));
    const primary = active[0];
    const relativeLabel = ['Yesterday', 'Today', 'Tomorrow'][offset + 1];
    if (!primary) {
      return {
        dateKey: key,
        relativeLabel,
        display: dailyDateDisplay(key, timeZone),
        hasForecast: false,
        headline: 'The current is between interpreted signals.',
        current: 'The calculated calendar remains available while the next complete daily translation enters range.',
        watchFor: '',
        alchemy: '',
        activeCurrentCount: 0,
        pills: [],
      };
    }
    const primaryPhase = phaseForDate(primary, key);
    const lunarEvent = lunarEventsByRecord.get(primary.id);
    const lunarContext = dailyLunarContext(lunarEvent);
    const pills = active.slice(0, 9).map((record, index) => ({
      recordId: record.id,
      label: `${record.planetOne} ${record.aspect} ${record.planetTwo}`,
      glyphs: `${record.planetOneGlyph} ${record.aspectGlyph} ${record.planetTwoGlyph}`,
      phase: phaseForDate(record, key),
      role: index === 0 ? 'dominant' : dailyLayerRole(primary, record),
    }));
    return {
      dateKey: key,
      relativeLabel,
      display: dailyDateDisplay(key, timeZone),
      hasForecast: true,
      eventLabel: lunarContext.eventLabel,
      headline: lunarContext.headline || primary.daily.headline,
      current: [phaseLead(primaryPhase), lunarContext.current, primary.daily.current].filter(Boolean).join(' '),
      watchFor: primary.daily.watchFor,
      alchemy: [primary.daily.alchemy, lunarContext.alchemy].filter(Boolean).join(' '),
      activeCurrentCount: active.length,
      dominantTransitId: primary.id,
      dominantPhase: primaryPhase,
      pills,
      card: {
        current: lunarContext.current || primary.daily.current,
        watchFor: primary.daily.watchFor,
        alchemy: lunarContext.alchemy || primary.daily.alchemy,
      },
      full: {
        current: primary.interpretation,
        alchemy: primary.alignment,
        mainCharacters: primary.conditionSummary,
        with: pills.filter(({ role }) => role === 'with').map(({ recordId }) => recordId),
        while: pills.filter(({ role }) => role === 'while').map(({ recordId }) => recordId),
      },
    };
  });
}

function dailyLunarContext(event) {
  if (!event) return { eventLabel: '', headline: '', current: '', alchemy: '' };
  const isNamedLunarEvent = ['solar_eclipse', 'lunar_eclipse', 'new_moon', 'full_moon'].includes(event.kind);
  if (!isNamedLunarEvent) return { eventLabel: '', headline: '', current: '', alchemy: '' };
  const highlightedNode = (event.nodeAxis || []).find(({ highlighted }) => highlighted);
  const northern = event.eclipseOrientation === 'Northern';
  const southern = event.eclipseOrientation === 'Southern';
  return {
    eventLabel: event.title || event.phase || '',
    headline: northern
      ? 'The unfamiliar direction is asking for your participation.'
      : southern
        ? 'A familiar pattern is ready to be used differently.'
        : event.phase === 'New Moon'
          ? 'A new cycle is gathering around one clear intention.'
          : event.phase === 'Full Moon'
            ? 'Something has reached the point where it can be seen clearly.'
            : '',
    current: highlightedNode
      ? northern
        ? 'The next direction may feel awkward precisely because it has not been practiced yet. Discomfort is information here—not proof that the path is wrong.'
        : 'The familiar response may feel especially convincing right now. Its gift is real, but repeating it only for safety can keep the story exactly where it has been.'
      : '',
    alchemy: highlightedNode
      ? northern
        ? 'Take one small step toward the unfamiliar. Develop the energy slowly instead of copying an old version of it.'
        : 'Keep the part of the familiar response that still has value. Release the reflex to reach for it only because you already know how.'
      : '',
  };
}

function dailyPriority(record, key) {
  let score = 10;
  if (record.moments.exactitude.dateKey === key) score += 100;
  else if (record.moments.activating.dateKey === key) score += 80;
  else if (record.contactTimeline.some(({ dateKey: shiftDate, fromContact }) => shiftDate === key && fromContact)) score += 70;
  else if (record.moments.releasing.dateKey === key) score += 60;
  const bodies = new Set([record.planetOneKey, record.planetTwoKey]);
  if (bodies.has('moon') && !bodies.has('sun')) score -= 40;
  if (bodies.has('sun') && bodies.has('moon')) score += 25;
  return score;
}

function phaseForDate(record, key) {
  if (record.moments.exactitude.dateKey === key) return 'Point of Exactitude';
  if (record.moments.activating.dateKey === key) return 'Activating';
  if (record.moments.releasing.dateKey === key) return 'Releasing';
  return key < record.moments.exactitude.dateKey ? 'Applying' : 'Separating';
}

function phaseLead(phase) {
  const leads = {
    Activating: 'A new theme is making itself known.',
    Applying: 'This is building. Notice what keeps asking for your attention.',
    'Point of Exactitude': 'The emphasis turns here: what has been leading begins to receive.',
    Separating: 'The shift has happened. What you do in response matters now.',
    Releasing: 'This is making one last clear statement before it loosens its grip.',
  };
  return leads[phase] || '';
}

function dailyLayerRole(primary, record) {
  const focus = new Set([primary.planetOneKey, primary.planetTwoKey, ...(primary.daily.withBodies || [])]);
  return focus.has(record.planetOneKey) || focus.has(record.planetTwoKey) ? 'with' : 'while';
}

function dailyDateDisplay(key, timeZone) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone, weekday: 'long', month: 'long', day: 'numeric',
  }).format(new Date(`${key}T12:00:00Z`));
}

export function hasCompleteInterpretationMethod(arc, method, occurrenceId = occurrenceIdFor(arc)) {
  const hasText = (value) => typeof value === 'string' && value.trim().length > 0;
  return method?.version === 'alchemystic-interpretation.v3'
    && method.vocabularyVersion === INTERPRETATION_VOCABULARY_VERSION
    && method.occurrenceId === occurrenceId
    && method.planetOne?.body === arc?.planetOne
    && hasText(method.planetOne.condition)
    && method.planetTwo?.body === arc?.planetTwo
    && hasText(method.planetTwo.condition)
    && method.aspect?.type === arc?.aspect
    && hasText(method.aspect.synthesis)
    && dualRulershipMethodComplete(arc?.planetOne, method.planetOne)
    && dualRulershipMethodComplete(arc?.planetTwo, method.planetTwo);
}

function dualRulershipMethodComplete(body, condition) {
  const expected = body === 'mercury'
    ? [['gemini', 'inferior_mercury'], ['virgo', 'superior_mercury']]
    : body === 'venus'
      ? [['taurus', 'inferior_venus'], ['libra', 'superior_venus']]
      : null;
  if (!expected) return true;
  const requiredPhases = ['activating', 'exactitude', 'releasing'];
  const phases = condition.dualRulership?.phases;
  const fields = condition.dualRulership?.fields;
  return Array.isArray(phases)
    && phases.length === requiredPhases.length
    && requiredPhases.every((phase) => phases.includes(phase))
    && fields?.length === expected.length
    && expected.every(([sign, expression]) => fields?.some((field) => (
      field.sign === sign
      && field.expression === expression
      && requiredPhases.every((phase) => (
        Array.isArray(field.conditions?.[phase])
        && field.conditions[phase].every((bodyKey) => typeof bodyKey === 'string' && bodyKey.length > 0)
      ))
    )));
}

function occurrenceIdFor(arc) {
  const exactitude = arc?.moments?.pointOfExactitude;
  if (!exactitude) return '';
  const instant = new Date(exactitude);
  if (Number.isNaN(instant.getTime())) return '';
  return [arc.key, instant.toISOString()].join(':');
}

function contactLabel(contact) {
  if (contact === 'forced') return 'Forced Aspect';
  if (contact === 'direct') return 'True Aspect';
  return '';
}

function moment(value, timeZone, { includeTime = false } = {}) {
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) throw new TypeError(`Invalid Aspect Arc timestamp: ${value}`);
  const dateDisplay = new Intl.DateTimeFormat('en-US', {
    timeZone, weekday: 'long', month: 'long', day: 'numeric',
  }).format(instant).replace(',', ' ·');
  const timeDisplay = includeTime
    ? new Intl.DateTimeFormat('en-US', {
      timeZone, hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
    }).format(instant)
    : '';
  return {
    datetime: instant.toISOString(),
    dateKey: dateKey(instant, timeZone),
    display: [dateDisplay, timeDisplay].filter(Boolean).join(' · '),
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

function finiteNumber(value) {
  return Number.isFinite(value) ? value : null;
}

function titleCase(value) {
  return String(value || '').replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function toTime(value) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) throw new TypeError('A valid current forecast time is required.');
  return time;
}
