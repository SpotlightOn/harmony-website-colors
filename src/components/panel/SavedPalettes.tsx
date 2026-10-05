import { useMemo } from 'react';
import { getHarmonyRule } from '@/color/harmony';
import { buildPalette } from '@/color/palette';
import type { SavedScheme } from '@/state/storage';
import { BookmarkIcon, TrashIcon } from './icons';

export interface SavedPalettesProps {
  entries: SavedScheme[];
  atLimit: boolean;
  onSave: () => void;
  onRemove: (id: string) => void;
  onApply: (entry: SavedScheme) => void;
  onCopyLink: () => void;
  linkCopied: boolean;
}

/**
 * Palettes the user chose to keep, in localStorage.
 *
 * Each entry previews with its own freshly generated strip rather than a stored
 * image, so an old entry stays accurate even if the derivation rules change.
 */
export function SavedPalettes({
  entries,
  atLimit,
  onSave,
  onRemove,
  onApply,
  onCopyLink,
  linkCopied,
}: SavedPalettesProps) {
  const previews = useMemo(
    () =>
      entries.map((entry) => ({
        entry,
        swatches: buildPalette(entry.baseHex, entry.ruleId, entry.colorCount).swatches,
        ruleLabel: getHarmonyRule(entry.ruleId).label,
      })),
    [entries],
  );

  return (
    <div className="saved">
      <div className="saved__actions">
        <button
          type="button"
          className="btn btn--solid btn--sm"
          onClick={onSave}
          disabled={atLimit}
        >
          <BookmarkIcon size={14} />
          {linkCopied ? 'Link copied' : 'Save current'}
        </button>
        <button type="button" className="btn btn--quiet btn--sm" onClick={onCopyLink}>
          Copy share link
        </button>
      </div>

      {atLimit ? (
        <p className="saved__limit">Storage limit reached. Delete one to save another.</p>
      ) : null}

      {previews.length === 0 ? (
        <p className="saved__empty">
          Nothing saved yet. Combinations worth keeping can be stored here and reloaded
          later — they stay in this browser.
        </p>
      ) : (
        <ul className="savedList">
          {previews.map(({ entry, swatches, ruleLabel }) => (
            <li className="savedCard" key={entry.id}>
              <button
                type="button"
                className="savedCard__load"
                onClick={() => onApply(entry)}
                title={`Load ${entry.name}`}
              >
                <span className="savedCard__strip" aria-hidden="true">
                  {swatches.map((swatch) => (
                    <span key={swatch.index} style={{ backgroundColor: swatch.hex }} />
                  ))}
                </span>
                <span className="savedCard__text">
                  <span className="savedCard__name">{entry.name}</span>
                  <span className="savedCard__meta">
                    {entry.baseHex} · {ruleLabel} · {swatches.length}
                  </span>
                </span>
              </button>

              <button
                type="button"
                className="savedCard__remove"
                onClick={() => onRemove(entry.id)}
                aria-label={`Delete ${entry.name}`}
                title="Delete"
              >
                <TrashIcon size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}