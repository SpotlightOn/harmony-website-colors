/**
 * WordPress theme.json variation export.
 *
 * The target is a block theme whose colors are WordPress presets. A style
 * variation only replaces *values*, never slugs: the theme's blocks and templates
 * reference `var(--wp--preset--color--brand)` and friends, so inventing new slugs
 * would leave every one of those references pointing at the untouched defaults.
 * That is why this module is built around the theme's own vocabulary and maps
 * solved roles onto it.
 *
 *   WordPress reads styles/<slug>.json and offers it in the Site Editor under
 *   Appearance -> Styles.
 */

import { hexToRgb, readableTint, rgbToHex } from './color';
import type { RoleToken, ThemeResult } from './theme';

/**
 * The theme's schema and version.
 *
 * A variation has to declare the same version as the theme it extends. Emitting an
 * older one is not rejected outright, it is silently reinterpreted against the old
 * schema, so a mismatch shows up as settings that quietly do nothing.
 */
const WP_SCHEMA = 'https://schemas.wp.org/wp/7.1/theme.json';
const WP_VERSION = 3;

/**
 * Palette slots, in the theme's own order, mapped to the role that fills them.
 *
 * The order is light to dark because that is how the theme presents its ramp. The
 * mapping reuses the theme's existing structure: `brand` is the primary action
 * color and `accent` is the secondary highlight, which is exactly the relationship
 * the generator produces between the dominant harmony color and the second one.
 */
export const NOTOR_PALETTE: ReadonlyArray<{ slug: string; name: string; role: RoleToken }> = [
  { slug: 'base', name: 'Base', role: 'surface' },
  { slug: 'surface', name: 'Surface', role: 'surface-raised' },
  { slug: 'surface-deep', name: 'Surface Deep', role: 'surface-sunken' },
  { slug: 'brand-mist', name: 'Brand Mist', role: 'accent-soft' },
  { slug: 'brand-light', name: 'Brand Light', role: 'accent-alt-soft' },
  { slug: 'accent-light', name: 'Accent Light', role: 'accent-tertiary' },
  { slug: 'muted', name: 'Muted', role: 'text-muted' },
  { slug: 'accent', name: 'Accent', role: 'accent-alt' },
  { slug: 'brand', name: 'Brand', role: 'accent' },
  { slug: 'brand-deep', name: 'Brand Deep', role: 'accent-hover' },
  { slug: 'ink-soft', name: 'Ink Soft', role: 'text-body' },
  { slug: 'ink', name: 'Ink', role: 'text-strong' },
];

/**
 * Palette slots that a plain role mapping cannot fill.
 *
 * `brand-light` and `accent-light` are not decorative tints in this theme: it paints
 * them as link and caption colors *on top of* its dark `brand` and `ink` section
 * fills. Mapping a saturated harmony color there measured 1.30:1, which is not a
 * color, it is a bug. Both are therefore derived as readable tints of the color they
 * belong to, solved against every background the theme puts them on.
 */
const TINT_SLUGS = ['brand-light', 'accent-light'] as const;

/**
 * Duotone presets, expressed as palette *slugs*.
 *
 * Slugs rather than roles, deliberately. An earlier version referenced roles and had
 * to translate them to slugs on every lookup, which silently emitted `undefined`
 * into gradient stops. The theme's vocabulary is the slug; the role is an
 * implementation detail of this generator.
 */
export const NOTOR_DUOTONE: ReadonlyArray<{ slug: string; name: string; of: readonly string[] }> = [
  { slug: 'brand-on-ink', name: 'Brand on Ink', of: ['brand-light', 'ink'] },
  { slug: 'brand-on-base', name: 'Brand on Base', of: ['brand', 'base'] },
];

/**
 * Gradient presets, expressed as ordered palette slugs.
 *
 * Angles and stops are copied from the theme so the variation only changes color. A
 * gradient that changed its geometry as well would stop being a color scheme and
 * start being a redesign.
 */
export const NOTOR_GRADIENTS: ReadonlyArray<{
  slug: string;
  name: string;
  of: readonly string[];
  css: (a: string, b: string) => string;
}> = [
  {
    slug: 'brand',
    name: 'Brand',
    of: ['brand', 'brand-deep'],
    css: (a, b) => `linear-gradient(135deg, ${a} 0%, ${b} 100%)`,
  },
  {
    slug: 'ink',
    name: 'Ink',
    of: ['ink-soft', 'ink'],
    css: (a, b) => `linear-gradient(160deg, ${a} 0%, ${b} 100%)`,
  },
  {
    slug: 'surface',
    name: 'Surface',
    of: ['surface', 'surface-deep'],
    css: (a, b) => `linear-gradient(180deg, ${a} 0%, ${b} 100%)`,
  },
  {
    slug: 'dawn',
    name: 'Surface Dawn',
    of: ['brand-mist', 'surface'],
    css: (a, b) => `linear-gradient(180deg, ${a} 0%, ${b} 100%)`,
  },
];

/**
 * Turn a hex color into the space-separated form CSS `rgb()` accepts.
 *
 * Needed because the theme bakes its ink color into the shadow and text-shadow
 * presets as `rgb(16 22 23 / 0.08)`. A variation that overrode the palette but not
 * the shadows would leave every shadow tinted with the previous scheme's ink.
 */
