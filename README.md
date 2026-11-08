# shift-cookbook
an open community cookbook for all things transport related, inspired by wri shift transport hub

## What's here

| Path | What it is |
|---|---|
| `docs/spec/PRD.md` | Product spec: static cookbook, MapLibre map with an in-browser SLM, and an MCP endpoint for Claude and ChatGPT |
| `web/` | The website (Astro, static output for GitHub Pages). Currently the landing page. |
| `.github/workflows/deploy-pages.yml` | Builds `web/` on pull requests and deploys it to GitHub Pages from `main` |

## Landing page

The landing page retells WRI India's StoryMap [“Streets That Move Cities”](https://storymaps.arcgis.com/stories/af65c76c19f34309b0d0e7b586fa2bcf), which the SHIFT Transport Analytics Hub embeds on its City Stories page. Layout and design tokens follow the Foodscapes site by Vizzuality and The Nature Conservancy.

- Charts are rendered to static HTML at build time from `web/src/data/story.ts`, so the page ships no JavaScript.
- Chart figures come from the SHIFT charts embedded in the story (peak-hour travel time race, road width share). Where the story's text and its chart disagree (Pune and Mumbai peak speeds), the page follows the chart.
- Photos and maps belong to WRI India and are linked from ArcGIS, not copied into this repository.

### Run it locally

Requires Node 22.23.4 or newer.

```bash
cd web
npm ci
npm run dev
```

`npm run build` type-checks and writes the static site to `web/dist/`. Set `BASE_PATH=/` and `SITE_URL=<your domain>` when deploying anywhere other than `https://gv2325.github.io/shift-cookbook/`.

### Deploying

In the repository's Settings → Pages, set **Source** to **GitHub Actions**. Each push to `main` that touches `web/` then publishes the site.
