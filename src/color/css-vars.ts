/**
 * Bridge between the TypeScript theme model and CSS custom properties.
 *
 * The whole demo works by setting these properties on a wrapper element. Two
 * groups exist:
 *
 * 1. Role tokens — a fixed set that never changes size. These are the contract
 *    the demo site's markup is written against.
 * 2. Indexed palette tokens — `--palette-1` through `--palette-N`. Their count
 *    follows the chosen color count, so no stylesheet can depend on them.
 *
 * The same two groups, plus the invariant layer from `invariant.ts`, are what the
 * export writes out. That is deliberate: the point of the export is that a
 * project which already consumes the role contract can be re-colored by replacing
 * values and nothing else.
 */

import { ROLE_TOKEN_DOCS, ROLE_TOKENS, type Theme, type ThemeResult, type Variant } from './theme';
import type { Palette, Swatch } from './palette';
import { invariantTokens, invariantToCss, reducedMotionCss } from './invariant';

/** Prefix for the indexed harmony colors. */
export const PALETTE_VAR_PREFIX = '--palette';

/** The indexed custom property name for a swatch position. */
export const paletteVarName = (position: number): string => `${PALETTE_VAR_PREFIX}-${position + 1}`;

/**
 * Role tokens as inline style properties, prefixed for use in React's `style`
 * prop. Order follows `ROLE_TOKENS`, so the emitted CSS blocks stay stable and
 * diffable between schemes.
 */
export function themeToStyle(theme: Theme): Record<string, string> {
  const style: Record<string, string> = {};
  for (const token of ROLE_TOKENS) {
    style[`--${token}`] = theme[token];
  }
  return style;
}

/** Indexed harmony colors as inline style properties. */
export function paletteToStyle(palette: Palette): Record<string, string> {
  const style: Record<string, string> = {};
  for (const swatch of palette.swatches) {
    style[paletteVarName(swatch.index)] = swatch.hex;
  }
  return style;
}

const banner = (lines: readonly string[]): string =>
  lines.map((line) => ` * ${line}`).join('\n');

/* ------------------------------------------------------------------ */
/* Export options                                                      */
/* ------------------------------------------------------------------ */

/**
 * How the emitted selectors address a theme.
 *
 * `class` and `attribute` keep every theme scoped, which is what a page with
 * several colored sections needs. `global` collapses to one light and one dark
 * theme on the document root, which is what re-coloring a single-theme project
 * needs.
 */
export type ScopeKind = 'class' | 'attribute' | 'global';

/** Output dialect. */
export type ExportFormat = 'css' | 'tailwind';

export interface ExportOptions {
  format: ExportFormat;
  scope: ScopeKind;
  /** Base name for generated selectors, e.g. `azure` -> `.theme-azure`. */
  slug: string;
  /** Include the scheme-invariant layer (spacing, type, radii, motion). */
  includeInvariant: boolean;
  /** Emit a theme per harmony color instead of only the primary. */
  includeAllAccents: boolean;
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  format: 'css',
  scope: 'global',
  slug: 'scheme',
  includeInvariant: true,
  includeAllAccents: true,
};

/** Minimal shape needed to build an export, to avoid importing the state layer. */
interface AccentLike {
  swatch: Swatch;
  light: ThemeResult;
  dark: ThemeResult;
}

/** A theme to emit, already resolved to a selector and a label. */
export interface ExportedTheme {
  /** Selector line, without the braces. May list `:root` first. */
  selector: string;
  /** Class a consumer puts on an element, without the dot. */
  className: string;
  /** Value for a `data-theme` attribute, when that scope is used. */
  attribute: string;
  /** Human label used in the comment above the block. */
  label: string;
  variant: Variant;
  theme: ThemeResult;
}

/** Turn a swatch name into a CSS identifier fragment. */
export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug === '' ? 'color' : slug;
}

/** How one theme is addressed, before the selector is built. */
function identityFor(
  scope: ScopeKind,
  base: string,
  name: string,
  variant: Variant,
): { className: string; attribute: string; selector: string } {
  const className = `theme-${base}-${name}-${variant}`;
  const attribute = `${base}-${name}-${variant}`;

  switch (scope) {
    case 'global':
      return {
        className: variant === 'light' ? 'theme' : 'theme-dark',
        attribute: variant === 'light' ? 'light' : 'dark',
        selector: variant === 'light' ? ':root' : ":root[data-tone='dark']",
      };
    case 'attribute':
      return { className, attribute, selector: `[data-theme='${attribute}']` };
    case 'class':
    default:
      return { className, attribute, selector: `.${className}` };
  }
}

