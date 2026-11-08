import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { DOCS, getDoc, searchDocs } from './corpus';
import {
  CITIES,
  INDICATOR_IDS,
  SITE_URL,
  SOURCE_NOTE,
  caveatsFor,
  decimalsOf,
  findCity,
  indicatorInfo,
  mapLink,
  round,
  valueOf,
  type City,
  type IndicatorId,
} from './data';

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

const INSTRUCTIONS = `SHIFT Cookbook: read-only transport data for 20 Indian cities (public transit, modal share, road traffic, road safety), from the SHIFT Transport Analytics Hub, plus WRI India's "Streets That Move Cities" story.
- Always cite the "sources" returned with a result, and mention any "caveats" (missing data, conflicting figures, licence notes).
- A null value means SHIFT has no figure for that city; say so instead of estimating.
- Offer the "map_link" so the user can see the result on the SHIFT map.
- Use search/fetch for city profiles, indicator rankings and the story text.`;

const text = (obj: unknown) => [{ type: 'text' as const, text: JSON.stringify(obj, null, 2) }];

function cityOrError(name: string): { city: City } | { error: ReturnType<typeof toolError> } {
  const r = findCity(name);
  if (r.city) return { city: r.city };
  return { error: toolError(`"${name}" is not one of the 20 SHIFT cities. Did you mean ${r.suggestions.join(', ')}? Call list_cities for the full list.`) };
}

function toolError(message: string) {
  return { isError: true, content: [{ type: 'text' as const, text: message }] };
}

const indicatorSchema = z.enum(INDICATOR_IDS).describe('Indicator id, from list_indicators.');
const sourceSchema = z.object({ title: z.string(), detail: z.string() });

