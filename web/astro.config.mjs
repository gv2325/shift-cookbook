import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// Served from GitHub Pages at https://gv2325.github.io/shift-cookbook/.
// Override with SITE_URL / BASE_PATH when deploying elsewhere (e.g. a custom domain).
export default defineConfig({
  site: process.env.SITE_URL ?? 'https://gv2325.github.io',
  base: process.env.BASE_PATH ?? '/shift-cookbook',
  trailingSlash: 'ignore',
  vite: {
    plugins: [tailwindcss()],
  },
});
