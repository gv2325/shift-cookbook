import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import preact from '@astrojs/preact';

// Production runs on Render as a static site served from the domain root.
// SITE_URL sets canonical and Open Graph URLs; Render's RENDER_EXTERNAL_URL is the fallback.
// BASE_PATH is only needed when serving from a sub-path (e.g. a GitHub Pages project site).
const site = process.env.SITE_URL ?? process.env.RENDER_EXTERNAL_URL ?? 'http://localhost:4321';

export default defineConfig({
  site,
  base: process.env.BASE_PATH ?? '/',
  trailingSlash: 'ignore',
  integrations: [preact()],
  build: {
    format: 'directory',
  },
  vite: {
    plugins: [tailwindcss()],
    // Keep scripts as external files so the Content-Security-Policy can use script-src 'self'.
    build: { assetsInlineLimit: 0 },
  },
});
