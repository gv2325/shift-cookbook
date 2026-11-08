/** Map view state, mirrored in the URL so any view can be shared: /map?cities=Pune,Delhi&tab=traffic&map=pm */
import { byName, MAX_COMPARE, METRICS, TABS, type MetricKey, type TabKey } from './indicators';

export type ViewState = {
  cities: string[];
  tab: TabKey;
  map: MetricKey;
};

export const DEFAULT_STATE: ViewState = {
  cities: ['Pune', 'Bengaluru', 'Hyderabad', 'Chennai'],
  tab: 'transit',
  map: 'bpm',
};

export function readState(search: string): ViewState {
  const p = new URLSearchParams(search);
  const cities = (p.get('cities') ?? '')
    .split(',')
    .map((n) => byName(n.trim())?.name)
    .filter((n): n is string => !!n);
  const tab = TABS.find((t) => t.key === p.get('tab'))?.key;
  const map = p.get('map');
  return {
    cities: p.has('cities') ? [...new Set(cities)].slice(0, MAX_COMPARE) : DEFAULT_STATE.cities,
    tab: tab ?? DEFAULT_STATE.tab,
    map: map && map in METRICS ? (map as MetricKey) : (TABS.find((t) => t.key === tab)?.map ?? DEFAULT_STATE.map),
  };
}

export function writeState(s: ViewState): string {
  const p = new URLSearchParams();
  p.set('cities', s.cities.join(','));
  p.set('tab', s.tab);
  p.set('map', s.map);
  return `?${p.toString().replace(/%2C/g, ',')}`;
}
