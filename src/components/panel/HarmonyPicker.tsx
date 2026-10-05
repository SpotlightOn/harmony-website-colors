import { getHarmonyRule, HARMONY_RULES, type HarmonyRuleId } from '@/color/harmony';
import { cx } from '@/lib/cx';
import { HarmonyWheel } from './HarmonyWheel';

export interface HarmonyPickerProps {
  value: HarmonyRuleId;
  onChange: (id: HarmonyRuleId) => void;
}

export function HarmonyPicker({ value, onChange }: HarmonyPickerProps) {
  const active = getHarmonyRule(value);

  return (
    <div className="harmonyPicker">
      <ul className="ruleGrid" role="radiogroup" aria-label="Harmony rule">
        {HARMONY_RULES.map((rule) => {
          const selected = rule.id === value;
          return (
            <li key={rule.id}>
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                className={cx('ruleChip', selected && 'isActive')}
                onClick={() => onChange(rule.id)}
                title={rule.description}
              >
                <HarmonyWheel rule={rule} size={30} />
                <span className="ruleChip__label">{rule.label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="harmonyPicker__note">{active.description}</p>
      <p className="harmonyPicker__angles">
        Hue angles: <code>{active.hueOffsets.join('°, ')}°</code>
      </p>
    </div>
  );
}