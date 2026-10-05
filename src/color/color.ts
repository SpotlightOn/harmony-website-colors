/**
 * Color primitives.
 *
 * Everything in this app is derived in the OKLCH color space, because OKLCH is
 * perceptually uniform: rotating the hue keeps perceived lightness steady, and
 * nudging lightness produces evenly stepped tints and shades. HSL fails at both,
 * which is exactly what a harmony generator needs.
 *
 * The conversion chain implemented here is the one published by Björn Ottosson
 * (oklab B-rev). It is short enough to inline, so the app ships with zero
 * runtime color dependencies.
 */

/** sRGB channels, each in the 0-255 range. */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/**
 * OKLCH components.
 *
 * - `l` — perceptual lightness, 0 (black) to 1 (white)
 * - `c` — chroma, roughly 0 to 0.4 for in-gamut sRGB
 * - `h` — hue angle in degrees, 0 to 360
 */
export interface Oklch {
  l: number;
  c: number;
  h: number;
}

/** sRGB channel with an alpha channel, 0 to 1. */
export interface Rgba extends Rgb {
  a: number;
}

export const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;

/** Wrap a hue angle into the [0, 360) range. */
export const normalizeHue = (hue: number): number => ((hue % 360) + 360) % 360;

const HEX_PATTERN = /^#?([\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i;

/** True when the input is a valid 3, 4, 6 or 8 digit hex color. */
export const isHex = (input: string): boolean => HEX_PATTERN.test(input.trim());

/**
 * Parse a hex color into RGB channels.
 *
 * Accepts `#abc`, `#abcd`, `#aabbcc` and `#aabbccdd`. The alpha channel is
 * parsed but intentionally discarded, because every color the app derives is
 * opaque; translucency is applied later through `withAlpha`.
 */
export function hexToRgb(input: string): Rgb {
  const match = HEX_PATTERN.exec(input.trim());
  if (!match) {
    throw new Error(`Invalid hex color: ${input}`);
  }

  let digits = match[1] as string;
  if (digits.length <= 4) {
    digits = digits
      .split('')
      .map((digit) => digit + digit)
      .join('');
  }

  return {
    r: Number.parseInt(digits.slice(0, 2), 16),
    g: Number.parseInt(digits.slice(2, 4), 16),
    b: Number.parseInt(digits.slice(4, 6), 16),
  };
}

/** Format RGB channels as a lowercase `#rrggbb` string. */
export const rgbToHex = ({ r, g, b }: Rgb): string =>
  `#${[r, g, b]
    .map((channel) => Math.round(clamp(channel, 0, 255)).toString(16).padStart(2, '0'))
    .join('')}`;

/** Format a color as a `rgb()` / `rgba()` string. */
export const rgba = ({ r, g, b, a }: Rgba): string =>
  a >= 1
    ? `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`
    : `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)} / ${round(a, 3)})`;

/** Round to a fixed number of decimals and drop trailing zeros. */
export function round(value: number, decimals = 4): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Normalize loose user input such as `f0a`, `#FF00AA` or `#ff00aa` into a
 * canonical `#rrggbb` string. Returns `null` when the input is not a hex color.
 */
export function normalizeHex(input: string): string | null {
  if (!isHex(input)) {
    return null;
  }
  return rgbToHex(hexToRgb(input));
}

/* ------------------------------------------------------------------ */
/* sRGB transfer function                                              */
/* ------------------------------------------------------------------ */

/** sRGB channel (0-1) to linear light (0-1). */
const toLinear = (channel: number): number =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

/** Linear light (0-1) to sRGB channel (0-1). */
const fromLinear = (channel: number): number =>
  channel <= 0.0031308
    ? channel * 12.92
    : 1.055 * Math.max(channel, 0) ** (1 / 2.4) - 0.055;

/* ------------------------------------------------------------------ */
/* OKLab / OKLCH                                                       */
/* ------------------------------------------------------------------ */

/** Convert sRGB channels to OKLCH. */
export function rgbToOklch(rgb: Rgb): Oklch {
  const r = toLinear(rgb.r / 255);
  const g = toLinear(rgb.g / 255);
  const b = toLinear(rgb.b / 255);

  const long = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const medium = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const short = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const l = 0.2104542553 * long + 0.793617785 * medium - 0.0040720468 * short;
  const a = 1.9779984951 * long - 2.428592205 * medium + 0.4505937099 * short;
  const bb = 0.0259040371 * long + 0.7827717662 * medium - 0.808675766 * short;

  const chroma = Math.hypot(a, bb);

  // Achromatic colors have an undefined hue. Keep it at 0 instead of emitting
  // NaN, and let callers substitute a hue when they need one.
  const hue = chroma < 1e-6 ? 0 : normalizeHue((Math.atan2(bb, a) * 180) / Math.PI);

  return { l, c: chroma, h: hue };
}

