/**
 * A single role token's value, shown as a swatch that can be re-assigned.
 *
 * The point is to make the mapping from variable to color visible and editable in
 * one place. The swatch is the value, the label is the role name, and clicking
 * opens the generated harmony colors so a different one can be picked.
 *
 * The popover renders into a portal on the document body. Inside the panel it
 * would be clipped by the scrolling and rounded containers it lives in, and its
 * paint order would depend on ancestors this component cannot see.
 */

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { normalizeHex } from '@/color/color';
import { cx } from '@/lib/cx';
import type { Swatch } from '@/state/scheme';
import type { RoleToken } from '@/color/theme';

export interface TokenPickerProps {
  role: RoleToken;
  /** Current value, a hex string or an rgba() string. */
  value: string;
  swatches: readonly Swatch[];
  /** Called with the new hex, or with `null` to revert to the derived value. */
  onAssign: (hex: string | null) => void;
  /** True when the value differs from what the generator derived. */
  isOverridden: boolean;
  /** The derived value, used by the revert action. */
  derivedValue: string;
  size?: 'sm' | 'md';
}

/** Swatches need an opaque background, so rgba values get a neutral base. */
function isRgba(value: string): boolean {
  return value.includes('/') || value.startsWith('rgb');
}

const PANEL_WIDTH = 168;
const GAP = 6;

/**
 * Always available, whatever the harmony produced. Pure black and pure white are
 * the two extremes a designer reaches for when a token has to sit at the edge of
 * the range, and they are the one assignment the generated palette can never
 * supply, because no hue step lands on them.
 *
 * The two steps in between are pure greys with no chroma, so they stay neutral
 * rather than picking up a tint from the accent hue. They cover the common middle
 * ground: borders and dividers that need to be visible but must not read as a
 * color.
 */
const NEUTRALS = [
  { name: 'White', hex: '#ffffff' },
  { name: 'Light grey', hex: '#9e9e9e' },
  { name: 'Dark grey', hex: '#4d4d4d' },
  { name: 'Black', hex: '#000000' },
] as const;

/** One assignable color, so the two groups share their markup and behaviour. */
function Option({
  hex,
  name,
  role,
  isCurrent,
  onPick,
  bordered = false,
}: {
  hex: string;
  name: string;
  role: RoleToken;
  isCurrent: boolean;
  onPick: (hex: string) => void;
  /** White and black need an inner border to be visible on a light panel. */
  bordered?: boolean;
}) {
  return (
    <button
      type="button"
      className={cx('tokenPicker__option', isCurrent && 'isCurrent')}
      style={{ backgroundColor: hex, ...(bordered ? { boxShadow: 'inset 0 0 0 1px var(--border-strong)' } : {}) }}
      onClick={() => onPick(hex)}
      title={`${name} ${hex}`}
    >
      <span className="visually-hidden">
        Use {name}, {hex}, for --{role}
      </span>
    </button>
  );
}

export function TokenPicker({
  role,
  value,
  swatches,
  onAssign,
  isOverridden,
  derivedValue,
  size = 'sm',
}: TokenPickerProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  // Place the popover next to the chip, flipping when it would leave the viewport.
  useLayoutEffect(() => {
    if (!open) return;

    const place = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      if (!anchor) return;

      const height = panelRef.current?.offsetHeight ?? 120;
      const below = window.innerHeight - anchor.bottom;
      const flip = below < height + GAP && anchor.top > height + GAP;

      setPosition({
        top: flip ? anchor.top - height - GAP : anchor.bottom + GAP,
        left: Math.min(
          Math.max(GAP, anchor.left),
          window.innerWidth - PANEL_WIDTH - GAP,
        ),
      });
    };

    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  // Close on Escape or a click outside, and move focus into the popover so the
  // keyboard path works without a full focus trap.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      anchorRef.current?.focus();
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    panelRef.current?.querySelector<HTMLButtonElement>('button')?.focus();

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const current = normalizeHex(value);
  const derived = normalizeHex(derivedValue);

  /** Assign a color, close, and return focus to the chip that opened the popover. */
  const pick = (hex: string) => {
    onAssign(hex);
    setOpen(false);
    anchorRef.current?.focus();
  };

  return (
    <>
      <button
        type="button"
        ref={anchorRef}
        className={cx('tokenPicker__chip', isOverridden && 'isOverridden', `is-${size}`)}
        onClick={() => setOpen((state) => !state)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        title={`--${role}: ${value}${isOverridden ? ' (set by hand)' : ''}`}
      >
        <span
          className="tokenPicker__swatch"
          style={
            isRgba(value)
              ? { backgroundImage: `linear-gradient(${value}, ${value})` }
              : { backgroundColor: value }
          }
          aria-hidden="true"
        />
        <code className="tokenPicker__name">--{role}</code>
      </button>

      {open
        ? createPortal(
            <div
              className="tokenPicker__panel"
              ref={panelRef}
              id={panelId}
              role="dialog"
              aria-label={`Assign a color to --${role}`}
              style={{
                position: 'fixed',
                top: position?.top ?? -9999,
                left: position?.left ?? -9999,
                visibility: position === null ? 'hidden' : 'visible',
              }}
            >
              <span className="tokenPicker__panelHead">
                <code>--{role}</code>
                <span className="tokenPicker__current">{current ?? value}</span>
              </span>

              <span className="tokenPicker__group">
                <span className="tokenPicker__groupLabel">Harmony colors</span>
                <span className="tokenPicker__grid">
                  {swatches.map((swatch) => (
                    <Option
                      key={swatch.index}
                      hex={swatch.hex}
                      name={swatch.name}
                      role={role}
                      isCurrent={swatch.hex === current}
                      onPick={pick}
                    />
                  ))}
                </span>
              </span>

              {/*
                White and black are always offered. They are not harmony colors,
                so they sit in their own group instead of pretending to be part of
                the scheme.
              */}
              <span className="tokenPicker__group">
                <span className="tokenPicker__groupLabel">Neutrals</span>
                <span className="tokenPicker__grid">
                  {NEUTRALS.map((neutral) => (
                    <Option
                      key={neutral.hex}
                      hex={neutral.hex}
                      name={neutral.name}
                      role={role}
                      isCurrent={neutral.hex === current}
                      onPick={pick}
                      bordered
                    />
                  ))}
                </span>
              </span>

              {isOverridden ? (
                <button
                  type="button"
                  className="tokenPicker__revert"
                  onClick={() => {
                    onAssign(null);
                    setOpen(false);
                    anchorRef.current?.focus();
                  }}
                >
                  Revert to <code>{derived ?? 'generated'}</code>
                </button>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}