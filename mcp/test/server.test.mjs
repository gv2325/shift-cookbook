// End-to-end tests: start dist/server.js and talk to it with the official MCP client.
// Run with: npm run build && npm test   (MCP_URL=https://… npm test runs against a deployed server)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const PORT = 18000 + Math.floor(Math.random() * 1000);
const REMOTE = process.env.MCP_URL;
const BASE = REMOTE ? REMOTE.replace(/\/mcp\/?$/, '') : `http://127.0.0.1:${PORT}`;
let proc;
let client;

before(async () => {
  if (!REMOTE) {
    proc = spawn(process.execPath, ['dist/server.js'], { env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'inherit'] });
    await new Promise((resolve, reject) => {
      proc.stdout.on('data', (d) => d.toString().includes('listening') && resolve());
      proc.on('exit', (c) => reject(new Error(`server exited ${c}`)));
    });
  }
  client = new Client({ name: 'shift-test', version: '0.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${BASE}/mcp`)));
});

after(async () => {
  await client?.close();
  proc?.kill();
});

const call = async (name, args = {}) => client.callTool({ name, arguments: args });

test('lists the seven read-only tools', async () => {
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), ['compare_cities', 'fetch', 'get_indicator', 'get_map_link', 'list_cities', 'list_indicators', 'search']);
  for (const t of tools) assert.equal(t.annotations?.readOnlyHint, true, `${t.name} is read-only`);
  assert.match(client.getInstructions() ?? '', /cite the "sources"/);
});

test('list_cities returns the 20 Indian cities', async () => {
  const r = await call('list_cities');
  assert.equal(r.structuredContent.cities.length, 20);
  assert.ok(r.structuredContent.cities.find((c) => c.name === 'Pune').indicators_with_data.includes('buses_per_million'));
});

test('get_indicator: value, sources and map link; old city names resolve', async () => {
  const r = await call('get_indicator', { city: 'Bangalore', indicator: 'buses_per_million' });
  assert.equal(r.structuredContent.city, 'Bengaluru');
  assert.equal(r.structuredContent.value, 471);
  assert.ok(r.structuredContent.sources.length >= 1);
  assert.match(r.structuredContent.map_link, /\/map\?cities=Bengaluru&tab=transit&map=bpm$/);
});

test('get_indicator: missing data is null with a caveat, never a guess', async () => {
  const r = await call('get_indicator', { city: 'Kanpur', indicator: 'buses_per_million' });
  assert.equal(r.structuredContent.value, null);
  assert.match(r.structuredContent.caveats.join(' '), /Not in SHIFT data/);
});

test('get_indicator: reports conflicting SHIFT figures', async () => {
  const r = await call('get_indicator', { city: 'Kochi', indicator: 'buses_per_million' });
  assert.match(r.structuredContent.caveats.join(' '), /disagree on bus fleet \(861 vs 99\)/);
});

test('compare_cities ranks highest first, keeps no-data cities last, carries the benchmark', async () => {
  const r = await call('compare_cities', { cities: ['Pune', 'Hyderabad', 'Kanpur', 'Chennai'], indicator: 'buses_per_million' });
  const s = r.structuredContent;
  assert.deepEqual(s.rows.map((x) => x.city), ['Hyderabad', 'Chennai', 'Pune', 'Kanpur']);
  assert.deepEqual(s.rows.map((x) => x.rank), [1, 2, 3, null]);
  assert.equal(s.benchmark.value, 600);
});

test('compare_cities accepts "all"', async () => {
  const r = await call('compare_cities', { cities: ['all'], indicator: 'road_deaths_per_million' });
  assert.equal(r.structuredContent.rows.length, 20);
  assert.equal(r.structuredContent.rows[0].city, 'Lucknow');
});

test('unknown city is a tool error with suggestions', async () => {
  const r = await call('get_indicator', { city: 'Puna', indicator: 'pt_coverage' });
  assert.equal(r.isError, true);
  assert.match(r.content[0].text, /Did you mean Pune/);
});

test('invalid arguments are rejected by schema validation', async () => {
  const r = await call('compare_cities', { cities: Array(11).fill('Pune'), indicator: 'buses_per_million' }).catch((e) => ({ thrown: e }));
  assert.ok(r.thrown || r.isError, 'more than 10 cities must fail');
});

test('search + fetch (ChatGPT deep research pair)', async () => {
  const s = await call('search', { query: 'Pune bus fleet' });
  assert.equal(JSON.parse(s.content[0].text).results[0].id, 'city:pune');
  const f = await call('fetch', { id: 'city:pune' });
  assert.match(f.structuredContent.text, /Buses per million residents: 144/);
  const story = await call('search', { query: 'road width secondary' });
  assert.ok(story.structuredContent.results.some((d) => d.id === 'story:streets-that-move-cities'));
});

test('get_map_link caps at four cities', async () => {
  const r = await call('get_map_link', { cities: ['Pune', 'Delhi'], indicator: 'evening_peak_speed' });
  assert.match(r.structuredContent.url, /cities=Pune,Delhi&tab=traffic&map=pm/);
});

test('HTTP: health check, GET /mcp is 405, foreign Origin is 403', async () => {
  const h = await fetch(`${BASE}/healthz`).then((r) => r.json());
  assert.equal(h.status, 'ok');
  assert.equal((await fetch(`${BASE}/mcp`)).status, 405);
  const bad = await fetch(`${BASE}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Origin: 'https://evil.example' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  });
  assert.equal(bad.status, 403);
});