export function buildServer(): McpServer {
  const server = new McpServer({ name: 'shift-cookbook', version: '0.1.0', title: 'SHIFT Cookbook' }, { instructions: INSTRUCTIONS });

  server.registerTool(
    'list_cities',
    {
      title: 'List SHIFT cities',
      description: 'List the 20 Indian cities in SHIFT, with population and which indicators have data for each.',
      inputSchema: {},
      outputSchema: {
        cities: z.array(z.object({ name: z.string(), population_millions: z.number().nullable(), indicators_with_data: z.array(z.string()) })),
        note: z.string(),
      },
      annotations: READ_ONLY,
    },
    async () => {
      const out = {
        cities: CITIES.map((c) => ({
          name: c.name,
          population_millions: round(c.pop, 2),
          indicators_with_data: INDICATOR_IDS.filter((id) => valueOf(c, id) != null),
        })),
        note: SOURCE_NOTE,
      };
      return { content: text(out), structuredContent: out };
    },
  );

  server.registerTool(
    'list_indicators',
    {
      title: 'List indicators',
      description: 'List the indicators available for comparison, with definitions, units, themes, sources and benchmarks.',
      inputSchema: {},
      outputSchema: {
        indicators: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            unit: z.string(),
            theme: z.string(),
            definition: z.string(),
            source: z.string(),
            benchmark: z.object({ value: z.number(), label: z.string() }).nullable(),
          }),
        ),
      },
      annotations: READ_ONLY,
    },
    async () => {
      const out = { indicators: INDICATOR_IDS.map(indicatorInfo) };
      return { content: text(out), structuredContent: out };
    },
  );

  server.registerTool(
    'get_indicator',
    {
      title: 'Get one indicator for one city',
      description: 'Get a single indicator value for one city, with its source, caveats and a link to the map.',
      inputSchema: { city: z.string().min(1).max(60).describe('City name, e.g. "Pune". Common old names like Bangalore work.'), indicator: indicatorSchema },
      outputSchema: {
        city: z.string(),
        indicator: z.string(),
        title: z.string(),
        value: z.number().nullable(),
        unit: z.string(),
        sources: z.array(sourceSchema),
        caveats: z.array(z.string()),
        map_link: z.string(),
      },
      annotations: READ_ONLY,
    },
    async ({ city, indicator }) => {
      const r = cityOrError(city);
      if ('error' in r) return r.error;
      const info = indicatorInfo(indicator);
      const out = {
        city: r.city.name,
        indicator,
        title: info.title,
        value: round(valueOf(r.city, indicator), decimalsOf(indicator)),
        unit: info.unit,
        sources: [
          { title: info.source, detail: info.definition },
          { title: 'SHIFT Transport Analytics Hub', detail: SOURCE_NOTE },
        ],
        caveats: caveatsFor(r.city, indicator),
        map_link: mapLink([r.city.name], indicator),
      };
      return { content: text(out), structuredContent: out };
    },
  );

  server.registerTool(
    'compare_cities',
    {
      title: 'Compare cities on an indicator',
      description: 'Rank several SHIFT cities on one indicator (highest first), with the benchmark where one exists, sources, caveats and a map link.',
      inputSchema: {
        cities: z.array(z.string().min(1).max(60)).min(1).max(10).describe('1 to 10 city names. Use ["all"] for every SHIFT city.'),
        indicator: indicatorSchema,
      },
      outputSchema: {
        indicator: z.string(),
        title: z.string(),
        unit: z.string(),
        benchmark: z.object({ value: z.number(), label: z.string() }).nullable(),
        rows: z.array(z.object({ rank: z.number().nullable(), city: z.string(), value: z.number().nullable() })),
        sources: z.array(sourceSchema),
        caveats: z.array(z.string()),
        map_link: z.string(),
      },
      annotations: READ_ONLY,
    },
    async ({ cities, indicator }) => {
      let list: City[];
      if (cities.length === 1 && cities[0].toLowerCase() === 'all') list = CITIES;
      else {
        list = [];
        for (const name of cities) {
          const r = cityOrError(name);
          if ('error' in r) return r.error;
          if (!list.includes(r.city)) list.push(r.city);
        }
      }
      const info = indicatorInfo(indicator);
      const d = decimalsOf(indicator);
      const withVal = list.map((c) => ({ city: c.name, value: round(valueOf(c, indicator), d) }));
      const ranked = withVal.filter((x) => x.value != null).sort((a, b) => (b.value as number) - (a.value as number));
      const rows = [...ranked.map((x, i) => ({ rank: i + 1, ...x })), ...withVal.filter((x) => x.value == null).map((x) => ({ rank: null, ...x }))];
      const out = {
        indicator,
        title: info.title,
        unit: info.unit,
        benchmark: info.benchmark,
        rows,
        sources: [
          { title: info.source, detail: info.definition },
          { title: 'SHIFT Transport Analytics Hub', detail: SOURCE_NOTE },
        ],
        caveats: list.flatMap((c) => caveatsFor(c, indicator)),
        map_link: mapLink(rows.slice(0, 4).map((r) => r.city), indicator),
      };
      return { content: text(out), structuredContent: out };
    },
  );

  server.registerTool(
    'get_map_link',
    {
      title: 'Link to the SHIFT map',
      description: 'Build a link that opens the SHIFT explore map comparing up to four cities, coloured by an indicator.',
      inputSchema: {
        cities: z.array(z.string().min(1).max(60)).max(4).default([]).describe('Up to four city names.'),
        indicator: indicatorSchema.optional(),
      },
      outputSchema: { url: z.string(), cities: z.array(z.string()) },
      annotations: READ_ONLY,
    },
    async ({ cities, indicator }) => {
      const names: string[] = [];
      for (const name of cities) {
        const r = cityOrError(name);
        if ('error' in r) return r.error;
        names.push(r.city.name);
      }
      const out = { url: mapLink(names, indicator), cities: names };
      return { content: text(out), structuredContent: out };
    },
  );

  // search + fetch: the pair ChatGPT deep research requires (results as JSON text).
  server.registerTool(
    'search',
    {
      title: 'Search SHIFT',
      description: 'Search SHIFT city profiles, indicator rankings and the "Streets That Move Cities" story. Returns ids to pass to fetch.',
      inputSchema: { query: z.string().min(1).max(200).describe('Keywords, e.g. "bus fleet Pune" or "road width"') },
      outputSchema: { results: z.array(z.object({ id: z.string(), title: z.string(), url: z.string() })) },
      annotations: READ_ONLY,
    },
    async ({ query }) => {
      const out = { results: searchDocs(query).map((d) => ({ id: d.id, title: d.title, url: d.url })) };
      return { content: text(out), structuredContent: out };
    },
  );

  server.registerTool(
    'fetch',
    {
      title: 'Fetch a SHIFT document',
      description: `Get the full text of a document returned by search (city profile, indicator ranking, or the story). ${DOCS.length} documents are available.`,
      inputSchema: { id: z.string().min(1).max(100).describe('A document id from search, e.g. "city:pune" or "indicator:buses_per_million".') },
      outputSchema: { id: z.string(), title: z.string(), text: z.string(), url: z.string(), metadata: z.record(z.string(), z.string()) },
      annotations: READ_ONLY,
    },
    async ({ id }) => {
      const d = getDoc(id);
      if (!d) return toolError(`No document "${id}". Use search to find document ids.`);
      return { content: text(d), structuredContent: d };
    },
  );

  return server;
}

export const SERVER_INFO = { site: SITE_URL, tools: 7 };
export type { IndicatorId };