function inkTriplet(hex: string): string {
  const value = hex.replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((char) => char + char)
          .join('')
      : value;

  const channels = [0, 2, 4].map((offset) => {
    const parsed = Number.parseInt(full.slice(offset, offset + 2), 16);
    return Number.isFinite(parsed) ? String(parsed) : '0';
  });

  return channels.join(' ');
}

export interface WordPressVariation {
  $schema: string;
  version: number;
  title: string;
  settings: {
    color: {
      duotone: Array<{ slug: string; name: string; colors: string[] }>;
      gradients: Array<{ slug: string; name: string; gradient: string }>;
      palette: Array<{ slug: string; name: string; color: string }>;
    };
    shadow: {
      defaultPresets: false;
      presets: Array<{ slug: string; name: string; shadow: string }>;
    };
  };
  styles: {
    color: { background: string; text: string };
    elements: { heading: { typography: { textShadow: string } } };
  };
}

/**
 * Build the variation.
 *
 * Only the light theme. The theme encodes absolute lightness in its sections rather
 * than roles — `section-ink` fills with `ink` expecting it to be the darkest color in
 * the palette — so inverting the palette turns that section white and leaves
 * `brand-light` as a light link color on a light background. Measured, that pairing
 * lands at 1.55:1. There is no honest dark variation of this theme, so none is
 * offered; a toggle that produces an unreadable site is worse than no toggle.
 *
 * `title` is what the Site Editor shows in the Styles panel, so it is derived from
 * the scheme rather than being a fixed string: a folder full of variations all called
 * "Harmony" would be unusable.
 */
export function wordpressVariation(
  theme: ThemeResult,
  options: { title: string },
): WordPressVariation {
  const token = (role: RoleToken): string => theme.theme[role];

  /*
   * Resolve the plain slots first, because the tints need `brand` and `ink` as their
   * contrast targets and both are already decided by the time they are solved.
   */
  const plain = new Map<string, string>(
    NOTOR_PALETTE.filter((entry) => !(TINT_SLUGS as readonly string[]).includes(entry.slug)).map(
      (entry) => [entry.slug, token(entry.role)],
    ),
  );

  const brand = plain.get('brand') as string;
  const ink = plain.get('ink') as string;

  /*
   * Both tints are painted on the same dark fills, so both are solved against the
   * same pair. `accent-light` keeps the second harmony color's hue even though it
   * sits on `brand` rather than on `accent` — that is what the theme does with its
   * own accent-light, and a slot that changed hue per background would not be a
   * palette.
   */
  const tintTargets = [hexToRgb(brand), hexToRgb(ink)];
  const tints = new Map<string, string>([
    [
      'brand-light',
      rgbToHex(readableTint(hexToRgb(brand), tintTargets)),
    ],
    [
      'accent-light',
      rgbToHex(readableTint(hexToRgb(token('accent-alt')), tintTargets)),
    ],
  ]);

  const paletteOf = (slug: string): string => tints.get(slug) ?? (plain.get(slug) as string);

  return {
    $schema: WP_SCHEMA,
    version: WP_VERSION,
    title: options.title,
    settings: {
      color: {
        palette: NOTOR_PALETTE.map(({ slug, name }) => ({
          slug,
          name,
          color: paletteOf(slug),
        })),
        gradients: NOTOR_GRADIENTS.map(({ slug, name, of, css }) => ({
          slug,
          name,
          gradient: css(paletteOf(of[0] as string), paletteOf(of[1] as string)),
        })),
        duotone: NOTOR_DUOTONE.map(({ slug, name, of }) => ({
          slug,
          name,
          colors: of.map((entry) => paletteOf(entry)),
        })),
      },
      shadow: {
        // The theme disables WordPress's own shadow presets, so this has to as well.
        // Leaving it unset re-enables a dozen defaults the theme never asked for.
        defaultPresets: false,
        presets: [
          {
            slug: 'soft',
            name: 'Soft',
            shadow: `0 1px 2px rgb(${inkTriplet(paletteOf('ink'))} / 0.08), 0 8px 24px rgb(${inkTriplet(
              paletteOf('ink'),
            )} / 0.06)`,
          },
          {
            slug: 'lifted',
            name: 'Raised',
            shadow: `0 2px 4px rgb(${inkTriplet(paletteOf('ink'))} / 0.10), 0 18px 48px rgb(${inkTriplet(
              paletteOf('ink'),
            )} / 0.12)`,
          },
        ],
      },
    },
    styles: {
      color: {
        background: 'var(--wp--preset--color--base)',
        text: 'var(--wp--preset--color--ink)',
      },
      elements: {
        heading: {
          typography: {
            textShadow: `0 1px 2px rgb(${inkTriplet(paletteOf('ink'))} / 0.10)`,
          },
        },
      },
    },
  };
}

/**
 * Serialize as WordPress writes its own JSON: tab indented, keys in the order
 * WordPress emits them. It is cosmetic, but a file that diffs cleanly against the
 * theme's existing variations is one a human will actually maintain.
 */
export function serializeVariation(variation: WordPressVariation): string {
  return `${JSON.stringify(variation, null, '\t')}\n`;
}

/**
 * The filename WordPress expects for a style variation.
 *
 * Slugs have to match `[a-z0-9-]`. A name with a space or an accent would make
 * WordPress silently skip the file.
 */
export function variationSlug(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug.length > 0 ? slug : 'harmony';
}
