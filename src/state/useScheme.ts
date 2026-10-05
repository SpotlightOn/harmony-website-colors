/**
 * The single stateful entry point of the app.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { HARMONY_RULES } from '@/color/harmony';
import { MAX_COLOR_COUNT, MIN_COLOR_COUNT } from '@/color/palette';
import type { RoleToken, Variant } from '@/color/theme';
import { decodeScheme, encodeScheme } from './urlState';
import {
  DEFAULT_SCHEME,
  deriveScheme,
  overrideCount as countOverrides,
  overrideKey,
  randomBaseHex,
  sanitizeScheme,
  type DerivedScheme,
  type SchemeState,
} from './scheme';
import {
  loadPanel,
  loadSaved,
  loadSettings,
  makeId,
  MAX_SAVED,
  persistSaved,
  savePanel,
  saveSettings,
  type PanelState,
  type SavedScheme,
} from './storage';

/**
 * Read the initial state once.
 *
 * The two sources describe different things. The URL describes the palette and is
 * meant to be shared with someone else. `localStorage` holds manual token edits,
 * which are personal and are never encoded into a link. So they are merged rather
 * than one replacing the other: without this, the URL the app writes for itself
 * would shadow the stored edits on every single reload, and hand-picked token
 * values could never survive a refresh.
 */
function readInitialState(): SchemeState {
  if (typeof window === 'undefined') {
    return DEFAULT_SCHEME;
  }

  const stored = loadSettings();
  const fromUrl = decodeScheme(window.location.search);

  if (fromUrl === null) {
    return stored;
  }

  return { ...fromUrl, overrides: stored.overrides };
}

export interface SchemeControls {
  state: SchemeState;
  derived: DerivedScheme;
  setBaseHex: (hex: string) => void;
  setRuleId: (id: SchemeState['ruleId']) => void;
  setColorCount: (count: number) => void;
  setEnforceContrast: (value: boolean) => void;
  randomizeBase: () => void;
  shuffle: () => void;
  reset: () => void;

  /** Assign one role token by hand, or pass `null` to revert it. */
  assignToken: (
    accentIndex: number,
    variant: Variant,
    role: RoleToken,
    hex: string | null,
  ) => void;
  resetOverrides: () => void;
  overrideCount: number;

  saved: SavedScheme[];
  /** Default name offered when saving the current scheme. */
  suggestedName: string;
  saveCurrent: () => boolean;
  removeSaved: (id: string) => void;
  applySaved: (entry: SavedScheme) => void;
  atSavedLimit: boolean;

  panel: PanelState;
  togglePanel: () => void;
}

