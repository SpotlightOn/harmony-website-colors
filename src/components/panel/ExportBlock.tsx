import { useEffect, useMemo, useRef, useState } from 'react';
import {
  checkContract,
  DEFAULT_EXPORT_OPTIONS,
  paletteToCss,
  paletteToJson,
  paletteToTailwind,
  resolveExportThemes,
  tokenReference,
  type ExportOptions,
  type ScopeKind,
} from '@/color/css-vars';
import type { DerivedScheme } from '@/state/scheme';
import {
  NOTOR_DUOTONE,
  NOTOR_GRADIENTS,
  NOTOR_PALETTE,
  serializeVariation,
  variationSlug,
  wordpressVariation,
} from '@/color/wordpress';
import { cx } from '@/lib/cx';
import { CheckIcon, CopyIcon } from './icons';

export interface ExportBlockProps {
  derived: DerivedScheme;
  copiedKey: string | null;
  onCopy: (key: string, text: string) => void;
}

const SCOPES: ReadonlyArray<{ id: ScopeKind; label: string; hint: string }> = [
  { id: 'global', label: 'Global', hint: ':root and :root[data-tone="dark"]' },
  { id: 'class', label: 'Class', hint: '.theme-… on any element' },
  { id: 'attribute', label: 'Attribute', hint: '[data-theme="…"] on any element' },
];

/** Round a byte count the way a download dialog would. */
const fileSize = (text: string): string =>
  text.length < 1024 ? `${text.length} B` : `${(text.length / 1024).toFixed(1)} kB`;

const WP_COPY_KEY = 'export-wordpress';

/**
 * WordPress style variation export.
 *
 * Kept separate from the stylesheet export because it answers a different question.
 * A WordPress theme variation replaces *values* in a theme that already declares its
 * own slugs, so the scope, slug and invariant options above have nothing to act on:
 * there is one brand color, and every block in the theme already references the
 * theme's own preset names.
 */
