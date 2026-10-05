/**
 * Verification entry point.
 *
 * Bundled for Node by `rsbuild.verify.config.ts`, then executed by
 * `scripts/verify-export.mjs`. It runs the real generator so the checks apply to
 * real output rather than to a reimplementation of it.
 */

import {
  checkContract,
  DEFAULT_EXPORT_OPTIONS,
  paletteToCss,
  paletteToJson,
  paletteToTailwind,
  type ExportOptions,
  type ScopeKind,
} from '@/color/css-vars';
import { invariantToCss, invariantTokens, reducedMotionCss } from '@/color/invariant';
import { hexContrast, readableInkHex } from '@/color/color';
import { buildPalette, type Swatch } from '@/color/palette';
import { AA_TEXT, buildTheme, ROLE_TOKENS, type ThemeResult } from '@/color/theme';

const enforce = { enforceContrast: true };

/** Build the accents the way `deriveScheme` does, so the output is realistic. */
function generate(baseHex: string, rule: Parameters<typeof buildPalette>[1], colorCount: number) {
  const palette = buildPalette(baseHex, rule, colorCount);
  const swatches = palette.swatches.map((swatch) => swatch.oklch);

  const accents = palette.swatches.map((swatch: Swatch, index: number) => ({
    swatch,
    light: buildTheme({ swatches, dominant: index }, 'light', enforce),
    dark: buildTheme({ swatches, dominant: index }, 'dark', enforce),
  }));

  return { palette, accents, label: `${swatchName(palette.swatches[0])} ${rule}` };
}

const swatchName = (swatch: Swatch | undefined): string => swatch?.name ?? 'color';

/** Every scope, for one palette. */
function byScope(
  built: ReturnType<typeof generate>,
  format: ExportOptions['format'],
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const scope of ['global', 'class', 'attribute'] as const) {
    const options: ExportOptions = { ...DEFAULT_EXPORT_OPTIONS, format, scope: scope as ScopeKind };
    const input = { ...built, options };
    result[scope] = format === 'tailwind' ? paletteToTailwind(input) : paletteToCss(input);
  }

  return result;
}

/* Palettes chosen to hit the awkward paths: grayscale bases, black and white
   bases with no hue of their own, a rule wider than the color count and a color
   count wider than the rule. */
const SAMPLES = [
  { name: 'triadic-4', base: '#3b6ef5', rule: 'triadic', count: 4 },
  { name: 'analogous-3', base: '#1f7a5c', rule: 'analogous', count: 3 },
  { name: 'square-8', base: '#d94f2c', rule: 'square', count: 8 },
  { name: 'complementary-2', base: '#cccccc', rule: 'complementary', count: 2 },
  { name: 'monochromatic-7', base: '#000000', rule: 'monochromatic', count: 7 },
  { name: 'rainbow-5', base: '#ffffff', rule: 'rainbow', count: 5 },
] as const;

const built = SAMPLES.map((sample) => ({
  name: sample.name,
  byScope: byScope(generate(sample.base, sample.rule, sample.count), 'css'),
}));

const tailwindInput = (() => {
  const builtOne = generate('#3b6ef5', 'triadic', 4);
  return {
    ...builtOne,
    options: { ...DEFAULT_EXPORT_OPTIONS, format: 'tailwind' as const },
  };
})();

/* A stylesheet that satisfies the contract, built from the real export. */
const completeCss = paletteToCss(tailwindInput as Parameters<typeof paletteToCss>[0] as never);
const complete = completeCss;
const partialResult = checkContract(':root { --surface: #fff; --text-body: #111; }');

/*
 * Direct solver probe.
 *
 * The panel audit cannot see this: it checks pairs of tokens, not the pair a
 * component ends up rendering. Two shipped bugs came from that gap, so the
 * solver's own guarantee is asserted here over a sweep of hues and both tones.
 */
