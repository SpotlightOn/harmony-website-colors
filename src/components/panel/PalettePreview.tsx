import { readableInkHex } from '@/color/color';
import { cx } from '@/lib/cx';
import type { AccentTheme } from '@/state/scheme';
import { CheckIcon, CopyIcon } from './icons';

export interface PalettePreviewProps {
  accents: AccentTheme[];
  /** Remount key: the grid re-animates when the scheme identity changes. */
  animationKey: string;
  copiedKey: string | null;
  onCopy: (key: string, text: string) => void;
}

/**
 * Tile preview of the generated colors.
 *
 * Each tile shows three things: the raw harmony color, how that color behaves as
 * an accent on a light surface, and how it behaves on a dark one.
 */
export function PalettePreview({ accents, animationKey, copiedKey, onCopy }: PalettePreviewProps) {
  return (
    <ul className="paletteGrid" key={animationKey}>
      {accents.map(({ swatch, light, dark }) => {
        const key = `swatch-${swatch.hex}`;
        const copied = copiedKey === key;

        return (
          <li key={swatch.index}>
            <button
              type="button"
              className="swatchTile"
              onClick={() => onCopy(key, swatch.hex)}
              title={`Copy ${swatch.hex}`}
            >
              <span
                className="swatchTile__color"
                style={{
                  backgroundColor: swatch.hex,
                  color: readableInkHex(swatch.hex),
                }}
              >
                <span className="swatchTile__index">{swatch.index + 1}</span>
                <span className="swatchTile__name">{swatch.name}</span>
              </span>

              <span className="swatchTile__sample" aria-hidden="true">
                <span
                  className="swatchTile__surface"
                  style={{
                    backgroundColor: light.theme.surface,
                    borderColor: light.theme.border,
                  }}
                >
                  <span
                    className="swatchTile__dot"
                    style={{ backgroundColor: light.theme.accent }}
                  />
                  <span
                    className="swatchTile__bar"
                    style={{ backgroundColor: light.theme['text-muted'] }}
                  />
                </span>
                <span
                  className="swatchTile__surface"
                  style={{
                    backgroundColor: dark.theme.surface,
                    borderColor: dark.theme.border,
                  }}
                >
                  <span
                    className="swatchTile__dot"
                    style={{ backgroundColor: dark.theme.accent }}
                  />
                  <span
                    className="swatchTile__bar"
                    style={{ backgroundColor: dark.theme['text-muted'] }}
                  />
                </span>
              </span>

              <span className="swatchTile__foot">
                <code className="swatchTile__hex">{swatch.hex}</code>
                <span className={cx('swatchTile__copy', copied && 'isCopied')}>
                  {copied ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}