/** Convert OKLCH to unclamped linear-light sRGB, which may fall outside [0, 1]. */
function oklchToLinearRgb({ l, c, h }: Oklch): [number, number, number] {
  const radians = (h * Math.PI) / 180;
  const a = c * Math.cos(radians);
  const b = c * Math.sin(radians);

  const lPrime = l + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = l - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = l - 0.0894841775 * a - 1.291485548 * b;

  const lCubed = lPrime ** 3;
  const mCubed = mPrime ** 3;
  const sCubed = sPrime ** 3;

  return [
    4.0767416621 * lCubed - 3.3077115913 * mCubed + 0.2309699292 * sCubed,
    -1.2684380046 * lCubed + 2.6097574011 * mCubed - 0.3413193965 * sCubed,
    -0.0041960863 * lCubed - 0.7034186147 * mCubed + 1.707614701 * sCubed,
  ];
}

const GAMUT_EPSILON = 1e-4;

const isInGamut = ([r, g, b]: [number, number, number]): boolean =>
  r >= -GAMUT_EPSILON &&
  r <= 1 + GAMUT_EPSILON &&
  g >= -GAMUT_EPSILON &&
  g <= 1 + GAMUT_EPSILON &&
  b >= -GAMUT_EPSILON &&
  b <= 1 + GAMUT_EPSILON;

/**
 * Convert OKLCH to sRGB, reducing chroma until the color fits inside the sRGB
 * gamut. Hue and lightness are always preserved, so a slightly out-of-gamut
 * request degrades into a slightly less saturated color instead of a wrong one.
 */
export function oklchToRgb(color: Oklch): Rgb {
  const safe = { l: clamp(color.l, 0, 1), c: Math.max(color.c, 0), h: normalizeHue(color.h) };

  let low = 0;
  let high = safe.c;
  let linear = oklchToLinearRgb(safe);

  if (!isInGamut(linear)) {
    // Binary search the largest in-gamut chroma.
    for (let i = 0; i < 18; i += 1) {
      const mid = (low + high) / 2;
      if (isInGamut(oklchToLinearRgb({ ...safe, c: mid }))) {
        low = mid;
      } else {
        high = mid;
      }
    }
    linear = oklchToLinearRgb({ ...safe, c: low });
  }

  return {
    r: clamp(fromLinear(linear[0]) * 255, 0, 255),
    g: clamp(fromLinear(linear[1]) * 255, 0, 255),
    b: clamp(fromLinear(linear[2]) * 255, 0, 255),
  };
}

/* ------------------------------------------------------------------ */
/* WCAG contrast                                                       */
/* ------------------------------------------------------------------ */

/** WCAG 2.x relative luminance, 0 (black) to 1 (white). */
export const relativeLuminance = ({ r, g, b }: Rgb): number =>
  0.2126 * toLinear(r / 255) + 0.7152 * toLinear(g / 255) + 0.0722 * toLinear(b / 255);

/** WCAG 2.x contrast ratio between two opaque colors, 1 to 21. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const lighter = Math.max(relativeLuminance(a), relativeLuminance(b));
  const darker = Math.min(relativeLuminance(a), relativeLuminance(b));
  return (lighter + 0.05) / (darker + 0.05);
}

/** Contrast ratio between two hex colors. */
export const hexContrast = (a: string, b: string): number =>
  contrastRatio(hexToRgb(a), hexToRgb(b));

/**
 * Pick an ink that reads on a background, clearing the AA text threshold.
 *
 * Used where a raw harmony color becomes a surface, for example in the palette
 * strip. Choosing between a fixed dark and a fixed light ink is not enough: a
 * mid-tone swatch such as `#8c5df8` reaches only 4.17:1 against both, which is
 * below AA. So the ink is walked along the lightness axis until it clears.
 */
const LIGHT_INK: Rgb = { r: 255, g: 255, b: 255 };
const BLACK_INK: Rgb = { r: 0, g: 0, b: 0 };

export function readableInk(background: Rgb, minimum = 4.5): Rgb {
  /*
   * A small margin over the target: landing exactly on 4.5 rounds to 4.49 and
   * reads as a failure.
   */
  const target = minimum + 0.1;

  /*
   * Walk the ink towards whichever endpoint offers more contrast.
   *
   * The comparison has to be between the extremes themselves. Comparing two
   * "nice" inks instead is subtly wrong: a near-black sample scored worse than
   * white on a mid-dark red, so the walk headed towards white and could only get
   * worse from there. Between the extremes the crossover is at a background
   * luminance of about 0.179, which is exactly where the choice flips.
   */
  const towardsLight = contrastRatio(background, LIGHT_INK) > contrastRatio(background, BLACK_INK);

  let best: Rgb | null = null;
  let bestRatio = -1;

  for (let step = 0; step <= 200; step += 1) {
    const lightness = clamp(towardsLight ? 0.5 + step * 0.005 : 0.5 - step * 0.005, 0, 1);
    const raw = oklchToRgb({ l: lightness, c: 0, h: 0 });

    /*
     * Judge the quantized color. The return value is a hex that gets painted, so
     * a candidate that only clears the target on fractional channels does not
     * count — the same rounding gap that let a 4.48:1 muted token ship.
     */
    const candidate: Rgb = {
      r: Math.round(raw.r),
      g: Math.round(raw.g),
      b: Math.round(raw.b),
    };
    const ratio = contrastRatio(background, candidate);

    if (ratio >= target) {
      return candidate;
    }
    if (ratio > bestRatio) {
      best = candidate;
      bestRatio = ratio;
    }
  }

  return best ?? (towardsLight ? LIGHT_INK : BLACK_INK);
}

