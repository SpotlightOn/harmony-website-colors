/**
 * Access to the scheme-invariant token layer for the export.
 *
 * `tokens.css` stays the single source of truth. It is read as raw text and the
 * `:root` block is parsed out, so the exported stylesheet can ship spacing, type,
 * radii and motion without those values ever being duplicated in TypeScript.
 *
 * Anything parsed out of that file is, by construction, free of color.
 */

import tokensCss from '@/styles/tokens.css?raw';

export interface InvariantToken {
  name: string;
  value: string;
  /**
   * Index of the blank-line-delimited group the token belongs to. Preserved so the
   * exported block can keep the visual sections the source file uses.
   */
  group: number;
}

/** Strip `/* … *\/` comments so they do not end up in the parse. */
const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * Extract the custom properties of the first `:root` block.
 *
 * `:root` is the first block in the file and contains no nested braces, so the
 * first closing brace ends it. Returns an empty list rather than throwing if the
 * file is restructured, which would only cost the export its invariant layer.
 *
 * Matching runs over the whole block rather than line by line, because some values
 * wrap: the font stacks are the obvious case, and a line-based parse silently
 * truncates them.
 */
function parseRootTokens(css: string): InvariantToken[] {
  const source = stripComments(css);
  const start = source.indexOf(':root');
  if (start === -1) {
    return [];
  }

  const open = source.indexOf('{', start);
  const close = source.indexOf('}', open);
  if (open === -1 || close === -1) {
    return [];
  }

  const body = source.slice(open + 1, close);
  const tokens: InvariantToken[] = [];

  let group = 0;
  let sawTokenInGroup = false;

  // Value runs to the terminating semicolon, newlines included.
  const declaration = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let match = declaration.exec(body);

  while (match !== null) {
    const name = (match[1] as string).toLowerCase();
    // Collapse wrapped values onto one line, which reads better once pasted.
    const value = (match[2] as string).replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();

    if (value !== '') {
      // A blank line between declarations ends the current group.
      const previousEnd = body.lastIndexOf(';', match.index);
      const gap = body.slice(previousEnd + 1, match.index);
      if (sawTokenInGroup && /\n\s*\n/.test(gap)) {
        group += 1;
        sawTokenInGroup = false;
      }

      tokens.push({ name, value, group });
      sawTokenInGroup = true;
    }

    match = declaration.exec(body);
  }

  return tokens;
}

/**
 * The invariant tokens, in source order.
 *
 * Declarations whose value refers to another invariant token (`--shadow-sm`
 * refers to `--shadow`) are skipped: `--shadow` is a role token that only exists
 * once a scheme is applied, so emitting them here would produce references to
 * nothing.
 */
export const invariantTokens: readonly InvariantToken[] = parseRootTokens(tokensCss).filter(
  (token) => !token.value.includes('var('),
);

/** How many groups the invariant layer ends up with. */
export const invariantGroupCount = invariantTokens.reduce(
  (max, token) => Math.max(max, token.group),
  0,
) + 1;

/**
 * The reduced-motion overrides, which the export also needs so a pasted
 * stylesheet behaves like the app.
 */
export const reducedMotionCss: string = (() => {
  const source = stripComments(tokensCss);
  const at = source.indexOf('@media (prefers-reduced-motion');
  if (at === -1) {
    return '';
  }
  const open = source.indexOf('{', at);
  // The media block contains one `:root` block, so the second brace closes it.
  const close = source.indexOf('}', source.indexOf('}', open) + 1);
  return open === -1 || close === -1 ? '' : source.slice(at, close + 1).trim();
})();

/**
 * Render the invariant layer as a `:root` declaration block.
 *
 * @param indent Indentation applied to each declaration.
 */
export function invariantToCss(indent = ''): string {
  if (invariantTokens.length === 0) {
    return '';
  }

  const lines: string[] = [];
  let currentGroup = invariantTokens[0]?.group ?? 0;

  for (const token of invariantTokens) {
    if (token.group !== currentGroup && lines.length > 0) {
      lines.push('');
      currentGroup = token.group;
    }
    lines.push(`${indent}${token.name}: ${token.value};`);
  }

  return [':root {', ...lines, '}'].join('\n');
}