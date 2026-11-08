import { useEffect, useRef, useState } from 'preact/hooks';
import { Map as MLMap, Popup, setWorkerUrl, type ErrorEvent, type GeoJSONSource, type MapLayerMouseEvent, type SymbolLayerSpecification } from 'maplibre-gl';
// MapLibre 6 decodes tiles in a separate worker file; ship it as a hashed asset served from this site.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import type { FeatureCollection, Point } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import { CITIES, CITY_COLORS, METRICS, NAVY, colorFor, fmt, metricValue, type MetricKey } from '../../lib/indicators';

setWorkerUrl(workerUrl);

const BASE = import.meta.env.BASE_URL.replace(/\/?$/, '/');
const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
const INDIA_BOUNDS: [[number, number], [number, number]] = [
  [68, 6.5],
  [97.5, 35.5],
];

type Props = {
  selected: string[];
  metric: MetricKey;
  onToggle: (name: string) => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
};

function features(selected: string[], metric: MetricKey): FeatureCollection {
  const m = METRICS[metric];
  return {
    type: 'FeatureCollection',
    features: CITIES.map((c) => {
      const v = metricValue(c, metric);
      const i = selected.indexOf(c.name);
      const r = Math.round(4.5 + 9 * Math.sqrt((c.pop ?? 1) / 27.4));
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [c.lon, c.lat] },
        properties: {
          name: c.name,
          r,
          fill: colorFor(m, v) ?? '#ffffff',
          hasValue: v != null,
          selected: i >= 0,
          ring: i >= 0 ? CITY_COLORS[i] : '#ffffff',
          // Label selected cities and the big metros so the map stays readable.
          label: i >= 0 || (c.pop ?? 0) >= 10 ? c.name : '',
          valueText: fmt(v, m.decimals, m.unit),
        },
      };
    }),
  };
}

