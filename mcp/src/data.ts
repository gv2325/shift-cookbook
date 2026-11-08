/**
 * SHIFT data access for the MCP tools. Reuses the explore map's indicator definitions
 * (web/src/lib/indicators.ts) so answers in Claude/ChatGPT match what the map shows.
 */
import { CITIES, DATA_META, METRICS, metricValue, planYear, type City, type MetricKey } from '../../web/src/lib/indicators';

export const SITE_URL = (process.env.SITE_URL ?? 'https://shift-cookbook-web.onrender.com').replace(/\/$/, '');
export const RETRIEVED = DATA_META.retrieved;
export const STORY_URL = 'https://storymaps.arcgis.com/stories/af65c76c19f34309b0d0e7b586fa2bcf';

/** Public indicator ids used by the tools, mapped to the map's internal metric keys. */
export const INDICATORS = {
  buses_per_million: 'bpm',
  pt_coverage: 'cov',
  daily_pt_trips: 'rid',
  sustainable_mode_share: 'sust',
  evening_peak_speed: 'pm',
  road_deaths_per_million: 'fpm',
  road_crashes_per_million: 'cpm',
} as const satisfies Record<string, MetricKey>;

export type IndicatorId = keyof typeof INDICATORS;
export const INDICATOR_IDS = Object.keys(INDICATORS) as [IndicatorId, ...IndicatorId[]];

const THEME: Record<IndicatorId, string> = {
  buses_per_million: 'transit',
  pt_coverage: 'transit',
  daily_pt_trips: 'transit',
  sustainable_mode_share: 'modes',
  evening_peak_speed: 'traffic',
  road_deaths_per_million: 'safety',
  road_crashes_per_million: 'safety',
};

/** Which "conflicts" fields (where SHIFT's two tables disagree) are relevant to each indicator. */
const CONFLICT_FIELDS: Partial<Record<IndicatorId, string[]>> = {
  buses_per_million: ['Bus fleet'],
  road_deaths_per_million: ['Fatalities per million'],
  sustainable_mode_share: ['Car mode share %', 'Bus mode share %'],
};

export const SOURCE_NOTE = `SHIFT Transport Analytics Hub (shift-transport.org), retrieved ${RETRIEVED}. No licence is stated by the source; treat as "to be confirmed".`;

export function indicatorInfo(id: IndicatorId) {
  const m = METRICS[INDICATORS[id]];
  return {
    id,
    title: m.title,
    unit: m.unit.trim() || 'count',
    theme: THEME[id],
    definition: m.description,
    source: m.source,
    benchmark: m.benchmark ? { value: m.benchmark.value, label: m.benchmark.label } : null,
  };
}

const ALIASES: Record<string, string> = {
  bangalore: 'Bengaluru',
  bombay: 'Mumbai',
  calcutta: 'Kolkata',
  madras: 'Chennai',
  cochin: 'Kochi',
  ernakulam: 'Kochi',
  calicut: 'Kozhikode',
  trichur: 'Thrissur',
  'new delhi': 'Delhi',
  'ncr delhi': 'Delhi',
  'delhi ncr': 'Delhi',
  poona: 'Pune',
  cawnpore: 'Kanpur',
};

function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

export type CityLookup = { city: City } | { city: null; suggestions: string[] };

export function findCity(input: string): CityLookup {
  const q = input.trim().toLowerCase();
  const direct = CITIES.find((c) => c.name.toLowerCase() === q) ?? CITIES.find((c) => c.name === ALIASES[q]);
  if (direct) return { city: direct };
  const suggestions = CITIES.map((c) => ({ name: c.name, d: editDistance(q, c.name.toLowerCase()) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 3)
    .map((x) => x.name);
  return { city: null, suggestions };
}

export function valueOf(city: City, id: IndicatorId): number | null {
  return metricValue(city, INDICATORS[id]);
}

export function caveatsFor(city: City, id: IndicatorId): string[] {
  const out: string[] = [];
  if (valueOf(city, id) == null) out.push(`Not in SHIFT data for ${city.name}: the source has no value (or zero, treated as missing).`);
  for (const c of city.conflicts) {
    if (CONFLICT_FIELDS[id]?.includes(c.field)) out.push(`${city.name}: SHIFT's own tables disagree on ${c.field.toLowerCase()} (${c.a} vs ${c.b}). The first value is used.`);
  }
  if (id === 'sustainable_mode_share' && city.modal) {
    const year = planYear(city);
    if (year) out.push(`${city.name} mode shares come from a mobility plan dated ${year}.`);
  }
  if (id === 'evening_peak_speed') out.push('Speeds are derived from Google Maps travel times (2025); whether they may be republished is under review.');
  return out;
}

export function mapLink(cities: string[], id?: IndicatorId, tab?: string): string {
  const p = new URLSearchParams();
  if (cities.length) p.set('cities', cities.slice(0, 4).join(','));
  const t = tab ?? (id ? THEME[id] : undefined);
  if (t) p.set('tab', t);
  if (id) p.set('map', INDICATORS[id]);
  return `${SITE_URL}/map?${p.toString().replace(/%2C/g, ',')}`;
}

export function round(v: number | null, decimals: number): number | null {
  return v == null ? null : Number(v.toFixed(decimals));
}

export function decimalsOf(id: IndicatorId): number {
  return METRICS[INDICATORS[id]].decimals;
}

export { CITIES, type City };
