import path from 'node:path';
import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  source: {
    entry: { verify: './scripts/verify-entry.ts' },
    alias: { '@': path.resolve(process.cwd(), 'src') },
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  },
  output: {
    target: 'node',
    distPath: { root: '.verify' },
    sourceMap: false,
    minify: false,
  },
});