export default function MapView({ selected, metric, onToggle, sidebarOpen, onToggleSidebar }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const toggleRef = useRef(onToggle);
  toggleRef.current = onToggle;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [legendOpen, setLegendOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!container.current) return;
    const map = new MLMap({
      container: container.current,
      style: STYLE_URL,
      bounds: INDIA_BOUNDS,
      fitBoundsOptions: { padding: 24 },
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    mapRef.current = map;

    map.on('error', (e: ErrorEvent) => {
      if (!map.isStyleLoaded()) setFailed(true);
      console.warn('map error', e.error?.message);
    });

    map.on('load', () => {
      // Our city dots carry their own labels; hide the basemap's settlement labels until
      // zoom 7 so names aren't drawn twice at the national view.
      for (const id of ['label_city', 'label_city_capital', 'label_town', 'label_village', 'label_other']) {
        if (map.getLayer(id)) map.setLayerZoomRange(id, 7, 24);
      }
      map.addSource('cities', { type: 'geojson', data: features([], 'bpm') });
      map.addLayer({
        id: 'city-ring',
        type: 'circle',
        source: 'cities',
        filter: ['==', ['get', 'selected'], true],
        paint: {
          'circle-radius': ['+', ['get', 'r'], 6],
          'circle-color': ['get', 'ring'],
          'circle-stroke-color': NAVY,
          'circle-stroke-width': 1,
        },
      });
      map.addLayer({
        id: 'city-dot',
        type: 'circle',
        source: 'cities',
        paint: {
          'circle-radius': ['get', 'r'],
          'circle-color': ['get', 'fill'],
          'circle-stroke-color': ['case', ['get', 'hasValue'], NAVY, '#8d92a4'],
          'circle-stroke-width': ['case', ['get', 'selected'], 2, 1],
        },
      });
      // Label sits just right of the dot: radial offset (in ems) scales with the dot's radius.
      const labelLayout: SymbolLayerSpecification['layout'] = {
        'text-field': ['get', 'name'],
        'text-size': 12,
        'text-variable-anchor': ['left'],
        'text-radial-offset': ['+', ['/', ['get', 'r'], 12], 0.35],
      };
      const labelPaint = { 'text-color': NAVY, 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 };
      // Big metros: labelled when there is room.
      map.addLayer({
        id: 'city-label',
        type: 'symbol',
        source: 'cities',
        filter: ['all', ['!', ['get', 'selected']], ['!=', ['get', 'label'], '']],
        layout: { ...labelLayout, 'text-font': ['Noto Sans Regular'] },
        paint: labelPaint,
      });
      // Compared cities: always labelled, in bold.
      map.addLayer({
        id: 'city-label-selected',
        type: 'symbol',
        source: 'cities',
        filter: ['==', ['get', 'selected'], true],
        layout: { ...labelLayout, 'text-font': ['Noto Sans Bold'], 'text-allow-overlap': true, 'text-ignore-placement': true },
        paint: labelPaint,
      });

      const popup = new Popup({ closeButton: false, closeOnClick: false, offset: 12, className: 'shift-popup' });
      map.on('mouseenter', 'city-dot', (e: MapLayerMouseEvent) => {
        map.getCanvas().style.cursor = 'pointer';
        const f = e.features?.[0];
        if (!f) return;
        const el = document.createElement('div');
        const name = document.createElement('strong');
        name.textContent = String(f.properties.name);
        const val = document.createElement('span');
        val.textContent = ` · ${f.properties.valueText}`;
        const hint = document.createElement('div');
        hint.textContent = f.properties.selected ? 'Click to remove from comparison' : 'Click to compare';
        el.append(name, val, hint);
        popup.setLngLat((f.geometry as Point).coordinates as [number, number]).setDOMContent(el).addTo(map);
      });
      map.on('mouseleave', 'city-dot', () => {
        map.getCanvas().style.cursor = '';
        popup.remove();
      });
      map.on('click', 'city-dot', (e: MapLayerMouseEvent) => {
        const name = e.features?.[0]?.properties.name;
        if (name) toggleRef.current(String(name));
        popup.remove();
      });
      setReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const src = mapRef.current?.getSource('cities') as GeoJSONSource | undefined;
    if (ready && src) src.setData(features(selected, metric));
  }, [ready, selected, metric]);

  useEffect(() => {
    // The map container changes width when the sidebar opens or closes.
    const t = setTimeout(() => mapRef.current?.resize(), 0);
    return () => clearTimeout(t);
  }, [sidebarOpen]);

  const m = METRICS[metric];
  const ctrl = 'flex h-8 w-8 items-center justify-center bg-white text-navy-500 hover:bg-navy-200';

  return (
    <section aria-label="Map of SHIFT cities" class="relative h-full min-h-[55vh] w-full overflow-hidden bg-[#e5eef7] lg:min-h-0">
      {/* MapLibre's CSS forces position: relative on this element, so size it explicitly. */}
      <div ref={container} class="absolute inset-0 h-full w-full" />

      {failed && (
        <p role="status" class="absolute top-4 left-4 z-10 max-w-xs bg-white p-3 text-sm shadow">
          The basemap couldn’t load. City data is still available in the sidebar and the Cities tab.
        </p>
      )}

      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        aria-expanded={sidebarOpen}
        class="absolute bottom-16 left-0 z-10 hidden h-8 w-8 items-center justify-center bg-navy-500 hover:bg-navy-400 lg:flex"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#fff" stroke-width="1.6" aria-hidden="true" class={sidebarOpen ? '' : 'rotate-180'}>
          <path d="M8 1L3 6l5 5" />
        </svg>
      </button>

      <div class="absolute top-6 right-6 z-10 flex flex-col items-end gap-10">
        <div class="relative">
          <button type="button" class={ctrl} aria-label="Menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path d="M2 4h12M2 8h12M2 12h12" />
            </svg>
          </button>
          {menuOpen && (
            <nav aria-label="Site" class="absolute top-10 right-0 flex w-64 flex-col gap-3 bg-navy-500 p-6 font-display text-xl text-white">
              <a href={BASE} class="text-white no-underline hover:underline">
                Home
              </a>
              <a href={`${BASE}#how`} class="text-white no-underline hover:underline">
                The story
              </a>
              <a href={`${BASE}map`} aria-current="page" class="text-white underline underline-offset-4">
                Explore map
              </a>
            </nav>
          )}
        </div>
        <div class="flex flex-col gap-0.5">
          <button type="button" class={ctrl} aria-label="Zoom in" onClick={() => mapRef.current?.zoomIn()}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path d="M8 2v12M2 8h12" />
            </svg>
          </button>
          <button type="button" class={ctrl} aria-label="Zoom out" onClick={() => mapRef.current?.zoomOut()}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path d="M2 8h12" />
            </svg>
          </button>
          <button type="button" class={ctrl} aria-label="Show all of India" onClick={() => mapRef.current?.fitBounds(INDIA_BOUNDS, { padding: 24 })}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <circle cx="8" cy="8" r="5" />
              <path d="M8 1v3M8 12v3M1 8h3M12 8h3" />
            </svg>
          </button>
        </div>
      </div>

      <div class="absolute right-6 bottom-12 z-10 w-[300px] max-w-[calc(100%-48px)] border border-navy-200 bg-white">
        <div class="flex items-start justify-between gap-4 p-2.5">
          <span class="text-base leading-[22px] font-semibold">{m.title}</span>
          <button
            type="button"
            class="flex h-6 w-6 shrink-0 items-center justify-center"
            aria-label={legendOpen ? 'Collapse legend' : 'Expand legend'}
            aria-expanded={legendOpen}
            onClick={() => setLegendOpen(!legendOpen)}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" class={legendOpen ? 'rotate-180' : ''}>
              <path d="M1 3l4 4 4-4" />
            </svg>
          </button>
        </div>
        {legendOpen && (
          <div class="flex flex-col gap-2.5 px-2.5 pb-2.5">
            <div class="grid grid-cols-5">
              {m.ramp.map((c, i) => (
                <div key={c} class="flex flex-col gap-1">
                  <span class="-mr-px h-2.5 border border-navy-500" style={{ background: c }} />
                  <span class="text-xxs leading-3 font-bold">{m.labels[i]}</span>
                </div>
              ))}
            </div>
            <div class="flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-light">
              <span class="flex items-center gap-1.5">
                <span class="h-2.5 w-2.5 rounded-full border border-navy-400 bg-white" />
                No data
              </span>
              <span class="flex items-center gap-1.5">
                <span class="h-2.5 w-2.5 rounded-full border border-navy-500" />
                Size shows population
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
