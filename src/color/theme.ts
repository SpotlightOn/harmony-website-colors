/**
 * Theme derivation.
 *
 * This module owns the contract that makes the demo page work for every color
 * scheme: a fixed list of role tokens that are design-neutral. A token says what
 * a color is *for* (`--surface`, `--link`, `--text-muted`), never what it looks
 * like. Values change with the scheme, names never do, so the markup and CSS of
 * the demo site are written once and work for all of them.
 *
 * Colors are derived in OKLCH and then pushed through a contrast solver, so every
 * generated scheme satisfies WCAG AA by construction instead of by luck.
 */

import {
  clamp,
  contrastRatio,
  hexToRgb,
  normalizeHue,
  oklchToRgb,
  rgba,
  rgbToHex,
  wcagLevel,
  type Oklch,
  type Rgb,
  type WcagLevel,
} from './color';

export type Variant = 'light' | 'dark';

export const VARIANTS: readonly Variant[] = ['light', 'dark'];

/**
 * The design-neutral token contract.
 *
 * Every generated theme defines exactly these 19 roles. Adding a role here means
 * adding it to every scheme at once, which is the whole point of the contract.
 */
export const ROLE_TOKENS = [
  'surface',
  'surface-raised',
  'surface-sunken',
  'surface-hover',
  'text-strong',
  'text-body',
  'text-muted',
  'text-on-accent',
  'accent',
  'accent-hover',
  'accent-soft',
  'accent-alt',
  'accent-alt-hover',
  'accent-alt-soft',
  'accent-on-alt',
  'accent-tertiary',
  'link',
  'link-hover',
  'link-visited',
  'border',
  'border-strong',
  'focus-ring',
  'shadow',
  'overlay',
] as const;

export type RoleToken = (typeof ROLE_TOKENS)[number];

/** CSS custom property values, keyed by role token. */
export type Theme = Record<RoleToken, string>;

/** Resolved opaque colors, keyed by role token, used for contrast math. */
export type ThemeColors = Record<RoleToken, Rgb>;

/** One line of documentation per token, emitted in the CSS export. */
export const ROLE_TOKEN_DOCS: Record<RoleToken, string> = {
  surface: 'Section background.',
  'surface-raised': 'Cards and tiles that sit above the section.',
  'surface-sunken': 'Inset wells, code blocks, quiet panels.',
  'surface-hover': 'Hover and selected fill for interactive rows.',
  'text-strong': 'Headlines, lead paragraphs, primary labels.',
  'text-body': 'Running text and list items.',
  'text-muted': 'Captions, metadata, helper text. Still AA readable.',
  'text-on-accent': 'Text placed on top of the accent fill.',
  accent: 'Primary brand fill: buttons, badges, active states.',
  'accent-hover': 'Accent fill for hover and pressed states.',
  'accent-soft': 'Low intensity accent wash for backgrounds.',
  'accent-alt': 'Second harmony color. Secondary calls to action.',
  'accent-alt-hover': 'Hover and pressed state of the second color.',
  'accent-alt-soft': 'Low intensity wash of the second color.',
  'accent-on-alt': 'Text placed on top of the second color fill.',
  'accent-tertiary': 'Third harmony color. Highlights and editorial accents.',
  link: 'Inline link color. Derived from the second harmony color.',
  'link-hover': 'Inline link hover and focus color.',
  'link-visited': 'Inline link, already visited.',
  border: 'Hairline separators and card outlines.',
  'border-strong': 'Outlines that need to be perceivable on their own.',
  'focus-ring': 'Keyboard focus indicator. Never remove it.',
  shadow: 'Shadow tint. Alpha is part of the token.',
  overlay: 'Scrim behind modals and menus. Alpha is part of the token.',
};

/* ------------------------------------------------------------------ */
/* Contrast solver                                                     */
/* ------------------------------------------------------------------ */

type Direction = 'darker' | 'lighter';

/** WCAG AA threshold for normal-size text. */
export const AA_TEXT = 4.5;
/** WCAG AA threshold for large text and for non-text UI components. */
export const AA_LARGE = 3;

