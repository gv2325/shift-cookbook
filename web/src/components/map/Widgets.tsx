import { useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { CITIES, CITY_COLORS, MODES, NAVY, fmt, metricValue, planYear, type City, type Metric } from '../../lib/indicators';

export type Selected = City & { color: string };

function downloadCsv(filename: string, rows: (string | number | null)[][]) {
  const esc = (v: string | number | null) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const blob = new Blob([rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Foodscapes-style widget: serif title, toolbar (info, download, show on map), body, source line. */
export function Widget(props: {
  title: string;
  description: string;
  source: string;
  csv?: () => (string | number | null)[][];
  onMap?: { on: boolean; toggle: () => void };
  children: ComponentChildren;
}) {
  const [info, setInfo] = useState(false);
  const id = `w-${slug(props.title)}`;
  return (
    <section class="flex flex-col gap-4 border-t border-navy-500/30 py-10" aria-labelledby={id}>
      <header class="flex items-center justify-between gap-5">
        <h4 id={id} class="font-display text-2xl">{props.title}</h4>
        <div class="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-full hover:bg-navy-200"
            aria-label={`About: ${props.title}`}
            aria-expanded={info}
            onClick={() => setInfo(!info)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v6M12 7.5v.5" />
            </svg>
          </button>
          {props.csv && (
            <button
              type="button"
              class="flex h-8 w-8 items-center justify-center rounded-full hover:bg-navy-200"
              aria-label={`Download ${props.title} as CSV`}
              onClick={() => downloadCsv(`${slug(props.title)}.csv`, props.csv!())}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
              </svg>
            </button>
          )}
          {props.onMap && (
            <button
              type="button"
              role="switch"
              aria-checked={props.onMap.on}
              aria-label={props.onMap.on ? `${props.title}: shown on map` : `Show ${props.title} on map`}
              title={props.onMap.on ? 'Shown on map' : 'Show on map'}
              class="ml-1 flex h-8 w-11 items-center justify-center"
              onClick={props.onMap.toggle}
            >
              <span class={`flex h-3 w-6 items-center rounded-full px-0.5 ${props.onMap.on ? 'justify-end bg-navy-500' : 'justify-start bg-navy-200'}`}>
                <span class="h-2 w-2 rounded-full bg-white" />
              </span>
            </button>
          )}
        </div>
      </header>
      <p class="font-light">{props.description}</p>
      {props.children}
      {info && (
        <p class="bg-yellow-100 p-3 text-sm font-light">
          <strong class="font-semibold">Source:</strong> {props.source}. Values come from the SHIFT Transport Analytics Hub; zeros there are shown as
          “no data”.
        </p>
      )}
      <p class="text-xs font-light text-navy-300">Source: {props.source}.</p>
    </section>
  );
}

/** Foodscapes HorizontalBar: thin outlined bars with the value at the end and the city name beneath. */
export function Bars({ metric, cities }: { metric: Metric; cities: Selected[] }) {
  const vals = cities.map((c) => metricValue(c, metric.key)).filter((v): v is number => v != null);
  const max = Math.max(metric.benchmark?.value ?? 0, ...vals, 1e-9);
  const pos = (v: number) => 5 + (95 * v) / max;
  return (
    <div class={`relative ${metric.benchmark ? 'pt-[18px]' : ''}`}>
      {metric.benchmark && (
        <div aria-hidden="true" class="absolute top-0 bottom-0 border-l border-dashed border-navy-500" style={{ left: `${pos(metric.benchmark.value)}%` }}>
          <span class="absolute top-0 left-1 text-xxs leading-3 font-bold whitespace-nowrap">{metric.benchmark.label}</span>
        </div>
      )}
      <ul class="m-0 flex list-none flex-col gap-2.5 p-0">
        {cities.map((c) => {
          const v = metricValue(c, metric.key);
          return (
            <li key={c.name}>
              {v != null && (
                <div class="flex items-center gap-1" style={{ width: `${pos(v)}%` }} aria-hidden="true">
                  <span class="h-2 grow border border-navy-500" style={{ background: c.color }} />
                  <span class="shrink-0 text-xxs leading-3 font-bold">{fmt(v, metric.decimals, metric.unit)}</span>
                </div>
              )}
              <div class="text-sm font-light">
                {c.name}
                <span class="sr-only">: {fmt(v, metric.decimals, metric.unit)}</span>
                {v == null && <span class="text-navy-300 italic"> · no data in SHIFT</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const HATCH = 'repeating-linear-gradient(45deg, #fff 0 3px, #d2d4db 3px 4px)';

export function ModalStacks({ cities }: { cities: Selected[] }) {
  return (
    <>
      <div class="flex flex-wrap gap-x-3.5 gap-y-1.5 text-xs font-light">
        {MODES.slice(0, 8).map((m) => (
          <span key={m.label} class="flex items-center gap-1.5">
            <span class="h-2.5 w-2.5 border border-navy-500" style={{ background: m.fill }} />
            {m.label}
          </span>
        ))}
        <span class="flex items-center gap-1.5">
          <span class="h-2.5 w-2.5 border border-navy-500" style={{ background: HATCH }} />
          Not reported
        </span>
      </div>
      <ul class="m-0 flex list-none flex-col gap-3.5 p-0">
        {cities.map((c) => {
          const year = planYear(c);
          if (!c.modal) {
            return (
              <li key={c.name} class="text-sm font-light">
                {c.name} <span class="text-navy-300 italic">· no modal share in SHIFT</span>
              </li>
            );
          }
          const total = c.modal.reduce((a, b) => a + b, 0);
          const k = total > 100 ? 100 / total : 1;
          const label = MODES.map((m, i) => (c.modal![i] > 0 ? `${m.label} ${c.modal![i]}%` : ''))
            .filter(Boolean)
            .join(', ');
          return (
            <li key={c.name} class="flex flex-col gap-1">
              <div class="flex h-3 border border-navy-500" role="img" aria-label={`${c.name}: ${label}${total < 100 ? `, not reported ${100 - total}%` : ''}`}>
                {MODES.map((m, i) =>
                  c.modal![i] > 0 ? <span key={m.label} title={`${m.label} ${c.modal![i]}%`} class="border-r border-navy-500" style={{ width: `${c.modal![i] * k}%`, background: m.fill }} /> : null,
                )}
                {total < 100 && <span title={`Not reported ${100 - total}%`} style={{ width: `${100 - total}%`, background: HATCH }} />}
              </div>
              <div class="text-sm font-light">
                {c.name}
                {year && <span class="text-navy-300"> · plan from {year}</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function SpeedLines({ cities }: { cities: Selected[] }) {
  const withData = cities.filter((c) => c.speeds);
  return (
    <>
      <div class="grid grid-cols-[28px_minmax(0,1fr)] gap-1.5">
        <div aria-hidden="true" class="relative h-[180px] text-right text-xxs leading-3 font-bold">
          {[40, 30, 20, 10, 0].map((v, i) => (
            <span key={v} class="absolute right-0" style={{ top: `${i * 45 - 6}px` }}>
              {v}
            </span>
          ))}
        </div>
        <div
          role="img"
          aria-label={`Line chart of average road speed by hour for ${withData.map((c) => c.name).join(', ')}. Values are in the table below.`}
          class="relative h-[180px] border-b border-l border-navy-500"
        >
          {[45, 90, 135].map((t) => (
            <span key={t} class="absolute right-0 left-0 border-t border-dashed border-navy-200" style={{ top: `${t}px` }} />
          ))}
          {withData.map((c) => {
            const pts = c.speeds!.map((v, h) => `${h * 10},${180 - v * 4.5}`).join(' ');
            return (
              <svg key={c.name} viewBox="0 0 230 180" preserveAspectRatio="none" aria-hidden="true" class="absolute inset-0 h-full w-full overflow-visible">
                <polyline points={pts} fill="none" stroke={NAVY} stroke-width="4.5" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
                <polyline points={pts} fill="none" stroke={c.color} stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
              </svg>
            );
          })}
        </div>
        <span />
        <div class="flex justify-between text-xxs leading-3 font-bold" aria-hidden="true">
          <span>12 AM</span>
          <span>6 AM</span>
          <span>12 PM</span>
          <span>6 PM</span>
          <span>11 PM</span>
        </div>
      </div>
      <table class="w-full border-collapse text-sm font-light tabular-nums">
        <caption class="sr-only">Road speeds in km/h and average trip time in minutes</caption>
        <thead>
          <tr class="border-b border-navy-500 text-left text-xs font-bold">
            <th scope="col" class="py-1.5">City</th>
            <th scope="col" class="py-1.5 text-right">Free flow</th>
            <th scope="col" class="py-1.5 text-right">AM peak</th>
            <th scope="col" class="py-1.5 text-right">PM peak</th>
            <th scope="col" class="py-1.5 text-right">Trip, min</th>
          </tr>
        </thead>
        <tbody>
          {cities.map((c) => (
            <tr key={c.name} class="border-b border-navy-200">
              <th scope="row" class="py-1.5 text-left font-light">
                <span class="mr-2 inline-block h-1 w-4 border border-navy-500 align-middle" style={{ background: c.color }} />
                {c.name}
              </th>
              <td class="py-1.5 text-right">{c.ff == null ? '—' : fmt(c.ff, 1)}</td>
              <td class="py-1.5 text-right">{c.am == null ? '—' : fmt(c.am, 1)}</td>
              <td class="py-1.5 text-right">{c.pm == null ? '—' : fmt(c.pm, 1)}</td>
              <td class="py-1.5 text-right">{c.att == null ? '—' : fmt(c.att, 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export function CityList({ selected, onToggle }: { selected: string[]; onToggle: (name: string) => void }) {
  const [q, setQ] = useState('');
  const list = CITIES.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <>
      <label for="city-search" class="sr-only">
        Search cities
      </label>
      <input
        id="city-search"
        type="search"
        placeholder="Search 20 Indian cities"
        value={q}
        onInput={(e) => setQ((e.target as HTMLInputElement).value)}
        class="h-10 w-full border border-navy-500 bg-white px-3 text-sm"
      />
      <ul class="m-0 list-none p-0">
        {list.map((c) => {
          const i = selected.indexOf(c.name);
          const on = i >= 0;
          return (
            <li key={c.name} class="flex min-h-12 items-center justify-between gap-3 border-b border-navy-200">
              <span class="flex items-center gap-2.5">
                <span class="h-2.5 w-2.5 rounded-full border border-navy-500" style={{ background: on ? CITY_COLORS[i] : '#fff' }} />
                <span>{c.name}</span>
                {c.pop && <span class="text-sm font-light text-navy-300">{fmt(c.pop, 1)}M people</span>}
              </span>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onToggle(c.name)}
                class={`h-7 rounded-full border border-navy-500 px-3 text-xs font-bold uppercase ${on ? 'bg-navy-500 text-white' : 'bg-white'}`}
              >
                <span class="sr-only">{c.name}: </span>
                {on ? 'Remove' : 'Compare'}
              </button>
            </li>
          );
        })}
        {list.length === 0 && <li class="py-3 text-sm font-light">No city matches “{q}”.</li>}
      </ul>
    </>
  );
}