/**
 * Resolve the list of themes to export.
 *
 * Slugs are deduplicated because a palette with many colors can repeat a hue name
 * (`Light Blue` twice, for instance), and two blocks sharing a selector would
 * silently override each other.
 *
 * The first block also applies to `:root`. Without that, a stylesheet pasted into
 * a project whose markup carries no theme class resolves every `var(--role)` to
 * nothing: transparent backgrounds, inherited text color, invisible buttons. A
 * wrong-looking page is a much worse failure than an unexpected default tone.
 */
export function resolveExportThemes(
  accents: readonly AccentLike[],
  options: ExportOptions,
): ExportedTheme[] {
  const base = options.slug.trim() === '' ? 'scheme' : slugify(options.slug);

  /*
   * `:root` can only hold one set of values. In the global scope every light theme
   * would resolve to `:root` and they would silently override each other, so the
   * global scope is defined as the primary accent only.
   */
  const list =
    options.includeAllAccents && options.scope !== 'global' ? accents : [accents[0] as AccentLike];

  const seen = new Map<string, number>();
  const themes: ExportedTheme[] = [];

  for (const accent of list) {
    const name = slugify(accent.swatch.name);
    const count = (seen.get(name) ?? 0) + 1;
    seen.set(name, count);
    const unique = count === 1 ? name : `${name}-${count}`;

    for (const variant of ['light', 'dark'] as const) {
      const identity = identityFor(options.scope, base, unique, variant);

      themes.push({
        // The first theme doubles as the document default, so markup that carries
        // no theme class still renders the light tone instead of nothing.
        selector:
          themes.length === 0 && options.scope !== 'global'
            ? `:root, ${identity.selector}`
            : identity.selector,
        className: identity.className,
        attribute: identity.attribute,
        label: `${accent.swatch.name} (${accent.swatch.hex}) - ${variant}`,
        variant,
        theme: accent[variant],
      });
    }
  }

  return themes;
}

/* ------------------------------------------------------------------ */
/* CSS                                                                 */
/* ------------------------------------------------------------------ */

/**
 * Comment markers inside a role-token block.
 *
 * Expressed as token names rather than indices: the groups must stay correct when
 * a role is inserted in the middle of the contract, which is exactly when
 * hard-coded offsets silently mislabel the output.
 */
const TOKEN_GROUPS: ReadonlyArray<readonly [name: string, count: number, title: string]> = [
  ['surface', 4, 'Surfaces'],
  ['text-strong', 4, 'Text'],
  ['accent', 3, 'Primary brand color'],
  ['accent-alt', 5, 'Second and third harmony colors'],
  ['link', 3, 'Links'],
  ['border', 3, 'Lines and focus'],
  ['shadow', 2, 'Overlays'],
];

function roleTokenBlock(theme: Theme, indent: string): string {
  const lines: string[] = [];

  for (const [name, count, title] of TOKEN_GROUPS) {
    const start = ROLE_TOKENS.indexOf(name as (typeof ROLE_TOKENS)[number]);
    if (start === -1) {
      continue;
    }

    lines.push(`${indent}/* ${title} */`);
    for (const token of ROLE_TOKENS.slice(start, start + count)) {
      lines.push(`${indent}--${token}: ${theme[token]};`);
    }
  }

  // Anything the groups above do not cover still gets emitted.
  const grouped = new Set(TOKEN_GROUPS.flatMap(([name, count]) => {
    const start = ROLE_TOKENS.indexOf(name as (typeof ROLE_TOKENS)[number]);
    return start === -1 ? [] : ROLE_TOKENS.slice(start, start + count);
  }));

  const rest = ROLE_TOKENS.filter((token) => !grouped.has(token));
  if (rest.length > 0) {
    lines.push(`${indent}/* Ungrouped */`);
    for (const token of rest) {
      lines.push(`${indent}--${token}: ${theme[token]};`);
    }
  }

  return lines.join('\n');
}

