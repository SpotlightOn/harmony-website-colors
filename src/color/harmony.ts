/**
 * Classic color harmony rules.
 *
 * Every rule is expressed as an ordered list of stops relative to the base hue.
 * A stop is a hue rotation plus a lightness shift and a chroma multiplier, which
 * is all that is needed to describe both hue-based harmonies (triadic) and
 * tone-based harmonies (monochromatic) with one data structure.
 */

export type HarmonyRuleId =
  | 'complementary'
  | 'split-complementary'
  | 'analogous'
  | 'triadic'
  | 'tetradic'
  | 'square'
  | 'monochromatic'
  | 'rainbow';

export interface HarmonyStop {
  /** Hue rotation relative to the base hue, in degrees. */
  hueOffset: number;
  /** Lightness shift relative to the base lightness, in OKLCH lightness units. */
  lightnessShift: number;
  /** Multiplier applied to the base chroma. */
  chromaScale: number;
}

export interface HarmonyRule {
  id: HarmonyRuleId;
  /** Short name for the UI. */
  label: string;
  /** One line explaining what the rule does. */
  description: string;
  /** Hue angles the rule occupies, used to draw the harmony wheel preview. */
  hueOffsets: readonly number[];
  stops: readonly HarmonyStop[];
}

const hue = (hueOffset: number, lightnessShift = 0, chromaScale = 1): HarmonyStop => ({
  hueOffset,
  lightnessShift,
  chromaScale,
});

export const HARMONY_RULES: readonly HarmonyRule[] = [
  {
    id: 'analogous',
    label: 'Analogous',
    description: 'Neighbouring hues on the wheel. Calm and cohesive, good for hero sections.',
    hueOffsets: [-30, 0, 30],
    stops: [hue(-30, 0, 0.9), hue(0), hue(30, 0, 0.9)],
  },
  {
    id: 'complementary',
    label: 'Complementary',
    description: 'The hue opposite the base. Maximum contrast, energetic and polarizing.',
    hueOffsets: [0, 180],
    stops: [hue(0), hue(180, 0, 0.92)],
  },
  {
    id: 'split-complementary',
    label: 'Split complementary',
    description: 'The base plus the two hues flanking its opposite. Bolder than analogous, softer than a complement.',
    hueOffsets: [0, 150, 210],
    stops: [hue(0), hue(150, 0, 0.88), hue(210, 0, 0.88)],
  },
  {
    id: 'triadic',
    label: 'Triadic',
    description: 'Three hues spaced evenly around the wheel. Balanced and vivid.',
    hueOffsets: [0, 120, 240],
    stops: [hue(0), hue(120, 0, 0.88), hue(240, 0, 0.88)],
  },
  {
    id: 'tetradic',
    label: 'Tetradic',
    description: 'A rectangle on the wheel. Rich variety, but needs one dominant color.',
    hueOffsets: [0, 60, 180, 240],
    stops: [hue(0), hue(60, 0, 0.82), hue(180, 0, 0.88), hue(240, 0, 0.82)],
  },
  {
    id: 'square',
    label: 'Square',
    description: 'Four hues at even 90° spacing. Bold and balanced, harder to tame than tetradic.',
    hueOffsets: [0, 90, 180, 270],
    stops: [hue(0), hue(90, 0, 0.84), hue(180, 0, 0.88), hue(270, 0, 0.84)],
  },
  {
    id: 'monochromatic',
    label: 'Monochromatic',
    description: 'One hue stepped through tints and shades. Minimal, and the most accessible.',
    hueOffsets: [0],
    stops: [
      hue(0, 0, 1),
      hue(0, 0.16, 0.8),
      hue(0, -0.16, 1.14),
      hue(0, 0.3, 0.6),
      hue(0, -0.3, 1.26),
    ],
  },
  {
    id: 'rainbow',
    label: 'Rainbow',
    description: 'A full sweep of the spectrum. Lively, best reserved for playful interfaces.',
    hueOffsets: [0, 45, 90, 135, 180, 225, 270, 315],
    stops: [0, 45, 90, 135, 180, 225, 270, 315].map((offset, index) =>
      hue(offset, 0, index % 2 === 0 ? 0.92 : 0.8),
    ),
  },
];

const RULE_INDEX = new Map(HARMONY_RULES.map((rule) => [rule.id, rule]));

/** Look up a rule by id, falling back to the first rule for unknown input. */
export const getHarmonyRule = (id: HarmonyRuleId): HarmonyRule =>
  RULE_INDEX.get(id) ?? (HARMONY_RULES[0] as HarmonyRule);

/** True when the id is one of the known harmony rules. */
export const isHarmonyRuleId = (value: string): value is HarmonyRuleId =>
  RULE_INDEX.has(value as HarmonyRuleId);

/**
 * Lightness step applied when a palette needs more colors than the rule
 * defines. Cycling through the rule and shifting lightness keeps every extra
 * color recognisably related to its hue.
 */
const CYCLE_LIGHTNESS = 0.14;

/**
 * Resolve a rule into exactly `count` stops.
 *
 * Asking for fewer colors than the rule defines truncates the rule, keeping the
 * base hue first. Asking for more repeats the rule and separates the passes with
 * progressively larger lightness shifts.
 */
export function stopsForCount(rule: HarmonyRule, count: number): HarmonyStop[] {
  const total = Math.max(1, Math.floor(count));
  const base = rule.stops;
  const result: HarmonyStop[] = [];

  for (let index = 0; index < total; index += 1) {
    const stop = base[index % base.length] as HarmonyStop;
    const cycle = Math.floor(index / base.length);

    // Alternate the direction of the shift so repeats stay balanced around the
    // base lightness instead of drifting lighter with every pass.
    const direction = cycle === 0 ? 0 : cycle % 2 === 1 ? 1 : -1;
    const lightnessShift = stop.lightnessShift + direction * CYCLE_LIGHTNESS * cycle;

    result.push({
      hueOffset: stop.hueOffset,
      lightnessShift,
      chromaScale: cycle === 0 ? stop.chromaScale : stop.chromaScale * 0.78,
    });
  }

  return result;
}

/** A pleasing default color count for a rule: its full stop list, clamped to 2-8. */
export const defaultCountFor = (rule: HarmonyRule): number =>
  Math.min(8, Math.max(2, rule.stops.length));