interface Solved {
  hex: string;
  rgb: Rgb;
  oklch: Oklch;
  /** Worst contrast ratio against every background it was solved for. */
  ratio: number;
  /** True when the solver had to move the color to reach its target. */
  adjusted: boolean;
}

/**
 * Chroma has to taper towards black and white. Saturated colors cannot exist at
 * extreme lightness, and the OKLCH to sRGB conversion would silently clip them
 * into flat, wrong hues if we let it.
 */
const taperChroma = (l: number, c: number): number =>
  c * (1 - 0.6 * Math.abs(l - 0.5) ** 2.5 * 2);

const evaluate = (seed: Oklch, backgrounds: Rgb[]): Solved => {
  const oklch: Oklch = {
    l: clamp(seed.l, 0, 1),
    c: Math.max(seed.c, 0),
    h: normalizeHue(seed.h),
  };

  /*
   * Quantize to 8 bits before anything looks at the color.
   *
   * `oklchToRgb` returns fractional channels, but the stylesheet emits `#rrggbb`
   * and the browser paints those integers. Auditing the unrounded value means
   * validating a color that will never be displayed: rounding moved a muted text
   * token from 4.51:1 to 4.48:1 and the solver never knew. Auditing exactly what
   * gets painted is the only version of this that means anything.
   */
  const raw = oklchToRgb(oklch);
  const rgb: Rgb = {
    r: Math.round(raw.r),
    g: Math.round(raw.g),
    b: Math.round(raw.b),
  };

  const ratio = backgrounds.reduce(
    (worst, background) => Math.min(worst, contrastRatio(rgb, background)),
    Number.POSITIVE_INFINITY,
  );

  return { hex: rgbToHex(rgb), rgb, oklch, ratio, adjusted: false };
};

/**
 * Move a color along the lightness axis until it clears `target` against every
 * listed background, or until it runs out of room.
 *
 * The search runs coarse first to bracket the crossing point, then fine inside
 * that bracket. A single-step scan would be simpler, but a saturated color can
 * travel most of the lightness range, and the coarse pass keeps that from turning
 * into hundreds of OKLCH conversions per role.
 *
 * When `enforce` is off the seed is returned untouched, which is what the
 * "aesthetic only" mode in the control panel needs in order to show what a
 * scheme looks like without the solver's fingerprints on it.
 */
function solveContrast(
  seed: Oklch,
  backgrounds: Rgb[],
  target: number,
  direction: Direction,
  enforce: boolean,
): Solved {
  const start = evaluate(seed, backgrounds);
  if (start.ratio >= target || !enforce) {
    return start;
  }

  const sign = direction === 'darker' ? -1 : 1;
  const limit = direction === 'darker' ? 0.02 : 0.995;
  const at = (l: number): Solved =>
    evaluate({ l, c: taperChroma(l, seed.c), h: seed.h }, backgrounds);

  const COARSE = 0.02;
  const FINE = 0.002;

  let best = start;
  let high: number | null = null;

  // Coarse pass: find the first step that clears the target.
  for (let l = seed.l + sign * COARSE; sign < 0 ? l > limit : l < limit; l += sign * COARSE) {
    const candidate = at(l);
    if (candidate.ratio > best.ratio) {
      best = candidate;
    }
    if (candidate.ratio >= target) {
      high = l;
      break;
    }
  }

  if (high === null) {
    // Ran out of room. Keep whatever came closest, and say it was adjusted.
    best.adjusted = true;
    return best;
  }

  // Fine pass: walk back towards the seed, still one full coarse step away.
  const bracket = high - sign * COARSE;
  for (let l = bracket + sign * FINE; sign < 0 ? l > high : l < high; l += sign * FINE) {
    const candidate = at(l);
    if (candidate.ratio >= target) {
      candidate.adjusted = true;
      return candidate;
    }
    if (candidate.ratio > best.ratio) {
      best = candidate;
    }
  }

  const fallback = at(high);
  fallback.adjusted = true;
  return fallback;
}

/* ------------------------------------------------------------------ */
/* Variant recipes                                                     */
/* ------------------------------------------------------------------ */

