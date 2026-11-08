/**
 * Indicator, tab and colour definitions for the explore map, plus the pure helpers that turn
 * city records into chart rows. Kept free of UI code so the same functions can back the
 * future MCP server (see docs/architecture/system-design.md, packages/tools).
 */
import citiesDoc from '../data/cities.json';

export type City = {
  name: string;
  lat: number;
  lon: number;
  pop: number | null;
  rid: number | null;
  cov: number | null;
  bpm: number | null;
  fleet: number | null;
  att: number | null;
  ff: number | null;
  am: number | null;
  pm: number | null;
  vpk: number | null;
  evk: number | null;
  fpm: number | null;
  cpm: number | null;
  modal: number[] | null;
  speeds: number[] | null;
  sources: Record<string, string>;
  conflicts: { field: string; a: number; b: number }[];
};

export const CITIES: City[] = citiesDoc.cities as City[];
export const DATA_META = citiesDoc._meta;

export const NAVY = '#1c274a';
/** Categorical colours for the (up to four) compared cities, in selection order. */
export const CITY_COLORS = ['#4ccce2', '#e2684c', '#83e24c', '#c897dc'];
export const MAX_COMPARE = 4;

const RAMP = {
  yellow: ['#f9f1d1', '#f3e3a2', '#f0dc8b', '#e8cc6b', '#e2be4c'],
  green: ['#e2f9d1', '#c5f3a2', '#b7f08b', '#9ce86b', '#83e24c'],
  blue: ['#d1f4f9', '#a2e9f3', '#8be4f0', '#6bd7e8', '#4ccce2'],
  red: ['#f9dad1', '#f3b5a2', '#f0a38b', '#e8856b', '#e2684c'],
};

export type MetricKey = 'bpm' | 'cov' | 'rid' | 'sust' | 'pm' | 'fpm' | 'cpm';

export type Metric = {
  key: MetricKey;
  title: string;
  description: string;
  source: string;
  unit: string;
  decimals: number;
  ramp: string[];
  breaks: number[];
  labels: string[];
  benchmark?: { value: number; label: string };
};

export const METRICS: Record<MetricKey, Metric> = {
  bpm: {
    key: 'bpm',
    title: 'Buses per million residents',
    description: 'India’s benchmark is 600 public buses per million residents (60 per 100,000). Every SHIFT city falls short.',
    source: 'City transport authorities, ASRTU, PM e-Bus Sewa',
    unit: '',
    decimals: 0,
    ramp: RAMP.yellow,
    breaks: [50, 150, 300, 600],
    labels: ['<50', '50', '150', '300', '600+'],
    benchmark: { value: 600, label: '600 target' },
  },
  cov: {
    key: 'cov',
    title: 'Residents covered by public transport',
    description: 'Share of residents within reach of a bus or metro service.',
    source: 'SHIFT city profiles',
    unit: '%',
    decimals: 0,
    ramp: RAMP.yellow,
    breaks: [10, 20, 40, 60],
    labels: ['<10%', '10%', '20%', '40%', '60%+'],
  },
  rid: {
    key: 'rid',
    title: 'Daily public transport trips',
    description: 'Average weekday trips on buses and metro, in millions.',
    source: 'City mobility plans and latest ridership reports',
    unit: 'M',
    decimals: 2,
    ramp: RAMP.yellow,
    breaks: [0.5, 1, 3, 6],
    labels: ['<0.5M', '0.5M', '1M', '3M', '6M+'],
  },
  sust: {
    key: 'sust',
    title: 'Walking, cycling and public transport',
    description: 'Share of daily trips made without a private vehicle. Shown only where the plan accounts for at least 60% of trips.',
    source: 'Each city’s mobility plan',
    unit: '%',
    decimals: 0,
    ramp: RAMP.green,
    breaks: [20, 35, 50, 65],
    labels: ['<20%', '20%', '35%', '50%', '65%+'],
  },
  pm: {
    key: 'pm',
    title: 'Evening peak road speed',
    description: 'Average road speed in the slowest evening hour, in km/h.',
    source: 'Google Maps travel times (2025) via SHIFT; republication under review',
    unit: ' km/h',
    decimals: 1,
    ramp: RAMP.blue,
    breaks: [14, 17, 20, 23],
    labels: ['<14', '14', '17', '20', '23+'],
  },
  fpm: {
    key: 'fpm',
    title: 'Road deaths per million residents',
    description: 'Fatalities in road crashes, per million residents.',
    source: 'MoRTH Road Accidents in India (2022)',
    unit: '',
    decimals: 1,
    ramp: RAMP.red,
    breaks: [15, 30, 45, 60],
    labels: ['<15', '15', '30', '45', '60+'],
  },
  cpm: {
    key: 'cpm',
    title: 'Road crashes per million residents',
    description: 'All reported road crashes, per million residents.',
    source: 'MoRTH Road Accidents in India (2022)',
    unit: '',
    decimals: 0,
    ramp: RAMP.red,
    breaks: [100, 200, 400, 800],
    labels: ['<100', '100', '200', '400', '800+'],
  },
};

