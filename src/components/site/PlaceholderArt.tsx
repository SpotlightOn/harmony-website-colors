/**
 * Generated placeholder artwork.
 *
 * Real photography would fight the color scheme, so the demo uses abstract SVG
 * compositions drawn entirely from theme role tokens. That keeps the imagery in
 * the same palette as everything around it, and means a single component covers
 * every scheme without a single hard-coded color.
 */

import { useId, useMemo } from 'react';
import { cx } from '@/lib/cx';

/** Small deterministic PRNG so a given seed always yields the same artwork. */
function seededRandom(seed: number): () => number {
  let state = (seed + 0x6d2b79f5) >>> 0;
  return () => {
    state = Math.imul(state ^ (state >>> 15), state | 1) >>> 0;
    state ^= state + Math.imul(state ^ (state >>> 7), state | 61);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
}

const WIDTH = 320;
const HEIGHT = 200;

export interface PlaceholderArtProps {
  seed: number;
  className?: string;
  /** Accessible description. Omit for purely decorative use. */
  alt?: string;
}

export function PlaceholderArt({ seed, className, alt }: PlaceholderArtProps) {
  // Gradient ids must be unique per instance, otherwise several artworks on one
  // page resolve each other's gradients.
  const gradientId = useId().replace(/[^a-zA-Z0-9-]/g, '');

  const shapes = useMemo(() => {
    const random = seededRandom(seed * 2654435761);

    return {
      blobs: Array.from({ length: 3 }, (_, index) => ({
        key: `blob-${index}`,
        cx: Math.round(random() * WIDTH),
        cy: Math.round(random() * HEIGHT),
        r: Math.round(48 + random() * 82),
        opacity: Number((0.1 + random() * 0.22).toFixed(3)),
      })),
      arcRadius: Math.round(70 + random() * 46),
      arcRotation: Math.round(random() * 90),
      barWidth: Math.round(40 + random() * 90),
    };
  }, [seed]);

  return (
    <svg
      className={cx('art', className)}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="xMidYMid slice"
      role={alt === undefined ? 'presentation' : 'img'}
      aria-label={alt}
      aria-hidden={alt === undefined ? true : undefined}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.95" />
          <stop offset="100%" stopColor="var(--text-strong)" stopOpacity="0.9" />
        </linearGradient>
      </defs>

      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.95" />
          {/*
            The second stop is the second harmony color, not a shade of the first.
            That is the whole point: the artwork should show the harmony rather
            than one hue in nineteen values.
          */}
          <stop offset="100%" stopColor="var(--accent-alt)" stopOpacity="0.9" />
        </linearGradient>
      </defs>

      <rect width={WIDTH} height={HEIGHT} fill={`url(#${gradientId})`} />

      {shapes.blobs.map((blob) => (
        <circle
          key={blob.key}
          cx={blob.cx}
          cy={blob.cy}
          r={blob.r}
          fill="var(--surface-raised)"
          opacity={blob.opacity}
        />
      ))}

      <circle
        cx={WIDTH * 0.72}
        cy={HEIGHT * 0.34}
        r={shapes.arcRadius}
        fill="none"
        stroke="var(--surface-raised)"
        strokeWidth="14"
        opacity="0.28"
        strokeDasharray="26 18"
        transform={`rotate(${shapes.arcRotation} ${WIDTH * 0.72} ${HEIGHT * 0.34})`}
      />

      <rect
        x={WIDTH - shapes.barWidth - 26}
        y={HEIGHT - 30}
        width={shapes.barWidth}
        height="6"
        rx="3"
        fill="var(--surface-raised)"
        opacity="0.5"
      />
    </svg>
  );
}