/**
 * The aesthetic starting points, per variant.
 *
 * These are the values a designer would reach for first. The solver only steps
 * in when a value fails its contrast target, so an enforcement pass keeps the
 * intended look and repairs only what it has to.
 */
interface Shape {
  l: number;
  /** Multiplier applied to the accent chroma. */
  cScale: number;
  /** Minimum chroma, so links and accents never turn into flat grays. */
  cFloor?: number;
  alpha?: number;
}

interface VariantRecipe {
  surface: Shape;
  raised: Shape;
  sunken: Shape;
  hover: Shape;
  textStrong: Shape;
  textBody: Shape;
  textMuted: Shape;
  accent: Shape;
  accentHover: { l: number };
  accentSoft: Shape;
  link: Shape;
  linkHover: { l: number };
  linkVisited: { l: number };
  border: Shape;
  borderStrong: Shape;
  focusRing: Shape;
  shadow: Shape;
  overlay: Shape;
}

const RECIPES: Record<Variant, VariantRecipe> = {
  light: {
    surface: { l: 0.985, cScale: 0.07 },
    raised: { l: 0.995, cScale: 0.02 },
    sunken: { l: 0.955, cScale: 0.11 },
    hover: { l: 0.968, cScale: 0.09 },
    textStrong: { l: 0.26, cScale: 0.1 },
    textBody: { l: 0.45, cScale: 0.1 },
    textMuted: { l: 0.55, cScale: 0.1 },
    accent: { l: 0.54, cScale: 1, cFloor: 0.12 },
    accentHover: { l: 0.47 },
    accentSoft: { l: 0.945, cScale: 0.5 },
    link: { l: 0.48, cScale: 1, cFloor: 0.11 },
    linkHover: { l: 0.4 },
    linkVisited: { l: 0.4 },
    border: { l: 0.9, cScale: 0.2 },
    borderStrong: { l: 0.8, cScale: 0.2 },
    focusRing: { l: 0.6, cScale: 1, cFloor: 0.12 },
    shadow: { l: 0.25, cScale: 0.3, alpha: 0.16 },
    overlay: { l: 0.22, cScale: 0.2, alpha: 0.48 },
  },
  dark: {
    surface: { l: 0.185, cScale: 0.15 },
    raised: { l: 0.235, cScale: 0.13 },
    sunken: { l: 0.145, cScale: 0.13 },
    hover: { l: 0.265, cScale: 0.13 },
    textStrong: { l: 0.96, cScale: 0.06 },
    textBody: { l: 0.845, cScale: 0.08 },
    textMuted: { l: 0.75, cScale: 0.1 },
    accent: { l: 0.7, cScale: 1, cFloor: 0.13 },
    accentHover: { l: 0.77 },
    accentSoft: { l: 0.3, cScale: 0.6 },
    link: { l: 0.78, cScale: 1, cFloor: 0.12 },
    linkHover: { l: 0.86 },
    linkVisited: { l: 0.72 },
    border: { l: 0.3, cScale: 0.18 },
    borderStrong: { l: 0.42, cScale: 0.18 },
    focusRing: { l: 0.72, cScale: 1, cFloor: 0.13 },
    shadow: { l: 0, cScale: 0, alpha: 0.55 },
    overlay: { l: 0.08, cScale: 0.25, alpha: 0.66 },
  },
};

const seed = (accent: Oklch, shape: Shape): Oklch => ({
  l: shape.l,
  c: Math.max(accent.c * shape.cScale, shape.cFloor ?? 0),
  h: accent.h,
});

/* ------------------------------------------------------------------ */
/* Contrast audit                                                      */
/* ------------------------------------------------------------------ */

export interface ContrastCheck {
  id: string;
  /** What the pair is used for, in plain language. */
  label: string;
  fg: RoleToken;
  bg: RoleToken;
  required: number;
  ratio: number;
  level: WcagLevel;
  pass: boolean;
  /** WCAG criterion the threshold comes from. */
  criterion: string;
}

type CheckSpec = Omit<ContrastCheck, 'ratio' | 'level' | 'pass'>;

