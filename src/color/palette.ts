/**
 * Palette generation: base color plus a harmony rule plus a color count becomes a
 * list of swatches.
 */

import {
  clamp,
  hexToRgb,
  hueName,
  normalizeHex,
  normalizeHue,
  oklchToRgb,
  rgbToHex,
  rgbToOklch,
  type Oklch,
  type Rgb,
} from './color';
import {
  getHarmonyRule,
  stopsForCount,
  type HarmonyRule,
  type HarmonyRuleId,
} from './harmony';

export const MIN_COLOR_COUNT = 2;
export const MAX_COLOR_COUNT = 8;

export interface Swatch {
  /** Zero-based position in the palette. */
  index: number;
  /** Canonical `#rrggbb` value. */
  hex: string;
  rgb: Rgb;
  oklch: Oklch;
  /** Human readable name derived from hue and tone, e.g. `Light Blue`. */
  name: string;
}

export interface Palette {
  baseHex: string;
  baseRgb: Rgb;
  /** Base color after normalization: see `buildPalette`. */
  baseOklch: Oklch;
  rule: HarmonyRule;
  swatches: Swatch[];
}

/**
 * Lightness the generated swatches are pulled towards.
 *
 * A harmony built directly on the picked lightness is unusable for half of all
 * inputs: a near-white base yields five near-white swatches. Blending 30% of the
 * way towards a vivid mid lightness keeps the user's hue identity while keeping
 * every swatch usable as an accent.
 */
const VIVID_LIGHTNESS = 0.62;

/** Lightness bounds for generated swatches. */
const SWATCH_L_MIN = 0.3;
const SWATCH_L_MAX = 0.86;

/**
 * Qualify a swatch by how much lighter or darker it sits than the first pass of
 * its own hue.
 *
 * Two tiers per direction, so a monochromatic scheme where the same hue appears
 * five times still gets five distinguishable names.
 */
function toneLabel(delta: number): string {
  if (delta > 0.22) return 'Pale ';
  if (delta > 0.06) return 'Light ';
  if (delta < -0.22) return 'Deep ';
  if (delta < -0.06) return 'Dark ';
  return '';
}

/**
 * Deterministic hue for fully achromatic inputs.
 *
 * Black, white and every gray have no hue of their own. Rather than falling back
 * to a fixed hue for all of them, hash the hex string so `#808080` and `#7f7f7f`
 * get different, stable harmonies.
 */
function achromaticHue(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return normalizeHue((hash >>> 0) % 360);
}

/**
 * Build a palette.
 *
 * @param baseHex    Any hex color. It does not need to be in gamut-friendly form.
 * @param ruleId     Harmony rule to apply.
 * @param colorCount How many swatches to produce, clamped to 2-8.
 */
export function buildPalette(
  baseHex: string,
  ruleId: HarmonyRuleId,
  colorCount: number,
): Palette {
  const normalized = normalizeHex(baseHex) ?? '#3b82f6';
  const baseRgb = hexToRgb(normalized);
  const raw = rgbToOklch(baseRgb);

  const hueAngle = raw.c < 0.002 ? achromaticHue(normalized) : raw.h;

  // Pull towards vivid, but never flatten the user's own chroma completely.
  const lightness = clamp(
    raw.l + (VIVID_LIGHTNESS - raw.l) * 0.3,
    SWATCH_L_MIN,
    SWATCH_L_MAX,
  );
  const chroma = clamp(Math.max(raw.c, 0.06), 0, 0.22);

  const baseOklch: Oklch = { l: lightness, c: chroma, h: hueAngle };
  const rule = getHarmonyRule(ruleId);

  const count = clamp(Math.round(colorCount), MIN_COLOR_COUNT, MAX_COLOR_COUNT);
  const stops = stopsForCount(rule, count);

  /*
   * Lightness of the first pass for each hue.
   *
   * When a rule is cycled to reach a higher color count, later passes repeat the
   * same hues at a different lightness. Recording the first pass lets those later
   * passes be labelled relative to their own hue ("Blue" and "Light Blue")
   * rather than by an absolute threshold that a modest shift may not cross.
   */
  const firstLightness = new Map<number, number>();
  for (const stop of stops) {
    if (!firstLightness.has(stop.hueOffset)) {
      firstLightness.set(
        stop.hueOffset,
        clamp(lightness + stop.lightnessShift, SWATCH_L_MIN, SWATCH_L_MAX),
      );
    }
  }

  const swatches = stops.map((stop, index) => {
    const swatchLightness = clamp(lightness + stop.lightnessShift, SWATCH_L_MIN, SWATCH_L_MAX);
    const reference = firstLightness.get(stop.hueOffset) ?? swatchLightness;
    const tone = toneLabel(swatchLightness - reference);

    const oklch: Oklch = {
      l: swatchLightness,
      c: Math.max(chroma * stop.chromaScale, 0),
      h: normalizeHue(hueAngle + stop.hueOffset),
    };
    const rgb = oklchToRgb(oklch);

    return {
      index,
      hex: rgbToHex(rgb),
      rgb,
      oklch,
      name: `${tone}${hueName(oklch)}`,
    };
  });

  return { baseHex: normalized, baseRgb, baseOklch, rule, swatches };
}

/**
 * A short label such as `Azure triadic, 5 colors`, used as the default name for
 * saved palettes.
 */
export function describePalette(palette: Palette, baseName: string): string {
  const count = palette.swatches.length;
  return `${baseName} ${palette.rule.label.toLowerCase()}, ${count} ${count === 1 ? 'color' : 'colors'}`;
}