/**
 * The indexed palette block. Emitted once rather than per theme, because the
 * harmony colors do not change between tones.
 */
function paletteBlock(palette: Palette, indent: string): string {
  const lines = palette.swatches.map(
    (swatch) => `${indent}${paletteVarName(swatch.index)}: ${swatch.hex};`,
  );
  return [
    `${indent}/* Indexed harmony colors (${palette.swatches.length}). The count`,
    `${indent}   follows the scheme, so no stylesheet may depend on them. */`,
    ...lines,
  ].join('\n');
}

export interface CssExportInput {
  palette: Palette;
  accents: readonly AccentLike[];
  options: ExportOptions;
  label: string;
}

/** Render a full stylesheet: invariant layer, indexed palette, then every theme. */
export function paletteToCss({ palette, accents, options, label }: CssExportInput): string {
  const themes = resolveExportThemes(accents, options);
  const passing = accents.filter((accent) => accent.light.passes && accent.dark.passes).length;

  const parts: string[] = [
    '/**',
    banner([
      'Generated color scheme.',
      `Label:      ${label}`,
      `Base:       ${palette.baseHex}`,
      `Rule:       ${palette.rule.label} (${palette.rule.hueOffsets.join(', ')} deg)`,
      `Colors:     ${palette.swatches.length}`,
      `Themes:     ${themes.length} (${
        options.scope === 'global'
          ? 'primary accent only, the document root holds one set of values'
          : options.includeAllAccents
            ? 'one per harmony color'
            : 'primary accent only'
      })`,
      `WCAG 2.2 AA: ${passing}/${accents.length} accents pass in both tones`,
      '',
      'Two layers, and the split is the whole point:',
      '',
      '  1. Scheme-invariant tokens (spacing, type, radii, motion). They contain',
      '     no color at all and never change between schemes.',
      '  2. Role tokens. These names are design-neutral and identical for every',
      '     scheme. Only the values change, which is why one stylesheet can',
      '     render all of them.',
      '',
      'To re-color a project that already consumes these names, replace the role',
      'token values and leave everything else alone.',
    ]),
    ' */',
    '',
  ];

  const invariant = invariantToCss('  ');
  if (options.includeInvariant && invariant !== '') {
    parts.push(
      '/* ================================================================== */',
      '/* 1. Scheme-invariant layer. No color, never changes.                 */',
      '/* ================================================================== */',
      '',
      invariant,
      '',
    );
  }

  parts.push(
    '/* ================================================================== */',
    '/* 2. Role tokens. Names are fixed; values are per scheme.               */',
    '/* ================================================================== */',
    '',
  );

  const paletteSelector =
    options.scope === 'global' ? ':root' : `:root, .theme-${slugify(options.slug)}`;
  parts.push(`${paletteSelector} {`, paletteBlock(palette, '  '), '}', '');

  for (const entry of themes) {
    parts.push(
      `/* ${entry.label} */`,
      `${entry.selector} {`,
      roleTokenBlock(entry.theme.theme, '  '),
      '}',
      '',
    );
  }

  if (options.includeInvariant && reducedMotionCss !== '') {
    parts.push(reducedMotionCss, '');
  }

  parts.push(usageNote(themes, options));

  return `${parts.join('\n').trimEnd()}\n`;
}

/**
 * A short usage note, because the one thing an exported stylesheet cannot state on
 * its own is which element is supposed to carry the class.
 */