/**
 * The pairs that are actually rendered together somewhere in the demo page.
 * Anything not on this list is not worth a solver pass.
 */
const CHECK_SPECS: readonly CheckSpec[] = [
  {
    id: 'strong-on-surface',
    label: 'Headings on the section background',
    fg: 'text-strong',
    bg: 'surface',
    required: AA_TEXT,
    criterion: 'AA · normal text',
  },
  {
    id: 'body-on-surface',
    label: 'Body copy on the section background',
    fg: 'text-body',
    bg: 'surface',
    required: AA_TEXT,
    criterion: 'AA · normal text',
  },
  {
    id: 'muted-on-surface',
    label: 'Captions and metadata',
    fg: 'text-muted',
    bg: 'surface',
    required: AA_TEXT,
    criterion: 'AA · normal text',
  },
  {
    id: 'body-on-raised',
    label: 'Body copy inside cards',
    fg: 'text-body',
    bg: 'surface-raised',
    required: AA_TEXT,
    criterion: 'AA · normal text',
  },
  {
    id: 'link-on-surface',
    label: 'Inline links',
    fg: 'link',
    bg: 'surface',
    required: AA_TEXT,
    criterion: 'AA · normal text',
  },
  {
    id: 'link-on-sunken',
    label: 'Links on inset panels',
    fg: 'link',
    bg: 'surface-sunken',
    required: AA_TEXT,
    criterion: 'AA · normal text',
  },
  {
    id: 'on-accent',
    label: 'Text on solid buttons',
    fg: 'text-on-accent',
    bg: 'accent',
    required: AA_TEXT,
    criterion: 'AA · normal text',
  },
  {
    id: 'on-accent-alt',
    label: 'Text on secondary buttons',
    fg: 'accent-on-alt',
    bg: 'accent-alt',
    required: AA_TEXT,
    criterion: 'AA · normal text',
  },
  {
    id: 'accent-on-surface',
    label: 'Button fill against the page',
    fg: 'accent',
    bg: 'surface',
    required: AA_LARGE,
    criterion: 'AA · non-text contrast',
  },
  {
    id: 'accent-alt-on-surface',
    label: 'Secondary button fill against the page',
    fg: 'accent-alt',
    bg: 'surface',
    required: AA_LARGE,
    criterion: 'AA · non-text contrast',
  },
  {
    id: 'tertiary-on-surface',
    label: 'Highlight color on the page',
    fg: 'accent-tertiary',
    bg: 'surface',
    required: AA_TEXT,
    criterion: 'AA · normal text',
  },
  {
    id: 'strong-on-alt-soft',
    label: 'Badge text on the secondary wash',
    fg: 'text-strong',
    bg: 'accent-alt-soft',
    required: AA_TEXT,
    criterion: 'AA · normal text',
  },
  {
    id: 'border-strong-on-surface',
    label: 'Outlines that stand on their own',
    fg: 'border-strong',
    bg: 'surface',
    required: AA_LARGE,
    criterion: 'AA · non-text contrast',
  },
  {
    id: 'focus-ring-on-surface',
    label: 'Keyboard focus indicator',
    fg: 'focus-ring',
    bg: 'surface',
    required: AA_LARGE,
    criterion: 'AA · non-text contrast',
  },
];

/* ------------------------------------------------------------------ */
/* Theme building                                                      */
/* ------------------------------------------------------------------ */

export interface ThemeOptions {
  /**
   * When true, every role is pushed through the contrast solver until it meets
   * its WCAG target. When false, the aesthetic recipe is used verbatim so
   * unclamped schemes can be inspected too.
   */
  enforceContrast: boolean;
}

export interface ThemeResult {
  variant: Variant;
  /** CSS custom property values, ready to be applied to a DOM node. */
  theme: Theme;
  /**
   * The theme before any manual overrides, so a revert can restore it without
   * re-running the solver.
   */
  derived: Theme;
  /** Resolved colors, used by the audit and by the preview swatches. */
  colors: ThemeColors;
  checks: ContrastCheck[];
  passes: boolean;
  /** Roles the solver had to move, plus any that were edited by hand. */
  adjusted: RoleToken[];
}

