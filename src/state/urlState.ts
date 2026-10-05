/**
 * URL serialization, so any scheme can be shared as a link.
 *
 * The state lives in the query string rather than the hash fragment, because the
 * demo page has its own in-page anchors (`#product`, `#pricing`). Sharing a hash
 * would mean every anchor click wiped the shared scheme.
 *
 * Format: ?b=3b6ef5&r=triadic&n=5&aa=1
 */

import { isHarmonyRuleId } from '@/color/harmony';
import { MAX_COLOR_COUNT, MIN_COLOR_COUNT } from '@/color/palette';
import { DEFAULT_SCHEME, sanitizeScheme, type SchemeState } from './scheme';

const KEYS = { base: 'b', rule: 'r', count: 'n', enforce: 'aa' } as const;

export function encodeScheme(state: SchemeState): string {
  const params = new URLSearchParams();
  params.set(KEYS.base, state.baseHex.replace('#', ''));
  params.set(KEYS.rule, state.ruleId);
  params.set(KEYS.count, String(state.colorCount));
  if (!state.enforceContrast) {
    params.set(KEYS.enforce, '0');
  }
  return `?${params.toString()}`;
}

/** Parse a query string. Returns `null` when it carries no scheme. */
export function decodeScheme(search: string): SchemeState | null {
  const raw = search.startsWith('?') ? search.slice(1) : search;
  if (!raw) {
    return null;
  }

  const params = new URLSearchParams(raw);
  const base = params.get(KEYS.base);
  if (!base || !/^[\da-f]{6}$/i.test(base)) {
    return null;
  }

  const rule = params.get(KEYS.rule) ?? DEFAULT_SCHEME.ruleId;
  const count = params.get(KEYS.count);
  const enforce = params.get(KEYS.enforce);

  return sanitizeScheme({
    baseHex: `#${base.toLowerCase()}`,
    ruleId: isHarmonyRuleId(rule) ? rule : DEFAULT_SCHEME.ruleId,
    colorCount:
      count === null
        ? 3
        : Math.min(MAX_COLOR_COUNT, Math.max(MIN_COLOR_COUNT, Number(count) || 3)),
    enforceContrast: enforce === null ? true : enforce !== '0',
    seed: 0,
  });
}