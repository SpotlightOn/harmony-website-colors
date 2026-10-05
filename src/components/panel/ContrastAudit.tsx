import { useMemo, useState } from 'react';
import { formatRatio } from '@/color/color';
import { ROLE_TOKENS, type ContrastCheck, type RoleToken, type ThemeResult, type Variant } from '@/color/theme';
import { cx } from '@/lib/cx';
import type { AccentTheme, SectionPlan, Swatch } from '@/state/scheme';
import { TokenPicker } from './TokenPicker';

export interface ContrastAuditProps {
  accents: AccentTheme[];
  /**
   * The page's own section list, so selecting an accent can point at the section
   * that actually renders it.
   */
  sections: readonly SectionPlan[];
  /** Mirrors the solver setting, so the footnote can explain what it did. */
  enforceContrast: boolean;
  /** Manual edits, keyed by `accentIndex|variant|role`. */
  overrides: Record<string, string>;
  onAssign: (
    accentIndex: number,
    variant: Variant,
    role: RoleToken,
    hex: string | null,
  ) => void;
  onResetOverrides: () => void;
  /** Every harmony color, offered as an assignment candidate. */
  palette: readonly Swatch[];
}

/**
 * The WCAG 2.2 audit for every theme the page renders.
 *
 * Both variants are audited for every harmony color, which is a lot of pairs, so
 * the panel exposes one selector for the accent and one for the variant instead of
 * printing a wall of rows.
 */