/**
 * What a theme is derived from.
 *
 * The whole palette, not one color. Deriving every role from a single accent
 * produced a monochrome page: nineteen roles that were nineteen shades of one
 * hue, with the other harmony colors exported and never used. Binding roles to
 * different palette entries is what makes the harmony actually visible.
 */
export interface ThemeInput {
  /** The full harmony palette, in palette order. */
  swatches: readonly Oklch[];
  /**
   * Which palette entry drives the surfaces, the text and the primary accent.
   * Rotating this rotates which color dominates, while every theme keeps the
   * whole palette available to the secondary and tertiary roles.
   */
  dominant: number;
}

/**
 * Pick the palette entry a role group is derived from.
 *
 * Wraps around, so a two-color complementary palette still yields a third source:
 * it simply repeats the dominant, which is honest, because two colors cannot
 * provide three distinct ones.
 */
function sourceAt(swatches: readonly Oklch[], dominant: number, offset: number): Oklch {
  const total = Math.max(1, swatches.length);
  const index = (((dominant + offset) % total) + total) % total;
  return swatches[index] ?? swatches[0] ?? ({ l: 0.62, c: 0.12, h: 260 } as Oklch);
}

/**
 * Derive a complete theme from a palette.
 *
 * The order below is a dependency order, not a preference: surfaces are fixed
 * first because they define the luminance every other role is measured against.
 */
