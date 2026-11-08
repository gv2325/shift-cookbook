/**
 * Documents for the `search` and `fetch` tools (the pair ChatGPT deep research expects):
 * one profile per city, one page per indicator, and the "Streets That Move Cities" story.
 */
import { MODES, planYear } from '../../web/src/lib/indicators';
import { CITIES, INDICATOR_IDS, SITE_URL, SOURCE_NOTE, STORY_URL, decimalsOf, indicatorInfo, mapLink, valueOf, type City } from './data';

export type Doc = { id: string; title: string; url: string; text: string; metadata: Record<string, string> };

function fmt(v: number | null, d: number, unit: string) {
  return v == null ? 'no data' : `${v.toLocaleString('en-US', { maximumFractionDigits: d })}${unit}`;
}

function cityDoc(c: City): Doc {
  const lines = [`${c.name}, India. Population: ${fmt(c.pop, 1, ' million')} (SHIFT 2025 estimate).`, ''];
  for (const id of INDICATOR_IDS) {
    const info = indicatorInfo(id);
    const unit = info.unit === 'count' ? '' : info.unit.startsWith('%') ? '%' : ` ${info.unit}`;
    lines.push(`- ${info.title}: ${fmt(valueOf(c, id), decimalsOf(id), unit)} (source: ${info.source})`);
  }
  lines.push(`- Free-flow road speed: ${fmt(c.ff, 1, ' km/h')}; morning peak: ${fmt(c.am, 1, ' km/h')}; average trip time: ${fmt(c.att, 0, ' min')}`);
  lines.push(`- Vehicles per 1,000 people: ${fmt(c.vpk, 0, '')}; EVs per 1,000: ${fmt(c.evk, 1, '')}; public bus fleet: ${fmt(c.fleet, 0, '')}`);
  if (c.modal) {
    const shares = MODES.map((m, i) => (c.modal![i] > 0 ? `${m.label} ${c.modal![i]}%` : '')).filter(Boolean).join(', ');
    lines.push(`- Mode shares: ${shares}${planYear(c) ? ` (mobility plan, ${planYear(c)})` : ''}`);
  }
  if (c.conflicts.length) {
    lines.push('', 'Where SHIFT’s two tables disagree:');
    for (const k of c.conflicts) lines.push(`- ${k.field}: ${k.a} vs ${k.b}`);
  }
  lines.push('', `Sources: ${Object.entries(c.sources).map(([k, v]) => `${k}: ${v}`).join('; ')}.`, SOURCE_NOTE);
  return {
    id: `city:${c.name.toLowerCase()}`,
    title: `${c.name}: city transport profile`,
    url: mapLink([c.name]),
    text: lines.join('\n'),
    metadata: { type: 'city', city: c.name },
  };
}

function indicatorDoc(id: (typeof INDICATOR_IDS)[number]): Doc {
  const info = indicatorInfo(id);
  const ranked = CITIES.map((c) => ({ name: c.name, v: valueOf(c, id) }))
    .filter((x) => x.v != null)
    .sort((a, b) => (b.v as number) - (a.v as number));
  const unit = info.unit === 'count' ? '' : info.unit.startsWith('%') ? '%' : ` ${info.unit}`;
  const text = [
    `${info.title}. ${info.definition}`,
    info.benchmark ? `Benchmark: ${info.benchmark.value} (${info.benchmark.label}).` : '',
    `Source: ${info.source}.`,
    '',
    `All cities with data (${ranked.length} of ${CITIES.length}), highest first:`,
    ...ranked.map((x) => `- ${x.name}: ${fmt(x.v, decimalsOf(id), unit)}`),
    '',
    `No data: ${CITIES.filter((c) => valueOf(c, id) == null).map((c) => c.name).join(', ') || 'none'}.`,
    SOURCE_NOTE,
  ].filter((l) => l !== null);
  return {
    id: `indicator:${id}`,
    title: `${info.title} across 20 Indian cities`,
    url: mapLink([], id),
    text: text.join('\n'),
    metadata: { type: 'indicator', indicator: id, theme: info.theme },
  };
}

