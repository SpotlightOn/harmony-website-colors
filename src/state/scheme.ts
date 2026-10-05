/**
 * Scheme state and its derivation into palettes and themes.
 */

import {
  hueName,
  isHex,
  normalizeHex,
  oklchToRgb,
  rgbToHex,
  rgbToOklch,
  tonePrefix,
} from '@/color/color';
import { isHarmonyRuleId, type HarmonyRuleId } from '@/color/harmony';
import {
  buildPalette,
  describePalette,
  MAX_COLOR_COUNT,
  MIN_COLOR_COUNT,
  type Palette,
  type Swatch,
} from '@/color/palette';
import {
  buildTheme,
  ROLE_TOKENS,
  withTokenOverrides,
  type RoleToken,
  type ThemeResult,
  type Variant,
} from '@/color/theme';

export interface SchemeState {
  /** The seed color everything is derived from. */
  baseHex: string;
  ruleId: HarmonyRuleId;
  colorCount: number;
  /** When true, every derived role is pushed to meet its WCAG target. */
  enforceContrast: boolean;
  /**
   * Manual per-token edits, keyed by `accentIndex|variant|role`.
   *
   * These are deliberate user choices, so they are applied after the solver and
   * the contrast audit is re-run against them rather than being silently
   * corrected.
   */
  overrides: Record<string, string>;
  /**
   * Incremented on every shuffle. Consumers that want to re-run a transition,
   * such as the palette preview, can key off it.
   */
  seed: number;
}

/** Build the key for one manual override. */
export const overrideKey = (
  accentIndex: number,
  variant: Variant,
  role: RoleToken,
): string => `${accentIndex}|${variant}|${role}`;

/** How many entries in an override map, for the panel summary. */
export const overrideCount = (overrides: Record<string, string>): number =>
  Object.keys(overrides).length;

export const DEFAULT_SCHEME: SchemeState = {
  baseHex: '#3b6ef5',
  ruleId: 'triadic',
  colorCount: 5,
  enforceContrast: true,
  overrides: {},
  seed: 1,
};

/** One harmony color with a full light and dark theme derived from it. */
export interface AccentTheme {
  swatch: Swatch;
  light: ThemeResult;
  dark: ThemeResult;
}

/** One theme the demo page mounts, and therefore one theme the audit may edit. */
export interface SectionPlan {
  key: string;
  accentIndex: number;
  accent: AccentTheme;
  variant: Variant;
  /** 1-based. Doubles as the DOM anchor: `variant-3`. */
  position: number;
}

export interface DerivedScheme {
  palette: Palette;
  /** One entry per harmony color, in palette order. */
  accents: AccentTheme[];
  /**
   * Every theme the page renders, light and dark for every harmony color.
   *
   * This list is the contract between the page and the audit. The audit lets you
   * assign any role in any accent in either tone, so each of those combinations
   * needs exactly one rendered scope — otherwise an assignment lands in state that
   * nothing displays and the edit appears to do nothing. Deriving the plan once
   * here, instead of separately in the page, is what keeps the two from drifting
   * apart; the page had been rendering one tone per color while the audit offered
   * both, which silently swallowed half of all assignments.
   */
  sections: readonly SectionPlan[];
  primary: AccentTheme;
  /** The second harmony color, falling back to the first for two-color palettes. */
  secondary: AccentTheme;
  /** Short human label such as `Azure triadic`. */
  label: string;
  /** Label including the color count, used as the default name when saving. */
  fullName: string;
  /** True when every audited pair passes in both variants of every accent. */
  auditClean: boolean;
  /** Count of failing pairs, for the panel summary. */
  failures: number;
}

/**
 * Build one theme set for a given dominant palette entry.
 *
 * Every theme keeps the whole palette available; only the color that drives
 * surfaces, text and the primary accent rotates. That is what makes the harmony
 * visible inside each section instead of one section per color.
 */
function buildAccent(
  swatch: Swatch,
  palette: readonly Swatch[],
  dominant: number,
  enforceContrast: boolean,
  index: number,
  overrides: Record<string, string>,
): AccentTheme {
  const options = { enforceContrast };
  const input = { swatches: palette.map((entry) => entry.oklch), dominant };

  const pick = (variant: Variant) => {
    const theme = buildTheme(input, variant, options);
    const mine: Partial<Record<RoleToken, string>> = {};

    for (const token of ROLE_TOKENS) {
      const value = overrides[overrideKey(index, variant, token)];
      if (value !== undefined) {
        mine[token] = value;
      }
    }

    return Object.keys(mine).length > 0 ? withTokenOverrides(theme, mine) : theme;
  };

  return { swatch, light: pick('light'), dark: pick('dark') };
}