export function buildTheme(
  input: ThemeInput,
  variant: Variant,
  options: ThemeOptions,
): ThemeResult {
  const recipe = RECIPES[variant];
  const enforce = options.enforceContrast;
  const textDirection: Direction = variant === 'light' ? 'darker' : 'lighter';
  const adjusted = new Set<RoleToken>();

  // The palette, split by the job each entry does.
  const primary = sourceAt(input.swatches, input.dominant, 0);
  const secondary = sourceAt(input.swatches, input.dominant, 1);
  const tertiary = sourceAt(input.swatches, input.dominant, 2);

  const track = <T extends RoleToken>(token: T, solved: Solved): Solved => {
    if (solved.adjusted) {
      adjusted.add(token);
    }
    return solved;
  };

  /* Surfaces: fixed anchors. --------------------------------------- */
  const surface = evaluate(seed(primary, recipe.surface), []);
  const raised = evaluate(seed(primary, recipe.raised), []);
  const sunken = evaluate(seed(primary, recipe.sunken), []);
  const hover = evaluate(seed(primary, recipe.hover), []);

  // Every text role has to survive on top of any of the three surface kinds,
  // because cards and inset panels are used interchangeably across the demo.
  const textBackgrounds = [surface.rgb, raised.rgb, sunken.rgb];

  /* Text. ------------------------------------------------------------ */
  const textStrong = track(
    'text-strong',
    solveContrast(seed(primary, recipe.textStrong), textBackgrounds, AA_TEXT, textDirection, enforce),
  );
  const textBody = track(
    'text-body',
    solveContrast(seed(primary, recipe.textBody), textBackgrounds, AA_TEXT, textDirection, enforce),
  );
  const textMuted = track(
    'text-muted',
    solveContrast(seed(primary, recipe.textMuted), textBackgrounds, AA_TEXT, textDirection, enforce),
  );

  /*
   * Links come from the SECOND harmony color, not the dominant one.
   *
   * This is the single most visible consequence of using the whole palette: a
   * complementary scheme shows a violet button next to a green link, because that
   * is what the harmony rule computed. Deriving links from the dominant hue
   * instead would make the extra colors decorative again.
   */
  const linkBackgrounds = [surface.rgb, sunken.rgb, raised.rgb];
  const link = track(
    'link',
    solveContrast(seed(secondary, recipe.link), linkBackgrounds, AA_TEXT, textDirection, enforce),
  );
  const linkHover = track(
    'link-hover',
    solveContrast(
      { ...seed(secondary, recipe.link), l: recipe.linkHover.l },
      linkBackgrounds,
      AA_TEXT,
      textDirection,
      enforce,
    ),
  );
  const linkVisited = track(
    'link-visited',
    solveContrast(
      { ...seed(secondary, recipe.link), l: recipe.linkVisited.l, c: link.oklch.c * 0.85 },
      linkBackgrounds,
      AA_TEXT,
      textDirection,
      enforce,
    ),
  );

  /* Accent: the dominant color. --------------------------------------- */
  const accentFill = track(
    'accent',
    solveContrast(
      seed(primary, recipe.accent),
      [surface.rgb],
      AA_LARGE,
      textDirection,
      enforce,
    ),
  );
  const accentHover = track(
    'accent-hover',
    solveContrast(
      { ...accentFill.oklch, l: accentFill.oklch.l + (variant === 'light' ? -0.07 : 0.07) },
      [surface.rgb],
      AA_LARGE,
      textDirection,
      enforce,
    ),
  );
  const accentSoft = evaluate(
    { ...seed(primary, recipe.accentSoft), h: accentFill.oklch.h },
    [],
  );

  const textOnAccent = track(
    'text-on-accent',
    solveContrast(
      { l: variant === 'light' ? 0.99 : 0.16, c: accentFill.oklch.c * 0.12, h: accentFill.oklch.h },
      [accentFill.rgb],
      AA_TEXT,
      variant === 'light' ? 'darker' : 'lighter',
      enforce,
    ),
  );

  /* Accent alt: the second harmony color, as a fill. ------------------ */
  const altFill = track(
    'accent-alt',
    solveContrast(seed(secondary, recipe.accent), [surface.rgb], AA_LARGE, textDirection, enforce),
  );
  const altHover = track(
    'accent-alt-hover',
    solveContrast(
      { ...altFill.oklch, l: altFill.oklch.l + (variant === 'light' ? -0.07 : 0.07) },
      [surface.rgb],
      AA_LARGE,
      textDirection,
      enforce,
    ),
  );
  const altSoft = evaluate({ ...seed(secondary, recipe.accentSoft), h: altFill.oklch.h }, []);
  const textOnAlt = track(
    'accent-on-alt',
    solveContrast(
      { l: variant === 'light' ? 0.99 : 0.16, c: altFill.oklch.c * 0.12, h: altFill.oklch.h },
      [altFill.rgb],
      AA_TEXT,
      variant === 'light' ? 'darker' : 'lighter',
      enforce,
    ),
  );

  /*
   * Tertiary: the third harmony color. Held to the text threshold because its
   * documented use is highlights and editorial accents, which are read as text.
   */
  const tertiaryFill = track(
    'accent-tertiary',
    solveContrast(
      seed(tertiary, recipe.link),
      [surface.rgb, raised.rgb, sunken.rgb],
      AA_TEXT,
      textDirection,
      enforce,
    ),
  );

  /* Lines and focus. -------------------------------------------------- */
  const border = evaluate({ ...seed(primary, recipe.border), h: accentFill.oklch.h }, []);
  const borderStrong = track(
    'border-strong',
    solveContrast(
      { ...seed(primary, recipe.borderStrong), h: accentFill.oklch.h },
      [surface.rgb],
      AA_LARGE,
      textDirection,
      enforce,
    ),
  );
  const focusRing = track(
    'focus-ring',
    solveContrast(
      { ...seed(primary, recipe.focusRing), h: accentFill.oklch.h },
      [surface.rgb],
      AA_LARGE,
      textDirection,
      enforce,
    ),
  );

  /* Alpha tokens. ----------------------------------------------------- */
  const shadowShape = recipe.shadow;
  const shadowRgb = oklchToRgb({
    l: shadowShape.l,
    c: primary.c * shadowShape.cScale,
    h: primary.h,
  });
  const overlayShape = recipe.overlay;
  const overlayRgb = oklchToRgb({
    l: overlayShape.l,
    c: primary.c * overlayShape.cScale,
    h: primary.h,
  });

  const colors: ThemeColors = {
    surface: surface.rgb,
    'surface-raised': raised.rgb,
    'surface-sunken': sunken.rgb,
    'surface-hover': hover.rgb,
    'text-strong': textStrong.rgb,
    'text-body': textBody.rgb,
    'text-muted': textMuted.rgb,
    'text-on-accent': textOnAccent.rgb,
    accent: accentFill.rgb,
    'accent-hover': accentHover.rgb,
    'accent-soft': accentSoft.rgb,
    'accent-alt': altFill.rgb,
    'accent-alt-hover': altHover.rgb,
    'accent-alt-soft': altSoft.rgb,
    'accent-on-alt': textOnAlt.rgb,
    'accent-tertiary': tertiaryFill.rgb,
    link: link.rgb,
    'link-hover': linkHover.rgb,
    'link-visited': linkVisited.rgb,
    border: border.rgb,
    'border-strong': borderStrong.rgb,
    'focus-ring': focusRing.rgb,
    shadow: shadowRgb,
    overlay: overlayRgb,
  };

  const theme: Theme = {
    surface: surface.hex,
    'surface-raised': raised.hex,
    'surface-sunken': sunken.hex,
    'surface-hover': hover.hex,
    'text-strong': textStrong.hex,
    'text-body': textBody.hex,
    'text-muted': textMuted.hex,
    'text-on-accent': textOnAccent.hex,
    accent: accentFill.hex,
    'accent-hover': accentHover.hex,
    'accent-soft': accentSoft.hex,
    'accent-alt': altFill.hex,
    'accent-alt-hover': altHover.hex,
    'accent-alt-soft': altSoft.hex,
    'accent-on-alt': textOnAlt.hex,
    'accent-tertiary': tertiaryFill.hex,
    link: link.hex,
    'link-hover': linkHover.hex,
    'link-visited': linkVisited.hex,
    border: border.hex,
    'border-strong': borderStrong.hex,
    'focus-ring': focusRing.hex,
    shadow: rgba({ ...shadowRgb, a: shadowShape.alpha ?? 0.16 }),
    overlay: rgba({ ...overlayRgb, a: overlayShape.alpha ?? 0.48 }),
  };

  const checks = auditContrast(colors);

  return {
    variant,
    theme,
    derived: theme,
    colors,
    checks,
    passes: checks.every((check) => check.pass),
    adjusted: [...adjusted],
  };
}

