/**
 * Base colors and rules every probe sweeps.
 *
 * Declared before the probes that read them: they run during module evaluation, so
 * a `const` below them lands in the temporal dead zone.
 *
 * The list deliberately includes the extremes — pure black and pure white, a
 * near-invisible gray, a fully saturated magenta. Mid-tone inputs all behave alike,
 * and the failures live at the edges.
 */
const BASES = [
  '#8b5cf6', '#d4a017', '#1f7a5c', '#e0623c', '#0f9b8e', '#cccccc',
  '#000000', '#ffffff', '#3b6ef5', '#2b2d42', '#ff0080', '#7fff00',
];
const RULES = [
  'analogous', 'complementary', 'split-complementary', 'triadic',
  'tetradic', 'square', 'monochromatic', 'rainbow',
] as const;

/**
 * Hex channels to the decimal triplet CSS `rgb()` needs.
 *
 * Comparing `#1f242e` as "1f 24 2e" against a shadow string that reads
 * "rgb(31 36 46)" fails for a reason that has nothing to do with the export, so this
 * converts properly.
 */
function hexToChannels(hex: string): string {
  return (hex.replace('#', '').match(/.{2}/g) ?? [])
    .map((pair) => String(Number.parseInt(pair, 16)))
    .join(' ');
}

/**
 * Foreground and background pairs the theme actually renders, read off the `styles`
 * block of the theme's own theme.json.
 *
 * An invented pair is worse than no check at all. `ink` on `brand` was one I added
 * on a hunch, and the theme never renders it — buttons put `base` on `brand`.
 * `ink-soft` is in the palette but only ever appears inside the `ink` gradient, so
 * testing it as body text would fail for no reason.
 */
const NOTOR_PAIRS: ReadonlyArray<readonly [string, string]> = [
  // Page text, captions, links and their states.
  ['ink', 'base'],
  ['muted', 'base'],
  ['brand', 'base'],
  ['brand-deep', 'base'],
  ['accent', 'base'],
  // Buttons: a base-filled label on the colored fill.
  ['base', 'brand'],
  ['base', 'brand-deep'],
  // Tinted section backgrounds.
  ['ink', 'brand-mist'],
  ['ink', 'surface'],
  ['ink', 'surface-deep'],
  // The section variations, where the fill is the section color itself.
  ['base', 'ink'],
  ['base', 'accent'],
  ['brand', 'base'],
  ['accent', 'base'],
  // Links and captions that use the light tints on dark section fills.
  ['brand-light', 'brand'],
  ['brand-light', 'ink'],
  ['accent-light', 'brand'],
  ['accent-light', 'ink'],
];

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
import {
  NOTOR_DUOTONE,
  NOTOR_GRADIENTS,
  NOTOR_PALETTE,
  serializeVariation,
  variationSlug,
  wordpressVariation,
} from '@/color/wordpress';
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
    wordpress: wordpressProbe(),
  }),
);

/**
 * WordPress variation probe.
 *
 * A style variation fails in ways a JSON check cannot see: a missing palette slug
 * leaves the theme's blocks pointing at the default color, a wrong `version` is
 * reinterpreted against an older schema, and a shadow preset that still carries the
 * previous ink is invisible in the file but obvious on the page. So this walks the
 * real export over every scheme and checks the structure, the slug coverage, and the
 * contrast of the pairs the theme actually renders.
 *
 * A declaration rather than a const so it is hoisted: the bundle calls it while the
 * module is still evaluating, and an arrow assigned to a `const` would not exist yet.
 */
