import { readableInkHex } from '@/color/color';
import { ThemeScope } from './ThemeScope';
import { PALETTE_STRIP } from './content';
import type { AccentTheme, Palette } from '@/state/scheme';

export interface PaletteStripProps {
  primary: AccentTheme;
  palette: Palette;
}

/**
 * Paints the raw harmony colors using the indexed `--palette-N` custom
 * properties that the demo root declares.
 *
 * Note that the inline styles here reference variables rather than literal hex
 * values: the actual colors live in CSS, which is the point of the export.
 */
export function PaletteStrip({ primary, palette }: PaletteStripProps) {
  return (
    <ThemeScope
      theme={primary.light}
      className="paletteStrip"
      id="compare"
      aria-labelledby="palette-strip-title"
    >
      <div className="container">
        <header className="sectionHead">
          <p className="eyebrow">{PALETTE_STRIP.eyebrow}</p>
          <h2 className="sectionTitle" id="palette-strip-title">
            {PALETTE_STRIP.title}
          </h2>
          <p className="sectionLead">{PALETTE_STRIP.lead}</p>
        </header>

        <ol className="swatchStrip">
          {palette.swatches.map((swatch) => (
            <li
              key={swatch.index}
              className="swatchStrip__item"
              style={{
                backgroundColor: `var(--palette-${swatch.index + 1})`,
                color: readableInkHex(swatch.hex),
              }}
            >
              <span className="swatchStrip__index">{swatch.index + 1}</span>
              <span className="swatchStrip__name">{swatch.name}</span>
              <code className="swatchStrip__hex">{swatch.hex}</code>
            </li>
          ))}
        </ol>
      </div>
    </ThemeScope>
  );
}