function WordPressExport({
  derived,
  copiedKey,
  onCopy,
}: {
  derived: DerivedScheme;
  copiedKey: string | null;
  onCopy: (key: string, text: string) => void;
}) {
  const [titleOverride, setTitleOverride] = useState<string | null>(null);

  /*
   * Light only, on purpose. The theme's sections encode absolute lightness rather
   * than roles — `section-ink` fills with `ink` expecting it to be the darkest color
   * in the palette — so a dark scheme turns that section white and leaves its link
   * color at 1.55:1. There is no honest dark variation of this theme, so no toggle is
   * offered.
   */
  const theme = derived.primary.light;
  const title = titleOverride ?? derived.label;

  const json = useMemo(
    () => serializeVariation(wordpressVariation(theme, { title })),
    [theme, title],
  );

  const filename = `styles/${variationSlug(title)}.json`;

  return (
    <details className="wpExport">
      <summary className="wpExport__summary">
        WordPress theme.json
        <span className="wpExport__badge">{NOTOR_PALETTE.length} presets</span>
      </summary>

      <p className="export__hint">
        A style variation for a block theme. Save it as <code>{filename}</code> in the
        theme&rsquo;s <code>styles/</code> directory; it appears in the Site Editor under
        Appearance &rarr; Styles. It re-colors the primary accent and keeps the
        theme&rsquo;s own preset slugs, so its blocks and templates follow along.
      </p>

      <div className="export__slug">
        <div className="export__slugHead">
          <span className="export__slugLabel" id="wp-title-label">
            Style name
          </span>
          {titleOverride !== null ? (
            <button
              type="button"
              className="export__slugReset"
              onClick={() => setTitleOverride(null)}
            >
              Reset
            </button>
          ) : null}
        </div>
        <input
          className="hexInput"
          value={title}
          spellCheck={false}
          autoComplete="off"
          aria-labelledby="wp-title-label"
          onChange={(event) => setTitleOverride(event.target.value)}
        />
      </div>

      <p className="export__hint">
        Slot mapping: brand &larr; <code>{derived.primary.swatch.hex}</code>, accent
        &larr; second harmony color, base &larr; surface, ink &larr; text-strong.{' '}
        {NOTOR_GRADIENTS.length} gradients and {NOTOR_DUOTONE.length} duotones are
        rebuilt from the same palette. The two light slots are solved as readable tints
        rather than lifted from the scheme, and the shadow presets are re-tinted so no
        shadow keeps the old ink.
      </p>

      <pre className="export__preview" tabIndex={0} aria-label="WordPress variation preview">
        <code>{json}</code>
      </pre>

      <div className="export__meta">
        <span>{filename}</span>
        <span>{fileSize(json)}</span>
      </div>

      <div className="export__buttons">
        <button
          type="button"
          className="btn btn--solid btn--sm"
          onClick={() => onCopy(WP_COPY_KEY, json)}
        >
          {copiedKey === WP_COPY_KEY ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
          Copy theme.json
        </button>
      </div>
    </details>
  );
}

export function ExportBlock({ derived, copiedKey, onCopy }: ExportBlockProps) {
  const [options, setOptions] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS);

  /*
   * The scope name tracks the current scheme until the user edits it, so a shuffle
   * does not leave the export referring to a color that is no longer there.
   */
  const suggestion = useMemo(
    () => `${derived.palette.rule.id}-${derived.palette.baseHex.replace('#', '')}`,
    [derived.palette],
  );
  const [slugOverride, setSlugOverride] = useState<string | null>(null);
  const slug = slugOverride ?? suggestion;
  const slugEdited = slugOverride !== null && slugOverride !== suggestion;

  const resolved = useMemo(() => ({ ...options, slug }), [options, slug]);

  const input = useMemo(
    () => ({ palette: derived.palette, accents: derived.accents, options: resolved, label: derived.label }),
    [derived, resolved],
  );

  const stylesheet = useMemo(
    () => (options.format === 'tailwind' ? paletteToTailwind(input) : paletteToCss(input)),
    [input, options.format],
  );

  const json = useMemo(() => paletteToJson(input), [input]);
  const copyKey = options.format === 'tailwind' ? 'export-tailwind' : 'export-css';

  /*
   * Count what actually gets written rather than what was asked for: the global
   * scope clamps to the primary accent, so the toggle state alone would lie.
   */
  const themeCount = useMemo(
    () => resolveExportThemes(derived.accents, resolved).length,
    [derived.accents, resolved],
  );

  const patch = (changes: Partial<ExportOptions>) =>
    setOptions((current) => ({ ...current, ...changes }));

  return (
    <div className="export">
      <div className="export__row">
        <Segmented
          label="Format"
          value={options.format}
          items={[
            { id: 'css', label: 'CSS' },
            { id: 'tailwind', label: 'Tailwind v4' },
          ]}
          onChange={(format) => patch({ format: format as ExportOptions['format'] })}
        />
      </div>

      <div className="export__row">
        <Segmented
          label="Scope"
          value={options.scope}
          items={SCOPES.map((scope) => ({ id: scope.id, label: scope.label }))}
          onChange={(scope) => patch({ scope: scope as ScopeKind })}
        />
      </div>
      <p className="export__hint">
        {SCOPES.find((scope) => scope.id === options.scope)?.hint}
      </p>

      {options.scope !== 'global' ? (
        <div className="export__slug">
          <div className="export__slugHead">
            <span className="export__slugLabel" id="export-slug-label">
              Scope name
            </span>
            {slugEdited ? (
              <button
                type="button"
                className="export__slugReset"
                onClick={() => setSlugOverride(null)}
              >
                Reset
              </button>
            ) : null}
          </div>
          <input
            className="hexInput"
            value={slug}
            spellCheck={false}
            autoComplete="off"
            aria-labelledby="export-slug-label"
            onChange={(event) => setSlugOverride(event.target.value)}
          />
        </div>
      ) : null}

      <div className="export__toggles">
        <Check
          label="Invariant layer"
          checked={options.includeInvariant}
          onChange={(includeInvariant) => patch({ includeInvariant })}
        />
        <Check
          label="All accents"
          checked={options.includeAllAccents}
          disabled={options.scope === 'global'}
          title={
            options.scope === 'global'
              ? 'The document root can hold one set of values, so the global scope exports the primary accent only.'
              : undefined
          }
          onChange={(includeAllAccents) => patch({ includeAllAccents })}
        />
      </div>
      {options.scope === 'global' && options.includeAllAccents ? (
        <p className="export__hint">Global scope exports the primary accent only.</p>
      ) : null}

      <pre className="export__preview" tabIndex={0} aria-label="Generated stylesheet preview">
        <code>{stylesheet}</code>
      </pre>

      <div className="export__meta">
        <span>
          {stylesheet.split('\n').length} lines · {fileSize(stylesheet)}
        </span>
        <span>
          {themeCount} theme{themeCount === 1 ? '' : 's'}
        </span>
      </div>

      <div className="export__buttons">
        <button type="button" className="btn btn--solid btn--sm" onClick={() => onCopy(copyKey, stylesheet)}>
          {copiedKey === copyKey ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
          Copy {options.format === 'tailwind' ? 'theme' : 'CSS'}
        </button>
        <button type="button" className="btn btn--quiet btn--sm" onClick={() => onCopy('export-json', json)}>
          {copiedKey === 'export-json' ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
          Copy JSON
        </button>
      </div>

      <ContractChecker copiedKey={copiedKey} onCopy={onCopy} />

      <WordPressExport derived={derived} copiedKey={copiedKey} onCopy={onCopy} />

      <details className="tokenRef">
        <summary className="tokenRef__summary">
          Token reference
          <span className="tokenRef__count">{tokenReference.length} names</span>
        </summary>

        <p className="tokenRef__intro">
          These {tokenReference.length} names are identical for every scheme. Only their
          values change, which is why one stylesheet renders all of them.
        </p>

        <dl className="tokenRef__list">
          {tokenReference.map((entry) => (
            <div className="tokenRef__row" key={entry.token}>
              <dt>
                <code>{entry.token}</code>
              </dt>
              <dd>{entry.description}</dd>
            </div>
          ))}
        </dl>

        <p className="tokenRef__note">
          Indexed <code>--palette-1</code> … <code>--palette-N</code> tokens sit outside
          the contract on purpose: their count follows the chosen number of colors.
        </p>
      </details>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small controls                                                      */
/* ------------------------------------------------------------------ */

function Segmented({
  label,
  value,
  items,
  onChange,
}: {
  label: string;
  value: string;
  items: ReadonlyArray<{ id: string; label: string }>;
  onChange: (id: string) => void;
}) {
  return (
    <div className="segmented segmented--full" role="group" aria-label={label}>
      <div className="segmented__group">
        {items.map((item) => (
          <button
            type="button"
            key={item.id}
            className={cx('segmented__item', value === item.id && 'isActive')}
            onClick={() => onChange(item.id)}
            aria-pressed={value === item.id}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Check({
  label,
  checked,
  onChange,
  disabled,
  title,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <label className={cx('check', disabled && 'isDisabled')} title={title}>
      <input
        type="checkbox"
        className="check__input"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="check__mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4.5 12.5l5 5 10-11" />
        </svg>
      </span>
      {label}
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Contract checker                                                    */
/* ------------------------------------------------------------------ */

/**
 * Answers "would my existing theme work with this?".
 *
 * Paste any stylesheet and it reports which of the nineteen role names are
 * actually defined. That turns the contract from documentation into something a
 * theme author can test against.
 */
function ContractChecker({
  copiedKey,
  onCopy,
}: {
  copiedKey: string | null;
  onCopy: (key: string, text: string) => void;
}) {
  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const result = useMemo(
    () => (debounced.trim() === '' ? null : checkContract(debounced)),
    [debounced],
  );

  return (
    <details className="tokenRef contract">
      <summary className="tokenRef__summary">
        Is my theme compatible?
        {result !== null ? (
          <span className={cx('tokenRef__count', result.compatible ? 'isPass' : 'isFail')}>
            {result.compatible ? 'compatible' : `${result.missing.length} missing`}
          </span>
        ) : (
          <span className="tokenRef__count">paste CSS</span>
        )}
      </summary>

      <p className="tokenRef__intro">
        Paste any stylesheet to see which of the {tokenReference.length} role names it
        defines. Matching is by name only, so formatting does not matter.
      </p>

      <textarea
        className="contract__input"
        value={text}
        rows={4}
        spellCheck={false}
        placeholder=":root { --surface: #fff; --text-body: #111; }"
        aria-label="Stylesheet to check against the token contract"
        onChange={(event) => {
          const value = event.target.value;
          setText(value);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setDebounced(value), 250);
        }}
      />

      <div className="contract__actions">
        <button
          type="button"
          className="btn btn--quiet btn--sm"
          disabled={text.trim() === ''}
          onClick={() => onCopy('contract-result', JSON.stringify(result, null, 2))}
        >
          {copiedKey === 'contract-result' ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
          Copy result
        </button>
        <button
          type="button"
          className="btn btn--quiet btn--sm"
          disabled={text.trim() === ''}
          onClick={() => {
            setText('');
            setDebounced('');
          }}
        >
          Clear
        </button>
      </div>

      {result !== null ? <ContractResult result={result} /> : null}
    </details>
  );
}

function ContractResult({ result }: { result: NonNullable<ReturnType<typeof checkContract>> }) {
  return (
    <div className="contract__result">
      <p className={cx('contract__verdict', result.compatible ? 'isPass' : 'isFail')}>
        {result.compatible
          ? `All ${tokenReference.length} roles defined. This stylesheet can be re-colored by swapping role values alone.`
          : `${result.present.length} of ${tokenReference.length} roles defined. Missing ones fall back to the browser default, which is usually invisible or unreadable.`}
      </p>

      {result.missing.length > 0 ? (
        <div className="contract__group">
          <h3 className="contract__groupTitle">Missing</h3>
          <ul className="contract__chips">
            {result.missing.map((name) => (
              <li className="contract__chip isMissing" key={name}>
                {name}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.empty.length > 0 ? (
        <div className="contract__group">
          <h3 className="contract__groupTitle">Defined but empty</h3>
          <ul className="contract__chips">
            {result.empty.map((name) => (
              <li className="contract__chip isEmpty" key={name}>
                {name}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="contract__footnote">
        Scanned {result.scanned} custom {result.scanned === 1 ? 'property' : 'properties'} in
        total, including anything outside the contract.
      </p>
    </div>
  );
}