export function useScheme(): SchemeControls {
  const [state, setState] = useState<SchemeState>(readInitialState);
  const [saved, setSaved] = useState<SavedScheme[]>(() =>
    typeof window === 'undefined' ? [] : loadSaved(),
  );
  const [panel, setPanel] = useState<PanelState>(() =>
    typeof window === 'undefined' ? { collapsed: false } : loadPanel(),
  );

  useEffect(() => {
    savePanel(panel);
  }, [panel]);

  const togglePanel = useCallback(() => {
    setPanel((current) => ({ ...current, collapsed: !current.collapsed }));
  }, []);

  /* Persist the working scheme so a reload keeps the user's place. */
  useEffect(() => {
    saveSettings(state);
  }, [state]);

  /*
   * Mirror the scheme into the address bar. `replaceState` is used on purpose:
   * dragging the color-count slider would otherwise push hundreds of entries
   * onto the back stack.
   */
  useEffect(() => {
    const target = encodeScheme(state);
    if (window.location.search !== target) {
      window.history.replaceState(null, '', target);
    }
  }, [state]);

  /*
   * React to URL changes that this hook did not make, which is what happens when
   * someone pastes a shared link or uses the back button. Comparing the
   * serialized form keeps the handler from fighting our own writes.
   */
  useEffect(() => {
    const onPopState = () => {
      const next = decodeScheme(window.location.search);
      if (next) {
        setState((current) =>
          encodeScheme(current) === encodeScheme(next) ? current : next,
        );
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const derived = useMemo(() => deriveScheme(state), [state]);

  const patch = useCallback((changes: Partial<SchemeState>) => {
    setState((current) => sanitizeScheme({ ...current, ...changes }));
  }, []);

  /*
   * `patchPalette` is the single place the palette identity changes, and therefore
   * the single place overrides can become meaningless.
   */
  const patchPalette = useCallback((changes: Partial<SchemeState>) => {
    setState((current) =>
      sanitizeScheme({ ...current, ...changes, overrides: {}, seed: Date.now() }),
    );
  }, []);

  const setBaseHex = useCallback(
    (hex: string) => patchPalette({ baseHex: hex }),
    [patchPalette],
  );

  const setRuleId = useCallback(
    (ruleId: SchemeState['ruleId']) => {
      const rule = HARMONY_RULES.find((entry) => entry.id === ruleId);
      setState((current) =>
        sanitizeScheme({
          ...current,
          ruleId,
          // Snap the count to what the rule actually defines.
          colorCount: rule
            ? Math.min(MAX_COLOR_COUNT, Math.max(MIN_COLOR_COUNT, rule.stops.length))
            : current.colorCount,
          overrides: {},
          seed: Date.now(),
        }),
      );
    },
    [],
  );

  const setColorCount = useCallback(
    (colorCount: number) => patchPalette({ colorCount }),
    [patchPalette],
  );

  const setEnforceContrast = useCallback(
    (enforceContrast: boolean) => patch({ enforceContrast }),
    [patch],
  );

  const randomizeBase = useCallback(() => {
    setState((current) => ({
      ...current,
      baseHex: randomBaseHex(),
      overrides: {},
      seed: Date.now(),
    }));
  }, []);

  /** Randomize everything at once. This is the app's "surprise me" button. */
  const shuffle = useCallback(() => {
    setState((current) => {
      const rule = HARMONY_RULES[Math.floor(Math.random() * HARMONY_RULES.length)];
      return sanitizeScheme({
        ...current,
        baseHex: randomBaseHex(),
        ruleId: (rule ?? HARMONY_RULES[0])!.id,
        colorCount: 2 + Math.floor(Math.random() * 7),
        overrides: {},
        seed: Date.now(),
      });
    });
  }, []);

  const reset = useCallback(() => {
    setState({ ...DEFAULT_SCHEME, seed: Date.now() });
  }, []);

  /*
   * Manual token edits.
   *
   * Overrides are dropped whenever the palette identity changes, because they
   * name specific colors: an override pinned to a harmony color is meaningless once
   * the base color or the rule moves, and keeping it would silently apply a stale
   * hex to an unrelated role.
   */
  const assignToken = useCallback(
    (accentIndex: number, variant: Variant, role: RoleToken, hex: string | null) => {
      const key = overrideKey(accentIndex, variant, role);

      setState((current) => {
        const overrides = { ...current.overrides };

        if (hex === null) {
          delete overrides[key];
        } else {
          overrides[key] = hex;
        }

        return {
          ...current,
          overrides,
          // Bumped so the palette preview replays its transition.
          seed: Date.now(),
        };
      });
    },
    [],
  );

  const resetOverrides = useCallback(() => {
    setState((current) => ({ ...current, overrides: {}, seed: Date.now() }));
  }, []);

  const suggestedName = derived.fullName;

  const saveCurrent = useCallback((): boolean => {
    let stored = false;

    setSaved((current) => {
      if (current.length >= MAX_SAVED) {
        return current;
      }
      const entry: SavedScheme = {
        id: makeId(),
        name: suggestedName,
        baseHex: state.baseHex,
        ruleId: state.ruleId,
        colorCount: state.colorCount,
        enforceContrast: state.enforceContrast,
        createdAt: Date.now(),
      };
      const next = [entry, ...current];
      stored = persistSaved(next);
      return next;
    });

    return stored;
  }, [state, suggestedName]);

  const removeSaved = useCallback((id: string) => {
    setSaved((current) => {
      const next = current.filter((entry) => entry.id !== id);
      persistSaved(next);
      return next;
    });
  }, []);

  const applySaved = useCallback((entry: SavedScheme) => {
    setState(
      sanitizeScheme({
        baseHex: entry.baseHex,
        ruleId: entry.ruleId,
        colorCount: entry.colorCount,
        enforceContrast: entry.enforceContrast,
        seed: Date.now(),
      }),
    );
  }, []);

  return {
    state,
    derived,
    setBaseHex,
    setRuleId,
    setColorCount,
    setEnforceContrast,
    randomizeBase,
    shuffle,
    reset,
    assignToken,
    resetOverrides,
    overrideCount: countOverrides(state.overrides),
    saved,
    suggestedName,
    saveCurrent,
    removeSaved,
    applySaved,
    atSavedLimit: saved.length >= MAX_SAVED,
    panel,
    togglePanel,
  };
}