/**
 * Derive everything the UI needs from the raw scheme state.
 *
 * This is a pure function on purpose: it is the single place where a base color
 * becomes a palette, and a palette becomes themes. Memoizing its result is
 * enough to keep the demo page cheap while controls are being dragged.
 */
export function deriveScheme(state: SchemeState): DerivedScheme {
  const palette = buildPalette(state.baseHex, state.ruleId, state.colorCount);
  const accents = palette.swatches.map((swatch, index) =>
    buildAccent(
      swatch,
      palette.swatches,
      index,
      state.enforceContrast,
      index,
      state.overrides,
    ),
  );
  const base = rgbToOklch(palette.baseRgb);

  /*
   * Two sections per harmony color, light then dark, so the tones of one color sit
   * next to each other and can be compared directly.
   *
   * A two-color palette still gets a full page, hence the floor of two accents.
   */
  const accentCount = Math.max(2, accents.length);
  const sections: SectionPlan[] = Array.from({ length: accentCount }, (_, accentIndex) =>
    (['light', 'dark'] as const).map((variant, variantIndex) => {
      const accent = accents[accentIndex % accents.length] as AccentTheme;
      const position = accentIndex * 2 + variantIndex + 1;

      return {
        key: `${accentIndex}-${variant}`,
        accentIndex,
        accent,
        variant,
        position,
      };
    }),
  ).flat();

  const failures = accents.reduce(
    (total, accent) =>
      total +
      accent.light.checks.filter((check) => !check.pass).length +
      accent.dark.checks.filter((check) => !check.pass).length,
    0,
  );

  const baseName = `${tonePrefix(base.l)}${hueName(base)}`;

  return {
    palette,
    accents,
    sections,
    primary: accents[0] as AccentTheme,
    secondary: accents[1] ?? (accents[0] as AccentTheme),
    label: `${baseName} ${palette.rule.label.toLowerCase()}`,
    fullName: describePalette(palette, baseName),
    auditClean: failures === 0,
    failures,
  };
}

/** Clamp and repair a scheme that came from storage or a URL. */
export function sanitizeScheme(input: Partial<SchemeState>): SchemeState {
  return {
    baseHex: /^#[\da-f]{6}$/i.test(input.baseHex ?? '') ? (input.baseHex as string) : DEFAULT_SCHEME.baseHex,
    ruleId:
      input.ruleId && isHarmonyRuleId(input.ruleId) ? input.ruleId : DEFAULT_SCHEME.ruleId,
    colorCount: Math.min(
      MAX_COLOR_COUNT,
      Math.max(MIN_COLOR_COUNT, Math.round(input.colorCount ?? DEFAULT_SCHEME.colorCount)),
    ),
    enforceContrast:
      typeof input.enforceContrast === 'boolean'
        ? input.enforceContrast
        : DEFAULT_SCHEME.enforceContrast,
    overrides: sanitizeOverrides(input.overrides),
    seed: typeof input.seed === 'number' ? input.seed : DEFAULT_SCHEME.seed,
  };
}

/**
 * Keep only well-formed override entries.
 *
 * Storage and the URL are both untrusted input, and a malformed key would simply
 * never match anything rather than failing loudly.
 */
function sanitizeOverrides(input: unknown): Record<string, string> {
  if (typeof input !== 'object' || input === null) {
    return {};
  }

  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (/^\d+\|(light|dark)\|[a-z-]+$/.test(key) && typeof value === 'string' && isHex(value)) {
      result[key] = normalizeHex(value) as string;
    }
  }
  return result;
}

/**
 * A random but pleasant seed color.
 *
 * Saturation and lightness are drawn from narrow ranges on purpose. Fully
 * random OKLCH values produce neon or near-black results that make the demo look
 * broken rather than informative.
 */
export function randomBaseHex(): string {
  const hue = Math.random() * 360;
  const lightness = 0.46 + Math.random() * 0.26;
  const chroma = 0.1 + Math.random() * 0.11;

  return rgbToHex(oklchToRgb({ l: lightness, c: chroma, h: hue }));
}

/** A few hand-picked starting points, so the app looks good on first load. */
export const BASE_PRESETS: readonly string[] = [
  '#3b6ef5',
  '#0f9b8e',
  '#e0623c',
  '#8b5cf6',
  '#d4a017',
  '#2b2d42',
];

/** Re-exported for convenience in components. */
export type { Palette, Swatch, ThemeResult, Variant };