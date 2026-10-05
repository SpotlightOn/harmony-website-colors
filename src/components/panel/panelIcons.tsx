/**
 * Icons for the panel collapse control.
 *
 * These follow the widely used `panel-left-close` / `panel-left-open` pattern, so
 * the glyph means what it looks like: a framed panel with a filled sidebar band,
 * plus a chevron pointing the way the panel travels.
 *
 * Size and stroke weight matter here. At 16px with a 1.75 stroke on a 24 grid the
 * chevron rendered about one pixel wide and read as a smudge, which made the
 * control look decorative. These render at 20px with a 2 stroke.
 */

interface IconProps {
  size?: number;
  className?: string;
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: 'false' as const,
});

const FRAME = { x: 3, y: 4, width: 18, height: 16, rx: 2.5 };
const DIVIDER = 'M9.5 4v16';

/**
 * Sidebar is visible. Filled band marks where the panel sits, chevron points left
 * because that is the direction it goes.
 */
export function PanelCloseIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect {...FRAME} />
      <path d={DIVIDER} />
      {/* Sidebar band, thick enough to read as an area rather than a rule. */}
      <path d="M6.25 8.5v7" strokeWidth="3" />
      <path d="m16.75 14.75-3.25-3.25 3.25-3.25" />
    </svg>
  );
}

/** Sidebar is hidden. The band goes empty and the chevron points back out. */
export function PanelOpenIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect {...FRAME} />
      <path d={DIVIDER} />
      <path d="m13.75 9.25 3.25 3.25-3.25 3.25" />
    </svg>
  );
}