function usageNote(themes: readonly ExportedTheme[], options: ExportOptions): string {
  const first = themes[0];
  if (!first) {
    return '';
  }

  if (options.scope === 'global') {
    return [
      '/* ================================================================== */',
      '/* Usage                                                                    */',
      '/* ================================================================== */',
      '/*',
      ' * Nothing to do. The light tone is already on :root.',
      ' *',
      ' * To switch to the dark tone, either:',
      ' *',
      " *   document.documentElement.setAttribute('data-tone', 'dark')",
      ' *',
      ' * or scope it in CSS:',
      ' *',
      " *   [data-tone='dark'] .theme-dark {",
      ' *     ...paste the dark role token values here...',
      ' *   }',
      ' */',
    ].join('\n');
  }

  const attribute = options.scope === 'attribute';
  const light = themes.find((entry) => entry.variant === 'light');
  const dark = themes.find((entry) => entry.variant === 'dark');
  const markup = (entry: ExportedTheme | undefined): string => {
    if (!entry) return '(none)';
    return attribute
      ? `<section data-theme="${entry.attribute}">`
      : `<section class="${entry.className}">`;
  };

  return [
    '/* ================================================================== */',
    '/* Usage                                                                    */',
    '/* ================================================================== */',
    '/*',
    ' * Add one of these to any element to give it that tone:',
    ' *',
    ` *   light   ${markup(light)}`,
    ` *   dark    ${markup(dark)}`,
    ' *',
    ' * The first theme also applies to :root, so an element carrying no theme class',
    ' * still gets the light tone rather than an unstyled one.',
    ' */',
  ].join('\n');
}

/* ------------------------------------------------------------------ */
/* Tailwind v4                                                         */
/* ------------------------------------------------------------------ */

/**
 * Namespace map for the invariant layer under Tailwind v4.
 *
 * Only tokens with a real Tailwind counterpart are mapped; the rest describe
 * things Tailwind does not model, and passing them through unchanged would create
 * utilities that do not behave.
 */
const TAILWIND_NAMESPACES: ReadonlyArray<readonly [prefix: string, namespace: string]> = [
  ['--space-', '--spacing-'],
  ['--text-', '--text-'],
  ['--radius-', '--radius-'],
  ['--font-', '--font-'],
  ['--weight-', '--font-weight-'],
];

/**
 * Render the scheme as a Tailwind v4 theme.
 *
 * Role token names are kept verbatim under a `--color-*` namespace, so they become
 * utilities such as `bg-surface`, `text-text-body` and `border-border-strong`.
 * Verbatim names matter more than prettier utilities here: the value of the export
 * is that the role contract survives the trip into another project's conventions.
 *
 * Tailwind switches tone through a class rather than a data attribute, so the dark
 * half always lands on `.dark`.
 */
export function paletteToTailwind({ palette, accents, options, label }: CssExportInput): string {
  const primary = accents[0] as AccentLike;
  const passing = primary.light.passes && primary.dark.passes;

  const roleLines = (theme: Theme, indent: string): string[] =>
    ROLE_TOKENS.map((token) => `${indent}--color-${token}: ${theme[token]};`);

  const tailwindInvariant = invariantTokens
    .filter((token) => TAILWIND_NAMESPACES.some(([prefix]) => token.name.startsWith(prefix)))
    .map((token) => {
      const [prefix, namespace] = TAILWIND_NAMESPACES.find(([p]) => token.name.startsWith(p)) as readonly [string, string];
      const suffix = token.name.slice(prefix.length);
      // `0` is the one bare name in each of these namespaces.
      const bare = suffix === '' ? '' : `-${suffix}`;
      return `  ${namespace}${bare}: ${token.value};`;
    });

  const parts = [
    '/**',
    banner([
      'Generated color scheme, Tailwind v4 dialect.',
      `Label:      ${label}`,
      `Base:       ${palette.baseHex}`,
      `Rule:       ${palette.rule.label} (${palette.rule.hueOffsets.join(', ')} deg)`,
      `WCAG 2.2 AA: ${passing ? 'passes' : 'fails'} in both tones`,
      '',
      'Role token names are preserved verbatim under a --color-* namespace, so they',
      'become utilities such as bg-surface, text-text-body and border-border-strong.',
      'The name survives the trip, which is the entire point: a component written',
      'against bg-surface keeps working when the values change.',
      '',
      'Tone switching follows Tailwind convention. Put `dark` on an ancestor, or set',
      'it on <html>.',
    ]),
    ' */',
    '@import "tailwindcss";',
    '',
    '@theme {',
    '  /* Light tone */',
    ...roleLines(primary.light.theme, '  '),
    '',
    '  /* Indexed harmony colors (',
    `   * ${palette.swatches.length}). */`,
    ...palette.swatches.map(
      (swatch) =>
        `  --color-${PALETTE_VAR_PREFIX}-${swatch.index + 1}: ${swatch.hex};`,
    ),
    ...(options.includeInvariant && tailwindInvariant.length > 0
      ? ['', '  /* Invariant layer, mapped onto Tailwind namespaces */', ...tailwindInvariant]
      : []),
    '}',
    '',
    '/* Dark tone. Add `dark` to an ancestor to switch. */',
    '.dark {',
    ...roleLines(primary.dark.theme, '  '),
    '}',
  ];

  return `${parts.join('\n')}\n`;
}

