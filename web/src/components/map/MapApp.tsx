import { useEffect, useState } from 'preact/hooks';
import MapView from './MapView';
import { Bars, CityList, ModalStacks, SpeedLines, Widget, type Selected } from './Widgets';
import { CITY_COLORS, MAX_COMPARE, METRICS, TABS, byName, fmt, metricValue, type MetricKey, type TabKey } from '../../lib/indicators';
import { readState, writeState, type ViewState } from '../../lib/state';

const BASE = import.meta.env.BASE_URL.replace(/\/?$/, '/');

export default function MapApp() {
  const [state, setState] = useState<ViewState>(() => readState(window.location.search));
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notesOpen, setNotesOpen] = useState(false);
  const [note, setNote] = useState('');

  // Keep the URL in step with the view so any state can be shared.
  useEffect(() => {
    const qs = writeState(state);
    if (qs !== window.location.search) window.history.replaceState(null, '', `${window.location.pathname}${qs}`);
  }, [state]);

  const tab = TABS.find((t) => t.key === state.tab)!;
  const selected: Selected[] = state.cities.map((n, i) => ({ ...byName(n)!, color: CITY_COLORS[i] }));

  const toggleCity = (name: string) => {
    if (state.cities.includes(name)) {
      setNote('');
      setState({ ...state, cities: state.cities.filter((c) => c !== name) });
    } else if (state.cities.length >= MAX_COMPARE) {
      setNote(`You can compare up to four cities. Remove one to add ${name}.`);
    } else {
      setNote('');
      setState({ ...state, cities: [...state.cities, name] });
    }
  };
  const pickTab = (key: TabKey) => {
    const t = TABS.find((x) => x.key === key)!;
    setState({ ...state, tab: key, map: t.map ?? state.map });
  };
  const onMap = (key: MetricKey) => ({ on: state.map === key, toggle: () => setState({ ...state, map: key }) });
  const csvFor = (key: MetricKey) => () => {
    const m = METRICS[key];
    return [['city', `${m.title}${m.unit ? ` (${m.unit.trim()})` : ''}`, 'source'], ...selected.map((c) => [c.name, metricValue(c, key), m.source])];
  };
  const metricWidget = (key: MetricKey) => {
    const m = METRICS[key];
    return (
      <Widget key={key} title={m.title} description={m.description} source={m.source} csv={csvFor(key)} onMap={onMap(key)}>
        <Bars metric={m} cities={selected} />
      </Widget>
    );
  };

  const conflicts = selected.flatMap((c) =>
    c.conflicts.map((d) => `${c.name} · ${d.field.toLowerCase()}: ${fmt(d.a, d.a % 1 ? 1 : 0)} in one SHIFT table, ${fmt(d.b, d.b % 1 ? 1 : 0)} in another`),
  );

  return (
    <div class="flex h-dvh flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
      {sidebarOpen && (
        <aside aria-label="Explore SHIFT data" class="relative flex w-full shrink-0 flex-col bg-white lg:h-full lg:w-[640px] lg:overflow-y-auto">
          <header class="relative px-6 pt-5 sm:px-20">
            <div aria-hidden="true" class="absolute inset-x-0 top-0 bottom-8 transition-colors duration-300" style={{ background: tab.color }} />
            <a href={BASE} class="relative inline-block py-1 font-display text-3xl text-navy-500 no-underline">
              SHIFT
            </a>
            <div role="tablist" aria-label="Themes" class="relative flex gap-5 py-3">
              {TABS.map((t) => {
                const active = t.key === state.tab;
                return (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-controls="tab-panel"
                    onClick={() => pickTab(t.key)}
                    class="group flex min-w-11 flex-col items-center gap-0.5"
                  >
                    <span class={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${active ? 'bg-navy-500' : 'group-hover:bg-navy-500/10'}`}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? t.color : 'currentColor'} stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d={t.icon} />
                      </svg>
                    </span>
                    <span class="text-xxs">{t.label}</span>
                  </button>
                );
              })}
            </div>
            <h2 class="relative mt-12 border-b border-navy-500/30 pb-6 text-xl font-medium">{tab.name}</h2>
            <h3 class="relative pt-6 font-display text-4xl sm:text-5xl sm:leading-[3.5rem]">{tab.headline}</h3>
          </header>

          <div id="tab-panel" role="tabpanel" aria-label={tab.name} class="flex grow flex-col">
            <p class="px-6 pt-4 pb-10 font-light sm:px-20">{tab.intro}</p>

            <div class="grow px-6 sm:px-20">
              {selected.length === 0 && state.tab !== 'cities' && (
                <p class="border-t border-navy-500/30 py-10 font-light">
                  No cities selected yet. Click cities on the map, or use{' '}
                  <button type="button" class="underline" onClick={() => pickTab('cities')}>
                    the Cities tab
                  </button>
                  .
                </p>
              )}

              {selected.length > 0 && state.tab === 'transit' && ['bpm', 'cov', 'rid'].map((k) => metricWidget(k as MetricKey))}

              {selected.length > 0 && state.tab === 'modes' && (
                <>
                  <Widget
                    title="Trips by mode"
                    description="Each bar is 100% of daily trips. Hatched means the plan does not account for that share."
                    source="Each city’s mobility plan"
                    csv={() => [
                      ['city', 'walking', 'cycling', 'bus', 'brt', 'metro_rail', 'two_wheeler', 'auto_rickshaw', 'car', 'other', 'plan'],
                      ...selected.map((c) => [c.name, ...(c.modal ?? Array(9).fill(null)), c.sources.Mobility ?? null]),
                    ]}
                  >
                    <ModalStacks cities={selected} />
                  </Widget>
                  {metricWidget('sust')}
                </>
              )}

              {selected.length > 0 && state.tab === 'traffic' && (
                <>
                  <Widget
                    title="Average speed through the day"
                    description="Average road speed in km/h for each hour, on a typical weekday."
                    source="Google Maps travel times (2025) via SHIFT; republication under review"
                    csv={() => [['city', ...Array.from({ length: 24 }, (_, h) => `h${h}`)], ...selected.map((c) => [c.name, ...(c.speeds ?? [])])]}
                  >
                    <SpeedLines cities={selected} />
                  </Widget>
                  {metricWidget('pm')}
                </>
              )}

              {selected.length > 0 && state.tab === 'safety' && ['fpm', 'cpm'].map((k) => metricWidget(k as MetricKey))}

              {state.tab === 'cities' && (
                <Widget title="All cities" description="Population figures are SHIFT’s 2025 estimates." source="SHIFT master data sheet (2025)">
                  <CityList selected={state.cities} onToggle={toggleCity} />
                </Widget>
              )}

              <section class="border-t border-navy-500/30 pt-5 pb-10">
                <button type="button" aria-expanded={notesOpen} onClick={() => setNotesOpen(!notesOpen)} class="flex items-center gap-2 text-sm font-semibold hover:underline">
                  Where SHIFT’s sources disagree ({conflicts.length})
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" class={notesOpen ? 'rotate-180' : ''}>
                    <path d="M1 3l4 4 4-4" />
                  </svg>
                </button>
                {notesOpen && (
                  <ul class="mt-2.5 flex list-disc flex-col gap-1.5 pl-5 text-sm font-light">
                    {conflicts.length ? conflicts.map((t) => <li key={t}>{t}</li>) : <li>No conflicts for the selected cities.</li>}
                  </ul>
                )}
              </section>
            </div>
          </div>

          <div class="sticky bottom-0 z-10 bg-navy-500 text-white">
            {note && (
              <p role="status" class="px-6 pt-2.5 text-xs sm:px-10">
                {note}
              </p>
            )}
            <div class="flex items-start gap-6 px-6 py-4 sm:px-10">
              <p class="shrink-0 py-1.5 text-xs italic">Comparing:</p>
              <div class="flex flex-wrap gap-2">
                {selected.map((c) => (
                  <span key={c.name} class="flex items-center gap-2 rounded-3xl bg-white py-1 pr-1 pl-2 text-navy-500">
                    <span class="h-2 w-2 rounded-full border border-navy-500" style={{ background: c.color }} />
                    <span class="text-xs font-bold uppercase">{c.name}</span>
                    <button type="button" onClick={() => toggleCity(c.name)} aria-label={`Remove ${c.name}`} class="flex h-5 w-5 items-center justify-center rounded-full bg-navy-500">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#fff" stroke-width="1.5" aria-hidden="true">
                        <path d="M2 2l6 6M8 2l-6 6" />
                      </svg>
                    </button>
                  </span>
                ))}
                <button type="button" onClick={() => pickTab('cities')} class="h-7 rounded-3xl bg-navy-400 px-2.5 text-xs font-bold text-navy-500 uppercase hover:bg-white">
                  Add city
                </button>
              </div>
            </div>
          </div>
        </aside>
      )}

      <div class="relative order-first min-h-[55vh] grow lg:order-none lg:min-h-0">
        <MapView selected={state.cities} metric={state.map} onToggle={toggleCity} sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      </div>
    </div>
  );
}