/** Same as `readableInk`, for hex inputs. Returns a `#rrggbb` string. */
/**
 * A light tint of `seed` that stays readable on every one of `backgrounds`.
 *
 * The WordPress theme this project exports for uses two "light" palette slots as
 * link and caption colors *on top of* its dark section fills. A saturated harmony
 * color cannot serve that role — measured, it landed at 1.30:1 — so the slot has to
 * be a genuine tint: same hue, lightness pushed up until it clears every background
 * it will be painted on.
 *
 * Chroma falls off as lightness rises, which is both how a tint looks and what keeps
 * the color inside sRGB. Holding chroma constant while walking to white produces
 * clipped, neon results.
 *
 * Candidates are judged quantized, for the same reason `readableInk` does.
 */
export function readableTint(seed: Rgb, backgrounds: readonly Rgb[], minimum = 4.5): Rgb {
  const target = minimum + 0.1;
  const origin = rgbToOklch(seed);

  let best: Rgb | null = null;
  let bestScore = -1;

  // Start a little above the seed so a seed that already passes still gets lighter
  // only as far as it must.
  for (let step = 0; step <= 100; step += 1) {
    const progress = step / 100;
    const lightness = clamp(origin.l + (1 - origin.l) * progress, 0, 1);

    // Fade toward neutral as it lightens, but never all the way: a tint with no
    // chroma stops being recognizably the same hue as the color it came from.
    const chroma = origin.c * (1 - progress * 0.55);

    const raw = oklchToRgb({ l: lightness, c: chroma, h: origin.h });
    const candidate: Rgb = {
      r: Math.round(raw.r),
      g: Math.round(raw.g),
      b: Math.round(raw.b),
    };

    const worst = backgrounds.reduce(
      (lowest, background) => Math.min(lowest, contrastRatio(background, candidate)),
      Number.POSITIVE_INFINITY,
    );

    if (worst >= target) {
      return candidate;
    }
    if (worst > bestScore) {
      best = candidate;
      bestScore = worst;
    }
  }

  return best ?? seed;
}

export function readableInkHex(background: string): string {
  try {
    return rgbToHex(readableInk(hexToRgb(background)));
  } catch {
    return '#ffffff';
  }
}

/** Format a contrast ratio for display, e.g. `4.62:1`. */
export const formatRatio = (ratio: number): string => `${round(ratio, 2)}:1`;

/** WCAG conformance level of a ratio, judged against the AA thresholds. */
export type WcagLevel = 'fail' | 'aa-large' | 'aa' | 'aaa';

export function wcagLevel(ratio: number): WcagLevel {
  if (ratio >= 7) return 'aaa';
  if (ratio >= 4.5) return 'aa';
  if (ratio >= 3) return 'aa-large';
  return 'fail';
}

/* ------------------------------------------------------------------ */
/* Naming                                                              */
/* ------------------------------------------------------------------ */

/** Deterministic hue names, used to label saved palettes. */
const HUE_NAMES: ReadonlyArray<readonly [string, number]> = [
  ['Red', 20],
  ['Vermilion', 45],
  ['Amber', 65],
  ['Gold', 90],
  ['Lime', 120],
  ['Green', 145],
  ['Emerald', 165],
  ['Teal', 190],
  ['Cyan', 215],
  ['Azure', 240],
  ['Blue', 255],
  ['Indigo', 280],
  ['Violet', 300],
  ['Purple', 315],
  ['Magenta', 335],
  ['Crimson', 355],
];

/**
 * Name a hue by its nearest reference hue. Grays and near-grays fall back to a
 * neutral name, because "Gray Azure" helps nobody.
 *
 * The result is a pure hue name with no lightness qualifier, so callers can add
 * their own tone prefix (see `buildPalette`).
 */
export function hueName(oklch: Oklch): string {
  if (oklch.c < 0.02) {
    return oklch.l < 0.2 ? 'Ink' : oklch.l > 0.88 ? 'Snow' : 'Slate';
  }

  let best = HUE_NAMES[0] as readonly [string, number];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const entry of HUE_NAMES) {
    const distance = Math.abs(((oklch.h - entry[1] + 540) % 360) - 180);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = entry;
    }
  }

  return best[0];
}

/** Lightness qualifier for a color, e.g. `Light` / `Deep` / `''`. */
export function tonePrefix(lightness: number): string {
  if (lightness >= 0.88) return 'Pale ';
  if (lightness >= 0.72) return 'Light ';
  if (lightness <= 0.3) return 'Deep ';
  if (lightness <= 0.45) return 'Dark ';
  return '';
}