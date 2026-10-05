import { MAX_COLOR_COUNT, MIN_COLOR_COUNT } from '@/color/palette';

export interface ColorCountSliderProps {
  value: number;
  onChange: (value: number) => void;
}

export function ColorCountSlider({ value, onChange }: ColorCountSliderProps) {
  return (
    <div className="countField">
      <div className="countField__head">
        <label className="fieldLabel" htmlFor="color-count">
          Number of colors
        </label>
        <output className="countField__value" htmlFor="color-count">
          {value}
        </output>
      </div>

      <input
        id="color-count"
        className="range"
        type="range"
        min={MIN_COLOR_COUNT}
        max={MAX_COLOR_COUNT}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />

      <div className="countField__ticks" aria-hidden="true">
        <span>{MIN_COLOR_COUNT}</span>
        <span>{MAX_COLOR_COUNT}</span>
      </div>
    </div>
  );
}