function wordpressProbe() {
  const samples: Array<Record<string, unknown>> = [];
  const failures: Array<Record<string, unknown>> = [];
  const requiredPalette = new Set(NOTOR_PALETTE.map((entry) => entry.slug));
  const requiredGradients = new Set(NOTOR_GRADIENTS.map((entry) => entry.slug));
  const requiredDuotone = new Set(NOTOR_DUOTONE.map((entry) => entry.slug));

  let checked = 0;

  for (const base of BASES) {
    for (const rule of RULES) {
      for (const count of [2, 4, 8]) {
        const scheme = generate(base, rule, count);

        /*
         * Light only. The theme encodes absolute lightness in its sections, so a dark
         * palette is not a dark theme but a broken one — `brand-light` ends up a light
         * link color on the now-light `ink` section. Sweeping it here would only
         * report a failure the export deliberately avoids being able to produce.
         */
        {
          const theme = scheme.accents[0]?.light;

          if (!theme) {
            continue;
          }

          checked += 1;

          const title = `${base}-${rule}-${count}`;
          const variation = wordpressVariation(theme, { title });

          // Must survive a round trip as JSON, which is how WordPress reads it.
          const text = serializeVariation(variation);
          let parsed: typeof variation | null = null;

          try {
            parsed = JSON.parse(text) as typeof variation;
          } catch {
            failures.push({ base, rule, count, reason: 'not valid JSON' });
            continue;
          }

          if (parsed.version !== 3) {
            failures.push({ base, rule, count, reason: `version ${parsed.version}` });
          }
          if (!/^https:\/\/schemas\.wp\.org\//.test(parsed.$schema)) {
            failures.push({ base, rule, count, reason: `schema ${parsed.$schema}` });
          }

          const paletteSlugs = new Set(parsed.settings.color.palette.map((p) => p.slug));
          const gradientSlugs = new Set(parsed.settings.color.gradients.map((g) => g.slug));
          const duotoneSlugs = new Set(parsed.settings.color.duotone.map((d) => d.slug));

          for (const slug of requiredPalette) {
            if (!paletteSlugs.has(slug)) {
              failures.push({ base, rule, count, reason: `palette slug ${slug}` });
            }
          }
          for (const slug of requiredGradients) {
            if (!gradientSlugs.has(slug)) {
              failures.push({ base, rule, count, reason: `gradient slug ${slug}` });
            }
          }
          for (const slug of requiredDuotone) {
            if (!duotoneSlugs.has(slug)) {
              failures.push({ base, rule, count, reason: `duotone slug ${slug}` });
            }
          }

          // Every preset color has to be a hex value the stylesheet can actually use.
          const colors = parsed.settings.color.palette.map((p) => p.color);

          for (const color of colors) {
            if (!/^#[0-9a-f]{6}$/i.test(color)) {
              failures.push({ base, rule, count, reason: `palette color ${color}` });
            }
          }

          for (const gradient of parsed.settings.color.gradients) {
            const colorsInGradient = gradient.gradient.match(/#[0-9a-f]{6}/gi) ?? [];

            if (colorsInGradient.length !== NOTOR_GRADIENTS.find((g) => g.slug === gradient.slug)?.of.length) {
              failures.push({
                base,
                rule,
                count,
                reason: `gradient ${gradient.slug} has ${colorsInGradient.length} stops`,
              });
            }
          }

          /*
           * The pairs the theme actually paints, read off its own theme.json rather
           * than guessed. An invented pair is worse than no check: `ink` on `brand`
           * was one I added, and the theme never renders it — buttons put `base` on
           * `brand`. `ink-soft` is in the palette but only ever appears inside a
           * gradient, so checking it as body text would fail for no reason.
           *
           * Measured on the emitted hexes, same discipline as the CSS export.
           */
          const byslug = new Map(parsed.settings.color.palette.map((p) => [p.slug, p.color]));

          for (const [fg, bg] of NOTOR_PAIRS) {
            const fgColor = byslug.get(fg);
            const bgColor = byslug.get(bg);

            if (!fgColor || !bgColor) {
              failures.push({ base, rule, count, reason: `pair ${fg}/${bg} missing` });
              continue;
            }

            const ratio = hexContrast(fgColor, bgColor);

            if (ratio < 4.5) {
              failures.push({
                base,
                rule,
                count,
                reason: `${fg} on ${bg} is ${ratio.toFixed(2)}:1`,
              });
            }
          }

          // Shadows must be re-tinted, otherwise the old ink shows through.
          const ink = byslug.get('ink');
          const inkChannels = ink ? hexToChannels(ink) : undefined;

          for (const preset of parsed.settings.shadow.presets) {
            if (inkChannels && !preset.shadow.includes(inkChannels)) {
              failures.push({
                base,
                rule,
                count,
                reason: `shadow ${preset.slug} does not use the generated ink`,
              });
            }
          }

          if (checked === 1) {
            samples.push({ title, filename: `styles/${variationSlug(title)}.json`, json: text });
          }
        }
      }
    }
  }

  return {
    checked,
    failures,
    paletteSlugs: NOTOR_PALETTE.map((p) => p.slug),
    gradientSlugs: NOTOR_GRADIENTS.map((g) => g.slug),
    duotoneSlugs: NOTOR_DUOTONE.map((d) => d.slug),
    sample: samples[0],
  };
}

// Keep the theme type referenced so an unused-import lint cannot hide a real change.
export type { ThemeResult };