/**
 * Miniature polar plot of a harmony rule.
 *
 * Angle is the hue rotation, radius is the lightness shift. That makes one
 * drawing work for hue-based rules and for monochromatic ones, which have no hue
 * rotation at all and would otherwise collapse to a single dot.
 */

import { clamp } from '@/color/color';
import type { HarmonyRule } from '@/color/harmony';

const CENTER = 20;
const MIN_RADIUS = 4.5;
const MAX_RADIUS = 15.5;

/** Largest lightness shift any rule uses, used to normalize the radius. */
const SHIFT_RANGE = 0.3;

export interface HarmonyWheelProps {
  rule: HarmonyRule;
  size?: number;
}

export function HarmonyWheel({ rule, size = 34 }: HarmonyWheelProps) {
  const points = rule.stops.map((stop, index) => {
    // A positive shift means lighter, which should sit closer to the center.
    const normalized = clamp(0.5 - stop.lightnessShift / (SHIFT_RANGE * 2), 0, 1);
    const radius = MIN_RADIUS + normalized * (MAX_RADIUS - MIN_RADIUS);
    const angle = ((stop.hueOffset - 90) * Math.PI) / 180;

    return {
      key: `${rule.id}-${index}`,
      x: CENTER + Math.cos(angle) * radius,
      y: CENTER + Math.sin(angle) * radius,
      emphasis: index === 0 ? 1 : 0.5,
    };
  });

  return (
    <svg
      className="harmonyWheel"
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx={CENTER} cy={CENTER} r={MAX_RADIUS} fill="none" stroke="currentColor" opacity="0.22" />
      <circle cx={CENTER} cy={CENTER} r={MIN_RADIUS} fill="none" stroke="currentColor" opacity="0.22" />

      {points.slice(1).map((point) => (
        <line
          key={`spoke-${point.key}`}
          x1={CENTER}
          y1={CENTER}
          x2={point.x}
          y2={point.y}
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.28"
        />
      ))}

      {points.map((point) => (
        <circle
          key={point.key}
          cx={point.x}
          cy={point.y}
          r={point.emphasis === 1 ? 3.4 : 2.6}
          fill="currentColor"
          opacity={point.emphasis}
        />
      ))}
    </svg>
  );
}