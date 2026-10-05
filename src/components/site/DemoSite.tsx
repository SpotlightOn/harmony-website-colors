/**
 * The demo page.
 *
 * This is the actual test of the token contract: the markup below is written once
 * and rendered through every scheme the generator can produce. No component knows
 * which color it is being shown in.
 */

import type { CSSProperties } from 'react';
import { paletteToStyle } from '@/color/css-vars';
import { HeroSection } from './HeroSection';
import { PaletteStrip } from './PaletteStrip';
import { ProseSection } from './ProseSection';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';
import { TeaserSection } from './TeaserSection';
import { VariantSection } from './VariantSection';
import type { DerivedScheme } from '@/state/scheme';

export interface DemoSiteProps {
  derived: DerivedScheme;
}

/**
 * Render the section plan that comes out of the state.
 *
 * The page deliberately does not build this list itself: the audit edits exactly
 * the accents and tones listed here, so deriving the plan in one place is what
 * guarantees every editable value has a surface that shows it.
 */
export function DemoSite({ derived }: DemoSiteProps) {
  const { palette, primary, secondary, sections } = derived;

  return (
    // The indexed --palette-N tokens are declared once, on the page root.
    <div
      className="demoSite"
      style={paletteToStyle(palette) as CSSProperties}
      data-colors={palette.swatches.length}
    >
      <SiteHeader primary={primary} />

      <main id="main" className="demoSite__main">
        <HeroSection primary={primary} />
        <TeaserSection secondary={secondary} />
        <ProseSection primary={primary} />

        {sections.map((section) => (
          <VariantSection
            key={section.key}
            accent={section.accent}
            variant={section.variant}
            accentIndex={section.accentIndex}
            position={section.position}
            total={sections.length}
          />
        ))}

        <PaletteStrip primary={primary} palette={palette} />
      </main>

      <SiteFooter primary={primary} />
    </div>
  );
}