const STORY_DOC: Doc = {
  id: 'story:streets-that-move-cities',
  title: 'Streets That Move Cities: five transport shifts Indian cities need now (WRI India)',
  url: STORY_URL,
  metadata: { type: 'story', author: 'WRI India Geo Analytics' },
  text: [
    'Summary of the WRI India StoryMap embedded on the SHIFT hub, as retold on the SHIFT Cookbook landing page.',
    '',
    'Travel time is unreliable. The problem is not only congestion but unpredictability: the real test is whether people can predict when they will arrive.',
    'Peak hour can make a 1 km drive take 2.4x (Pune) to 3.1x (Mumbai) its free-flow time in Tier 1 cities. Free-flow vs peak km/h: Delhi 46/19, Hyderabad 40/15, Pune 36/15, Mumbai 40/13, Bengaluru 38/13, Ahmedabad 34/12, Chennai 34/12, Kolkata 29/11.',
    'Tier 2 cities keep more consistent speeds: Thrissur 1.8x, Jaipur 2.7x; Indore is slowest at peak (12 km/h).',
    'Jaipur vs Coimbatore: 15-minute reach from the centre shrinks from 115.7 to 33.2 sq km in Jaipur and 91.6 to 35.9 sq km in Coimbatore between 3 AM and 7 PM.',
    'The missing middle layer: most road length is under 10 m wide (Hyderabad 95.4%, Kolkata 93.7%, Chennai 92.0%, Delhi 91.9%, Pune 89.8%, Bengaluru 86.5%, Ahmedabad 81.5%, Mumbai 63.8%). Mumbai has about 35% secondary roads. Cities should complete networks before widening arterials.',
    'Connectivity is more than road density: a 7.5 km drive reaches 65% of the area within a 7.5 km radius in Delhi vs 59% in Kolkata; Nagpur bridges its railway every 0.7 km vs about 1 km in Thrissur.',
    'Density is not connectivity: in Bengaluru a 3 km straight-line trip is 3.4 km with a 400 m detour from Basavanagudi but 4.7 km with a 1,700 m detour from Whitefield.',
    'Conclusion: better mobility is not about adding more roads but about networks that are complete, connected and direct.',
    '',
    `Full story: ${STORY_URL}. Retold at ${SITE_URL}/.`,
  ].join('\n'),
};

export const DOCS: Doc[] = [...CITIES.map(cityDoc), ...INDICATOR_IDS.map(indicatorDoc), STORY_DOC];

const tokenize = (s: string) => s.toLowerCase().normalize('NFKD').match(/[a-z0-9]+/g) ?? [];

// BM25 over title + body. Rare terms ("secondary") outweigh words every document shares ("road"),
// and title words count double. Prefix matching lets "bus" find "buses".
const INDEX = DOCS.map((d) => {
  const title = tokenize(d.title);
  const words = [...title, ...title, ...tokenize(d.text)];
  return { d, words, len: words.length };
});
const AVG_LEN = INDEX.reduce((a, x) => a + x.len, 0) / INDEX.length;

export function searchDocs(query: string, limit = 8): Doc[] {
  const terms = [...new Set(tokenize(query))].filter((t) => t.length > 1);
  if (!terms.length) return DOCS.slice(0, limit);
  const k1 = 1.2;
  const b = 0.75;
  const df = new Map(terms.map((t) => [t, INDEX.filter((x) => x.words.some((w) => w.startsWith(t))).length]));
  return INDEX.map((x) => {
    let score = 0;
    for (const t of terms) {
      const n = df.get(t)!;
      if (!n) continue;
      const tf = x.words.filter((w) => w.startsWith(t)).length;
      if (!tf) continue;
      const idf = Math.log(1 + (INDEX.length - n + 0.5) / (n + 0.5));
      score += (idf * tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * x.len) / AVG_LEN));
    }
    return { d: x.d, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.d);
}

export function getDoc(id: string): Doc | undefined {
  return DOCS.find((d) => d.id === id.trim().toLowerCase());
}
