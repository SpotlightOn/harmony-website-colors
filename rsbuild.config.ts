import path from 'node:path';
import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

/*
 * Where the built site is served from.
 *
 * GitHub Pages for a project repository serves it under `/<repo>/`, so absolute
 * asset paths like `/static/js/index.js` 404 there. The workflow passes
 * `BASE_PATH=/<repo>/`; locally the default of `/` keeps `pnpm dev` and
 * `pnpm preview` behaving like a normal root deployment.
 *
 * The trailing slash matters. `publicPath` is a prefix, not a directory, and a
 * value without the slash resolves the last segment as a file name.
 */
const base = process.env.BASE_PATH ?? '/';

if (!base.startsWith('/') || !base.endsWith('/')) {
  throw new Error(`BASE_PATH must start and end with a slash, got "${base}"`);
}

export default defineConfig({
  plugins: [pluginReact()],
  source: {
    entry: {
      index: './src/main.tsx',
    },
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
    },
  },
  html: {
    title: 'Harmony — Website Color Scheme Generator',
    meta: {
      description:
        'Explore classic color harmony rules and see them applied to a real website layout through design-neutral custom properties and WCAG-aware theming.',
      'color-scheme': 'dark light',
    },
  },
  server: {
    port: 3000,
  },
  output: {
    /*
     * Maps are still emitted for local debugging, but without the
     * `sourceMappingURL` comment, so a browser never requests them. Do not point
     * a CDN at `dist` if the maps are not wanted there either.
     */
    sourceMap: { js: 'hidden-source-map' },
    assetPrefix: base,
  },
  performance: {
    chunkSplit: {
      strategy: 'split-by-experience',
    },
  },
});