export function ContrastAudit({
  accents,
  sections,
  enforceContrast,
  overrides,
  onAssign,
  onResetOverrides,
  palette,
}: ContrastAuditProps) {
  /*
   * The panel selects a section, not an accent and a tone independently.
   *
   * The two were separate pieces of state, which let the panel address a
   * combination the page never mounted: the demo renders one tone per harmony
   * color, so half the accent/tone pairs the audit offered had no surface and an
   * assignment to one of them changed nothing anywhere. Selecting from the page's
   * own section list makes that state unrepresentable rather than merely unlikely.
   */
  const [sectionKey, setSectionKey] = useState<string | null>(null);

  // Keep the selection pointing at something that exists when the palette changes.
  const section = useMemo(() => {
    const found = sections.find((entry) => entry.key === sectionKey);
    return found ?? sections[0];
  }, [sections, sectionKey]);

  // A visible accent/tone pair has exactly one section, because the page renders
  // each harmony color once per tone.
  const sectionsForAccent = useMemo(
    () => new Map(accents.map((_, index) => [index, sections.filter((s) => s.accentIndex === index)])),
    [accents, sections],
  );

  /*
   * Select a section and bring it into view.
   *
   * Clicking an accent is a navigation intent, so act on it. Without the scroll the
   * swatch row looked like a palette that had stopped responding: the selection
   * moved, the list below changed, and the page did not.
   */
  const select = (next: SectionPlan) => {
    setSectionKey(next.key);
    document
      .getElementById(`variant-${next.position}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (!section) {
    return null;
  }

  const { accentIndex, variant } = section;

  /*
   * The accent comes from the section rather than from `accents[accentIndex]`.
   * The section already carries it, so this cannot disagree with the theme the
   * list is about to show — which was the whole point of selecting sections.
   */
  const accent = section.accent;
  const result: ThemeResult = accent[variant];
  const passing = result.checks.filter((check) => check.pass).length;

  /*
   * Per-accent edit counts. Overrides are keyed by accent and tone, so a count for
   * the whole accent has to include both of its tones, otherwise an edit made on
   * the dark section appears to vanish when the light one is selected.
   */
  const editsByAccent = useMemo(() => {
    const counts = new Map<number, number>();

    for (const key of Object.keys(overrides)) {
      const [accent, tone] = key.split('|');
      const index = Number(accent);

      if (Number.isInteger(index) && tone) {
        counts.set(index, (counts.get(index) ?? 0) + 1);
      }
    }

    return counts;
  }, [overrides]);

  const editedCount = Object.keys(overrides).length;

  return (
    <div className="audit">
      <div className="audit__status">
        <span className={cx('auditBadge', result.passes ? 'isPass' : 'isFail')}>
          {result.passes ? 'AA · all pass' : `${result.checks.length - passing} failing`}
        </span>
        <span className="audit__count">
          {passing}/{result.checks.length} pairs
        </span>
      </div>

      {/* Say what the row is: it selects which rendered section is being inspected. */}
      <p className="audit__scope">
        Section {section.position} of {sections.length} · accent {accentIndex + 1} of{' '}
        {accents.length} · {variant}
      </p>

      <div className="segmented">
        <div className="segmented__group" role="group" aria-label="Tone to audit">
          {(['light', 'dark'] as const).map((key) => {
            const target = sectionsForAccent.get(accentIndex)?.find((s) => s.variant === key);

            return target ? (
              <button
                type="button"
                key={key}
                className={cx('segmented__item', variant === key && 'isActive')}
                onClick={() => select(target)}
                aria-pressed={variant === key}
              >
                {key}
              </button>
            ) : null;
          })}
        </div>

        <div className="segmented__group" role="group" aria-label="Section to audit">
          {accents.map((entry, index) => {
            const target = sectionsForAccent.get(index)?.[0];
            const edits = editsByAccent.get(index) ?? 0;

            return (
              <button
                type="button"
                key={entry.swatch.index}
                className={cx('segmented__item isSwatch', accentIndex === index && 'isActive')}
                style={{ backgroundColor: entry.swatch.hex }}
                onClick={() => target && select(target)}
                aria-pressed={accentIndex === index}
                aria-label={`Accent ${index + 1}, ${entry.swatch.hex}${
                  edits > 0 ? `, ${edits} manual ${edits === 1 ? 'edit' : 'edits'}` : ''
                }`}
                title={`${entry.swatch.hex}${edits > 0 ? ` · ${edits} edited` : ''}`}
              >
                {/* An edit on one tone has to stay visible when the other is shown. */}
                {edits > 0 ? <span className="segmented__dot" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      </div>

      <ul className="auditList">
        {result.checks.map((check) => (
          <AuditRow
            key={check.id}
            check={check}
            accent={accent}
            accentIndex={accentIndex}
            variant={variant}
            overrides={overrides}
            onAssign={onAssign}
            palette={palette}
          />
        ))}
      </ul>

      <TokenGrid
        accent={accent}
        accentIndex={accentIndex}
        variant={variant}
        overrides={overrides}
        onAssign={onAssign}
        palette={palette}
      />

      {editedCount > 0 ? (
        <div className="audit__overrides">
          <span>
            {editedCount} manual {editedCount === 1 ? 'edit' : 'edits'}{' '}
            {editedCount === 1 ? 'overrides' : 'override'} the generated values.
          </span>
          <button type="button" className="audit__reset" onClick={onResetOverrides}>
            Reset all
          </button>
        </div>
      ) : null}

      <ContrastFootnote result={result} enforceContrast={enforceContrast} />
    </div>
  );
}

/**
 * One audited pair.
 *
 * The fg token carries a swatch so its mapping from variable to color is visible,
 * and clicking it opens the generated palette. The bg token is shown as text only:
 * it is usually the page itself, and offering two pickers per row would make the
 * list unreadable.
 */
function AuditRow({
  check,
  accent,
  accentIndex,
  variant,
  overrides,
  onAssign,
  palette,
}: {
  check: ContrastCheck;
  accent: AccentTheme;
  accentIndex: number;
  variant: Variant;
  overrides: Record<string, string>;
  onAssign: ContrastAuditProps['onAssign'];
  palette: readonly Swatch[];
}) {
  const theme = accent[variant].theme;
  const derived = accent[variant].derived;

  return (
    <li className="auditRow">
      <span className="auditRow__body">
        <span className="auditRow__label">{check.label}</span>
        <span className="auditRow__tokens">
          <TokenPicker
            role={check.fg}
            value={theme[check.fg]}
            derivedValue={derived[check.fg]}
            swatches={palette}
            isOverridden={overrides[`${accentIndex}|${variant}|${check.fg}`] !== undefined}
            onAssign={(hex) => onAssign(accentIndex, variant, check.fg, hex)}
          />
          <span className="auditRow__on">on</span>
          <span
            className="auditRow__bgSwatch"
            style={{ backgroundColor: theme[check.bg] }}
            title={`--${check.bg}: ${theme[check.bg]}`}
            aria-hidden="true"
          />
          <code>--{check.bg}</code>
        </span>
      </span>
      <span
        className={cx('auditRow__ratio', check.pass ? 'isPass' : 'isFail')}
        title={`${check.criterion} · needs ${check.required}:1`}
      >
        {formatRatio(check.ratio)}
      </span>
    </li>
  );
}

/**
 * All nineteen roles for the selected theme, so the full mapping is visible and
 * reachable rather than only the subset that happens to be audited.
 */
function TokenGrid({
  accent,
  accentIndex,
  variant,
  overrides,
  onAssign,
  palette,
}: {
  accent: AccentTheme;
  accentIndex: number;
  variant: Variant;
  overrides: Record<string, string>;
  onAssign: ContrastAuditProps['onAssign'];
  palette: readonly Swatch[];
}) {
  const theme = accent[variant].theme;
  const derived = accent[variant].derived;

  return (
    <details className="tokenGrid">
      <summary className="tokenGrid__summary">
        All {ROLE_TOKENS.length} variables
        <span className="tokenGrid__count">click to reassign</span>
      </summary>

      <ul className="tokenGrid__list">
        {ROLE_TOKENS.map((role) => (
          <li className="tokenGrid__item" key={role}>
            <TokenPicker
              role={role}
              value={theme[role]}
              derivedValue={derived[role]}
              swatches={palette}
              isOverridden={overrides[`${accentIndex}|${variant}|${role}`] !== undefined}
              onAssign={(hex) => onAssign(accentIndex, variant, role, hex)}
              size="md"
            />
          </li>
        ))}
      </ul>
    </details>
  );
}

function ContrastFootnote({
  result,
  enforceContrast,
}: {
  result: ThemeResult;
  enforceContrast: boolean;
}) {
  if (!enforceContrast) {
    const failing = result.checks.length - result.checks.filter((check) => check.pass).length;
    return (
      <p className="audit__footnote">
        Enforcement is off, so the aesthetic values are shown unchanged.{' '}
        {failing === 0
          ? 'Every pair happens to pass anyway.'
          : `${failing} ${failing === 1 ? 'pair is' : 'pairs are'} below target.`}
      </p>
    );
  }

  if (result.adjusted.length === 0) {
    return (
      <p className="audit__footnote">
        Nothing needed adjusting: the aesthetic starting points already cleared every
        target.
      </p>
    );
  }

  return (
    <p className="audit__footnote">
      Solver moved {result.adjusted.length} role
      {result.adjusted.length === 1 ? '' : 's'} to reach the target:{' '}
      {result.adjusted.map((token) => (
        <code key={token}>--{token}</code>
      ))}
    </p>
  );
}

