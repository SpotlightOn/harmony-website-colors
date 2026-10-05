/**
 * Persistence.
 *
 * Two things are stored: the last scheme that was open, so a reload does not lose
 * work, and the palettes the user explicitly saved.
 *
 * Every access is guarded. Storage throws in private browsing modes and when a
 * quota is exceeded, and a color tool that crashes because of localStorage is
 * worse than one that forgets.
 */

import { isHarmonyRuleId, type HarmonyRuleId } from '@/color/harmony';
import { MAX_COLOR_COUNT, MIN_COLOR_COUNT } from '@/color/palette';
import { DEFAULT_SCHEME, sanitizeScheme, type SchemeState } from './scheme';

const SETTINGS_KEY = 'harmony:settings:v1';
const SAVED_KEY = 'harmony:saved:v1';
const PANEL_KEY = 'harmony:panel:v1';

export interface SavedScheme {
  id: string;
  name: string;
  baseHex: string;
  ruleId: HarmonyRuleId;
  colorCount: number;
  enforceContrast: boolean;
  createdAt: number;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Last scheme                                                         */
/* ------------------------------------------------------------------ */

export function loadSettings(): SchemeState {
  const stored = readJson<Partial<SchemeState>>(SETTINGS_KEY, {});
  return sanitizeScheme({ ...DEFAULT_SCHEME, ...stored });
}

export const saveSettings = (state: SchemeState): boolean => writeJson(SETTINGS_KEY, state);

/* ------------------------------------------------------------------ */
/* Saved palettes                                                      */
/* ------------------------------------------------------------------ */

/** A hard cap so a long session cannot grow without bound. */
export const MAX_SAVED = 24;

function sanitizeSaved(input: unknown): SavedScheme | null {
  if (typeof input !== 'object' || input === null) {
    return null;
  }
  const candidate = input as Partial<SavedScheme>;

  if (typeof candidate.baseHex !== 'string' || !/^#[\da-f]{6}$/i.test(candidate.baseHex)) {
    return null;
  }
  if (typeof candidate.ruleId !== 'string' || !isHarmonyRuleId(candidate.ruleId)) {
    return null;
  }

  return {
    id: typeof candidate.id === 'string' && candidate.id ? candidate.id : makeId(),
    name: (typeof candidate.name === 'string' && candidate.name.trim()) || 'Saved palette',
    baseHex: candidate.baseHex.toLowerCase(),
    ruleId: candidate.ruleId,
    colorCount: Math.min(
      MAX_COLOR_COUNT,
      Math.max(MIN_COLOR_COUNT, Math.round(Number(candidate.colorCount) || 3)),
    ),
    enforceContrast: candidate.enforceContrast !== false,
    createdAt: typeof candidate.createdAt === 'number' ? candidate.createdAt : Date.now(),
  };
}

export function loadSaved(): SavedScheme[] {
  const raw = readJson<unknown>(SAVED_KEY, []);
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map(sanitizeSaved)
    .filter((entry): entry is SavedScheme => entry !== null)
    .slice(0, MAX_SAVED);
}

export const persistSaved = (entries: SavedScheme[]): boolean =>
  writeJson(SAVED_KEY, entries.slice(0, MAX_SAVED));

/** Collision-resistant enough for a single browser's storage. */
export function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ------------------------------------------------------------------ */
/* Panel chrome                                                        */
/* ------------------------------------------------------------------ */

/** UI preferences that are not part of the scheme itself. */
export interface PanelState {
  /** Collapsed to a narrow rail, so the demo page gets the full width. */
  collapsed: boolean;
}

export const DEFAULT_PANEL: PanelState = { collapsed: false };

export function loadPanel(): PanelState {
  const stored = readJson<Partial<PanelState>>(PANEL_KEY, {});
  return {
    collapsed: typeof stored.collapsed === 'boolean' ? stored.collapsed : DEFAULT_PANEL.collapsed,
  };
}

export const savePanel = (state: PanelState): boolean => writeJson(PANEL_KEY, state);