# shift-cookbook
an open community cookbook for all things transport related, inspired by wri shift transport hub

## What's here

| Path | What it is |
|---|---|
| `docs/spec/PRD.md` | Product spec: static cookbook, MapLibre map with an in-browser SLM, and an MCP endpoint for Claude and ChatGPT |
| `docs/architecture/system-design.md` | How the site and the MCP endpoint run on Render |
| `web/` | The website (Astro, static output): the landing page and the explore map at `/map` |
| `mcp/` | The MCP connector for Claude and ChatGPT (Node, stateless Streamable HTTP at `POST /mcp`) |
| `pipeline/shift_hub/` | Scripts that rebuild `web/src/data/cities.json` from the SHIFT hub's published bundle |
| `render.yaml` | Render Blueprint for the website (static site with security and cache headers) |
| `.github/workflows/web-ci.yml` | Type-checks and builds `web/` on pull requests; Render does the deploying |

## Landing page

The landing page retells WRI India's StoryMap [“Streets That Move Cities”](https://storymaps.arcgis.com/stories/af65c76c19f34309b0d0e7b586fa2bcf), which the SHIFT Transport Analytics Hub embeds on its City Stories page. Layout and design tokens follow the Foodscapes site by Vizzuality and The Nature Conservancy.

- Charts are rendered to static HTML at build time from `web/src/data/story.ts`, so the page ships no JavaScript.
- Chart figures come from the SHIFT charts embedded in the story (peak-hour travel time race, road width share). Where the story's text and its chart disagree (Pune and Mumbai peak speeds), the page follows the chart.
- Photos and maps belong to WRI India and are linked from ArcGIS, not copied into this repository.

## Explore map (`/map`)

A MapLibre map of the 20 Indian SHIFT cities with a Foodscapes-style sidebar: Transit, Modes, Traffic, Safety and Cities tabs, bar and line widgets, CSV download per widget, and a "show on map" switch that recolours the map.

- Click up to four cities on the map (or in the Cities tab) to compare them. The view is kept in the URL, e.g. `/map?cities=Pune,Delhi&tab=traffic&map=pm`, so any view can be shared.
- Basemap: OpenFreeMap's “positron” style (free, no API key). Tiles never pass through Render's bandwidth.
- Data: `web/src/data/cities.json`, extracted from the SHIFT hub (see `pipeline/shift_hub/`). Zeros there are shown as “no data”, and where SHIFT's two tables disagree, both values are listed under “Where SHIFT’s sources disagree”.
- The indicator logic in `web/src/lib/indicators.ts` has no UI code, so the planned MCP server can reuse it.
- India's boundary comes from OpenStreetMap via OpenFreeMap. An official Survey of India boundary is needed before publishing widely in India.

## MCP connector (`mcp/`) and the Connect page (`/connect`)

A public, read-only [MCP](https://modelcontextprotocol.io) server so Claude and ChatGPT can query the same data as the map. No sign-in.

- Endpoint: `https://shift-cookbook-mcp.onrender.com/mcp` (Streamable HTTP, stateless, JSON responses). `GET /healthz` reports status.
- Tools: `list_cities`, `list_indicators`, `get_indicator`, `compare_cities`, `get_map_link`, and `search` + `fetch` (the pair ChatGPT deep research needs). Every result carries `sources`, `caveats` (missing data, conflicting SHIFT figures, licence notes) and a `map_link`.
- It imports `web/src/lib/indicators.ts` and `web/src/data/cities.json` directly (bundled by esbuild), so the connector and the map can't drift apart.
- Guardrails: 60 requests per minute per IP, 64 KB request limit, 10 s timeout, Origin allowlist (requests without an Origin, i.e. server-to-server, are allowed). Logs hold the tool name, status, timing and a salted IP hash, never arguments.
- `/connect` on the website explains how to add it in Claude, ChatGPT and Claude Code, and offers the SHIFT skill to copy or download.

### Claude Code plugin and skill (`plugins/shift/`, `.claude-plugin/marketplace.json`)

This repository is also a Claude Code plugin marketplace. The `shift` plugin bundles the connector (`.mcp.json`) and the `shift-transport` skill, so one command links everything:

```text
/plugin install shift --marketplace gv2325/shift-cookbook
```

Older Claude Code versions: `claude plugin marketplace add gv2325/shift-cookbook`, then `claude plugin install shift@shift-cookbook`. Claude Code reads the marketplace from the repository's default branch.

`plugins/shift/skills/shift-transport/SKILL.md` is the single source for the skill: the website build (`web/scripts/build-skill.mjs`) copies it to `/downloads/SKILL.md` and zips it as `/downloads/shift-transport.zip` for Claude.ai (Customize → Skills → upload).

```bash
cd mcp
npm ci
npm run build   # type-check + bundle to dist/server.js
npm test        # starts the server and drives it with the official MCP client
MCP_URL=https://shift-cookbook-mcp.onrender.com/mcp npm test   # same tests against the deployed server
```

### Run it locally

Requires Node 22.23.4 or newer.

```bash
cd web
npm ci
npm run dev
```

`npm run build` type-checks and writes the static site to `web/dist/`. The site is served from the domain root. `SITE_URL` sets the canonical URL (on Render it falls back to `RENDER_EXTERNAL_URL`), and `BASE_PATH` is only needed for a sub-path host such as a GitHub Pages project site.

### Deploying to Render (project `wri`, environment `dev`)

The Blueprint in `render.yaml` defines one static site, `shift-cookbook-web`.

1. In Render, open **Blueprints → New Blueprint Instance**, pick `gv2325/shift-cookbook`, and choose the branch to deploy from (e.g. `landing-page-v1` now, `main` later). Render reads `render.yaml` and creates `shift-cookbook-web`.
2. Open the **wri** project → **dev** environment → **Add existing service**, and move `shift-cookbook-web` in. Later Blueprint syncs leave it there.
   - Alternative: create a static site named `shift-cookbook-web` inside wri › dev first; the Blueprint then syncs its settings onto that service.
3. The first deploy builds with Node 22.23.4 (`NODE_VERSION`) and publishes `web/dist`. Pull requests get preview sites (Pro plan), expiring after 7 days.
4. When a custom domain is attached, add it to the service and set `SITE_URL` in `render.yaml`.

Headers set by the Blueprint: a strict Content-Security-Policy (scripts from the site only; images also from `www.arcgis.com`, where the story photos live), `X-Frame-Options: DENY`, `nosniff`, a referrer policy, and one-year caching for hashed assets under `/_astro/`.