/* ------------------------------------------------------------------ */
/* JSON                                                                */
/* ------------------------------------------------------------------ */

function contrastSummary(theme: ThemeResult): unknown[] {
  return theme.checks.map((check) => ({
    pair: `${check.fg} on ${check.bg}`,
    ratio: Number(check.ratio.toFixed(2)),
    required: check.required,
    pass: check.pass,
  }));
}

export function paletteToJson({ palette, accents, label }: CssExportInput): string {
  return JSON.stringify(
    {
      label,
      base: palette.baseHex,
      normalizedBase: {
        l: Number(palette.baseOklch.l.toFixed(3)),
        c: Number(palette.baseOklch.c.toFixed(4)),
        h: Math.round(palette.baseOklch.h),
      },
      rule: {
        id: palette.rule.id,
        label: palette.rule.label,
        hueOffsets: palette.rule.hueOffsets,
      },
      colors: palette.swatches.map((swatch) => ({
        index: swatch.index + 1,
        name: swatch.name,
        hex: swatch.hex,
        oklch: {
          l: Number(swatch.oklch.l.toFixed(3)),
          c: Number(swatch.oklch.c.toFixed(4)),
          h: Math.round(swatch.oklch.h),
        },
      })),
      themes: accents.map((accent) => ({
        name: accent.swatch.name,
        hex: accent.swatch.hex,
        light: {
          tokens: accent.light.theme,
          adjustedBySolver: accent.light.adjusted,
          contrast: contrastSummary(accent.light),
        },
        dark: {
          tokens: accent.dark.theme,
          adjustedBySolver: accent.dark.adjusted,
          contrast: contrastSummary(accent.dark),
        },
      })),
      invariant: Object.fromEntries(
        invariantTokens.map((token) => [token.name, token.value]),
      ),
    },
    null,
    2,
  );
}

/* ------------------------------------------------------------------ */
/* Contract checking                                                   */
/* ------------------------------------------------------------------ */

/** Documentation rows for the token reference table in the UI. */
export const tokenReference = ROLE_TOKENS.map((token) => ({
  token: `--${token}`,
  description: ROLE_TOKEN_DOCS[token],
}));

export interface ContractCheck {
  /** Roles the stylesheet defines with a usable value. */
  present: string[];
  /** Roles the contract requires but the stylesheet does not define. */
  missing: string[];
  /** Roles defined without a usable value. */
  empty: string[];
  /** How many distinct custom properties were seen, contract or not. */
  scanned: number;
  /** True when every role is present and non-empty. */
  compatible: boolean;
}

/**
 * Check a stylesheet against the role contract.
 *
 * This is the "is my existing theme compatible" test: paste a stylesheet and see
 * which of the nineteen names it actually defines. Matching is name based and
 * tolerant of formatting, because the question is whether the roles are present,
 * not whether the CSS happens to parse.
 */
export function checkContract(css: string): ContractCheck {
  const found = new Map<string, string>();
  const declaration = /(--[a-z0-9-]+)\s*:\s*([^;}]*)/gi;

  let match = declaration.exec(css);
  while (match !== null) {
    const name = (match[1] as string).toLowerCase();
    const value = (match[2] as string).trim();
    // First definition wins, mirroring the cascade at equal specificity.
    if (!found.has(name) || found.get(name) === '') {
      found.set(name, value);
    }
    match = declaration.exec(css);
  }

  const present: string[] = [];
  const missing: string[] = [];
  const empty: string[] = [];

  for (const token of ROLE_TOKENS) {
    const name = `--${token}`;
    const value = found.get(name);
    if (value === undefined) {
      missing.push(name);
    } else if (value === '') {
      empty.push(name);
    } else {
      present.push(name);
    }
  }

  return {
    present,
    missing,
    empty,
    scanned: found.size,
    compatible: missing.length === 0 && empty.length === 0,
  };
}