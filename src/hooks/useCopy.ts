/**
 * Clipboard helper with a transient "copied" flag.
 *
 * Multiple buttons share one hook so that copying the hex of swatch A does not
 * leave the "copied" state stuck on swatch B.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface CopyApi {
  /** Key of the entry that was copied most recently, or `null`. */
  copiedKey: string | null;
  copy: (key: string, text: string) => void;
}

/**
 * Older browsers and any insecure context block the async clipboard API, so keep
 * the classic `execCommand` path as a fallback.
 */
function writeToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).then(
      () => true,
      () => legacyCopy(text),
    );
  }
  return Promise.resolve(legacyCopy(text));
}

function legacyCopy(text: string): boolean {
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export function useCopy(resetAfter = 1600): CopyApi {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(
    (key: string, text: string) => {
      void writeToClipboard(text);
      setCopiedKey(key);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopiedKey(null), resetAfter);
    },
    [resetAfter],
  );

  return { copiedKey, copy };
}