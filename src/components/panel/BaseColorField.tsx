import { useEffect, useState } from 'react';
import { normalizeHex } from '@/color/color';
import { cx } from '@/lib/cx';
import { BASE_PRESETS } from '@/state/scheme';
import { DiceIcon } from './icons';

export interface BaseColorFieldProps {
  value: string;
  onChange: (hex: string) => void;
  onRandomize: () => void;
}

/**
 * Base color input: a native color well, a hex field that accepts sloppy input,
 * a randomize button and a row of presets.
 */
export function BaseColorField({ value, onChange, onRandomize }: BaseColorFieldProps) {
  // Keep a local draft so partially typed hex values are not overwritten mid-word.
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = () => {
    const normalized = normalizeHex(draft);
    if (normalized === null) {
      setDraft(value);
      return;
    }
    setDraft(normalized);
    onChange(normalized);
  };

  return (
    <div className="baseField">
      {/* The panel section heading already names this field. */}
      <label className="visually-hidden" htmlFor="base-hex">
        Base color hex value
      </label>

      <div className="baseField__row">
        <div className="colorWell" style={{ backgroundColor: value }}>
          <input
            type="color"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            aria-label="Pick a base color"
          />
        </div>

        <input
          id="base-hex"
          className="hexInput"
          value={draft}
          spellCheck={false}
          autoComplete="off"
          inputMode="text"
          aria-label="Base color hex value"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            }
            if (event.key === 'Escape') {
              setDraft(value);
              event.currentTarget.blur();
            }
          }}
        />

        <button type="button" className="iconBtn" onClick={onRandomize} title="Random base color">
          <DiceIcon />
          <span className="visually-hidden">Random base color</span>
        </button>
      </div>

      {/* Fixed starting points. They never change, which is why they are labeled:
          the strip reads as a legend rather than as part of the live palette. */}
      <div className="presetRow">
        <span className="presetRow__label" id="presets-label">
          Presets
        </span>
        <div className="presetRow__chips" role="group" aria-labelledby="presets-label">
          {BASE_PRESETS.map((preset) => {
            const active = preset.toLowerCase() === value.toLowerCase();
            return (
              <button
                type="button"
                key={preset}
                className={cx('presetChip', active && 'isActive')}
                style={{ backgroundColor: preset }}
                onClick={() => onChange(preset)}
                aria-label={`Use base color ${preset}`}
                aria-pressed={active}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}