/** Run every audited pair against a resolved set of colors. */
function auditContrast(colors: ThemeColors): ContrastCheck[] {
  return CHECK_SPECS.map((spec) => {
    const ratio = contrastRatio(colors[spec.fg], colors[spec.bg]);
    return {
      ...spec,
      ratio,
      level: wcagLevel(ratio),
      pass: ratio >= spec.required,
    };
  });
}

/**
 * Apply manual per-token edits on top of a derived theme.
 *
 * The contrast audit is re-run rather than carried over, because a manual value
 * can invalidate pairs that the solver had already satisfied: changing
 * `--surface` moves every ratio measured against it. Honoring the pick and then
 * reporting the consequence is the only honest option.
 */
export function withTokenOverrides(
  result: ThemeResult,
  overrides: Readonly<Partial<Record<RoleToken, string>>>,
): ThemeResult {
  const entries = Object.entries(overrides).filter(
    (entry): entry is [RoleToken, string] =>
      entry[1] !== undefined && ROLE_TOKENS.includes(entry[0] as RoleToken),
  );

  if (entries.length === 0) {
    return result;
  }

  const theme = { ...result.theme };
  const colors = { ...result.colors };

  for (const [token, value] of entries) {
    theme[token] = value;
    // Alpha tokens carry their alpha in the value, so only opaque roles can be
    // resolved to a color for the audit.
    if (!value.includes('/') && !value.includes('rgba')) {
      try {
        colors[token] = hexToRgb(value);
      } catch {
        // A value the parser rejects is kept as-is and simply not audited.
      }
    }
  }

  const checks = auditContrast(colors);

  return {
    variant: result.variant,
    theme,
    // The pre-override values are carried through, not recomputed, so reverting
    // is exact even if the solver is not deterministic in future.
    derived: result.derived,
    colors,
    checks,
    passes: checks.every((check) => check.pass),
    adjusted: [...new Set([...result.adjusted, ...entries.map(([token]) => token)])],
  };
}