/**
 * Vector logo for the demo site.
 *
 * Three dots on a ring at 120 degrees: a triadic harmony drawn in the smallest
 * possible number of shapes. It recolors with the theme because it is drawn with
 * `currentColor` and the accent role token.
 */

export interface LogoProps {
  /** Diameter in pixels. */
  size?: number;
  className?: string;
}

export function Logo({ size = 34, className }: LogoProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle
        cx="20"
        cy="20"
        r="16"
        stroke="currentColor"
        strokeWidth="1.25"
        opacity="0.3"
        strokeDasharray="2.5 3.5"
      />
      <circle cx="20" cy="4" r="4.25" fill="var(--accent)" />
      <circle cx="6.14" cy="28" r="4.25" fill="currentColor" opacity="0.45" />
      <circle cx="33.86" cy="28" r="4.25" fill="currentColor" opacity="0.45" />
      <circle cx="20" cy="20" r="5" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}