const solverProbe = (() => {
  const pairs: Array<[string, string]> = [    ['text-strong', 'surface'],
    ['text-strong', 'surface-sunken'],
    ['text-body', 'surface'],
    ['text-body', 'surface-raised'],
    ['text-body', 'surface-sunken'],
    ['text-muted', 'surface'],
    ['text-muted', 'surface-raised'],
    ['text-muted', 'surface-sunken'],
  ];

  const failures: Array<Record<string, unknown>> = [];

  /*
   * Real production path: a sweep of base colors and rules, every generated
   * palette, every dominant index, both tones. Synthetic swatches hid a real
   * failure, because the inputs that reach `buildTheme` come from `buildPalette`.
   */
  const BASES = [
    '#8b5cf6', '#d4a017', '#1f7a5c', '#e0623c', '#0f9b8e', '#cccccc',
    '#000000', '#ffffff', '#3b6ef5', '#2b2d42', '#ff0080', '#7fff00',
  ];
  const RULES = [
    'analogous', 'complementary', 'split-complementary', 'triadic',
    'tetradic', 'square', 'monochromatic', 'rainbow',
  ] as const;

  let checked = 0;

  for (const base of BASES) {
    for (const rule of RULES) {
      for (const count of [2, 3, 5, 8]) {
        const palette = buildPalette(base, rule, count);
        const swatches = palette.swatches.map((entry) => entry.oklch);

        for (let dominant = 0; dominant < swatches.length; dominant += 1) {
          for (const variant of ['light', 'dark'] as const) {
            const result = buildTheme({ swatches, dominant }, variant, enforce);

            for (const [fg, bg] of pairs) {
              checked += 1;
              /*
               * Measure the hex the stylesheet will actually emit, not the
               * in-memory color. That gap is exactly how an unreadable muted text
               * token shipped: it passed on floats and failed after rounding.
               */
              const ratio = hexContrast(result.theme[fg], result.theme[bg]);
              if (ratio < AA_TEXT) {
                failures.push({
                  base,
                  rule,
                  count,
                  dominant,
                  variant,
                  pair: `${fg} on ${bg}`,
                  ratio: Number(ratio.toFixed(3)),
                  muted: result.theme[fg],
                  bg: result.theme[bg],
                });
              }
            }
          }
        }
      }
    }
  }

  /*
   * Ink probe: every swatch in every generated palette must get an ink that
   * clears AA. This is the pair that the panel preview and the palette strip
   * paint, and choosing the walk direction by comparing two "nice" inks instead of
   * the two extremes left several swatches below target.
   */
  const inkFailures: Array<Record<string, unknown>> = [];
  let inkChecked = 0;

  for (const base of BASES) {
    for (const rule of RULES) {
      for (const count of [2, 4, 8]) {
        const palette = buildPalette(base, rule, count);

        for (const swatch of palette.swatches) {
          inkChecked += 1;
          const ink = readableInkHex(swatch.hex);
          const ratio = hexContrast(ink, swatch.hex);
          if (ratio < 4.5) {
            inkFailures.push({
              base,
              rule,
              count,
              swatch: swatch.hex,
              ink,
              ratio: Number(ratio.toFixed(3)),
            });
          }
        }
      }
    }
  }

  // The neutrals are always assignable in the UI, so they need an ink too.
  for (const neutral of ['#ffffff', '#000000']) {
    inkChecked += 1;
    const ink = readableInkHex(neutral);
    const ratio = hexContrast(ink, neutral);
    if (ratio < 4.5) {
      inkFailures.push({ swatch: neutral, ink, ratio: Number(ratio.toFixed(3)) });
    }
  }

  return { checked, failures, inkChecked, inkFailures };
})();

process.stdout.write(
  JSON.stringify({
    invariantCss: invariantToCss('  '),
    invariantCount: invariantTokens.length,
    reducedMotion: reducedMotionCss,
    samples: built,
    tailwind: paletteToTailwind(tailwindInput as Parameters<typeof paletteToTailwind>[0]),
    json: paletteToJson({
      ...generate('#3b6ef5', 'triadic', 4),
      options: DEFAULT_EXPORT_OPTIONS,
    }),
    contract: {
      complete,
      result: checkContract(complete),
      partialResult,
    },
    roles: ROLE_TOKENS,
    solverProbe,
  }),
);

// Keep the theme type referenced so an unused-import lint cannot hide a real change.
export type { ThemeResult };