export type TabKey = 'transit' | 'modes' | 'traffic' | 'safety' | 'cities';

export type Tab = {
  key: TabKey;
  label: string;
  name: string;
  headline: string;
  intro: string;
  color: string;
  /** Indicator shown on the map when this tab opens (null keeps the current one). */
  map: MetricKey | null;
  icon: string;
};

export const TABS: Tab[] = [
  {
    key: 'transit',
    label: 'Transit',
    name: 'Public transit',
    headline: 'Are buses keeping up with cities?',
    intro: 'Bus fleets, coverage and ridership for the cities you are comparing, measured against population.',
    color: '#f0dc8b',
    map: 'bpm',
    icon: 'M6 3h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM5 10h14M8 17v3M16 17v3M8.5 13.5h.01M15.5 13.5h.01',
  },
  {
    key: 'modes',
    label: 'Modes',
    name: 'Modal share',
    headline: 'How cities move',
    intro: 'How residents make their daily trips, from each city’s own mobility plan. Plan years range from 2010 to 2025.',
    color: '#b7f08b',
    map: 'sust',
    icon: 'M13 4.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0zM11.5 8l-2 5 3 2 1 5M11.5 8l3 3 3 1M9.5 13l-2 7',
  },
  {
    key: 'traffic',
    label: 'Traffic',
    name: 'Road traffic',
    headline: 'When do roads slow down?',
    intro: 'Average road speeds through the day and at the evening peak, from travel-time data.',
    color: '#8be4f0',
    map: 'pm',
    icon: 'M4 17a8 8 0 1 1 16 0M12 17l4-5M4 17h16',
  },
  {
    key: 'safety',
    label: 'Safety',
    name: 'Road safety',
    headline: 'How safe are city roads?',
    intro: 'Road deaths and crashes per million residents, from the Ministry of Road Transport and Highways.',
    color: '#f0a38b',
    map: 'fpm',
    icon: 'M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6zM12 8v5M12 16v.5',
  },
  {
    key: 'cities',
    label: 'Cities',
    name: 'Cities',
    headline: 'Choose up to four cities',
    intro: 'SHIFT covers 20 Indian cities. Add them here or by clicking the map.',
    color: '#e2c4ed',
    map: null,
    icon: 'M12 21s-6-6-6-11a6 6 0 1 1 12 0c0 5-6 11-6 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  },
];

export const MODES = [
  { label: 'Walking', fill: '#83e24c' },
  { label: 'Cycling', fill: '#c5f3a2' },
  { label: 'Bus', fill: '#4ccce2' },
  { label: 'BRT', fill: '#a2e9f3' },
  { label: 'Metro / rail', fill: '#c897dc' },
  { label: 'Two-wheeler', fill: '#e2684c' },
  { label: 'Auto-rickshaw', fill: '#e2be4c' },
  { label: 'Car', fill: '#f0a38b' },
  { label: 'Other', fill: '#d2d4db' },
];

/** Share of trips by walking, cycling and public transport; null if the plan covers under 60% of trips. */
export function sustainableShare(c: City): number | null {
  if (!c.modal) return null;
  const total = c.modal.reduce((a, b) => a + b, 0);
  if (total < 60) return null;
  return c.modal.slice(0, 5).reduce((a, b) => a + b, 0);
}

export function metricValue(c: City, key: MetricKey): number | null {
  return key === 'sust' ? sustainableShare(c) : c[key];
}

export function bucket(m: Metric, v: number): number {
  return m.breaks.filter((b) => v >= b).length;
}

export function colorFor(m: Metric, v: number | null): string | null {
  return v == null ? null : m.ramp[bucket(m, v)];
}

export function fmt(v: number | null, decimals = 0, unit = ''): string {
  if (v == null) return 'No data';
  return `${v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${unit}`;
}

/** Year in parentheses at the end of a mobility-plan citation, e.g. "… (2019)". */
export function planYear(c: City): string | null {
  const m = (c.sources?.Mobility ?? '').match(/\((\d{4})\)\s*$/);
  return m ? m[1] : null;
}

export function byName(name: string): City | undefined {
  return CITIES.find((c) => c.name.toLowerCase() === name.toLowerCase());
}
