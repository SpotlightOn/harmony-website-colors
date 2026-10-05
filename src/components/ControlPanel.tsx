import type { ReactNode } from 'react';
import { useCopy } from '@/hooks/useCopy';
import { cx } from '@/lib/cx';
import type { SchemeControls } from '@/state/useScheme';
import { BaseColorField } from './panel/BaseColorField';
import { ColorCountSlider } from './panel/ColorCountSlider';
import { ContrastAudit } from './panel/ContrastAudit';
import { ExportBlock } from './panel/ExportBlock';
import { HarmonyPicker } from './panel/HarmonyPicker';
import { PalettePreview } from './panel/PalettePreview';
import { SavedPalettes } from './panel/SavedPalettes';
import { ResetIcon, ShuffleIcon } from './panel/icons';
import { PanelCloseIcon, PanelOpenIcon } from './panel/panelIcons';
import { Logo } from './site/Logo';

export interface ControlPanelProps {
  controls: SchemeControls;
}

interface PanelSectionProps {
  title: string;
  hint?: string;
  children: ReactNode;
}

function PanelSection({ title, hint, children }: PanelSectionProps) {
  return (
    <section className="panelSection">
      <header className="panelSection__head">
        <h2 className="panelSection__title">{title}</h2>
        {hint ? <p className="panelSection__hint">{hint}</p> : null}
      </header>
      {children}
    </section>
  );
}

export function ControlPanel({ controls }: ControlPanelProps) {
  const { state, derived } = controls;
  const { copiedKey, copy } = useCopy();
  const collapsed = controls.panel.collapsed;

  /*
   * The panel keeps its own neutral theme, entirely.
   *
   * Re-pointing the panel's `--accent` at the generated accent was a mistake. That
   * accent is solved against the demo's LIGHT surface, while the panel is dark, so
   * anything in the panel that used it as text dropped to 3.09:1 — the token
   * reference list became unreadable. The generated accent is a value belonging to
   * the demo theme, not a token the tool chrome can borrow.
   */

  const shareUrl =
    typeof window === 'undefined' ? '' : `${window.location.origin}${window.location.pathname}`;

  return (
    <aside
      className={cx('panel', collapsed && 'isCollapsed')}
      aria-label="Scheme controls"
    >
      {/*
        Title bar. The label sits on the left and the collapse control on the
        right, both in normal flow, so neither can ever overlap the controls
        below. It stays put while only the content area scrolls.
      */}
      <header className="panel__titlebar">
        <div className="panel__brand">
          <Logo size={24} />
          <div className="panel__brandText">
            <p className="panel__brandName">Harmony</p>
            <p className="panel__brandTag">Site color scheme generator</p>
          </div>
        </div>

        <button
          type="button"
          className="panel__collapse"
          onClick={controls.togglePanel}
          aria-expanded={!collapsed}
          title={collapsed ? 'Show controls' : 'Hide controls'}
        >
          {collapsed ? <PanelOpenIcon /> : <PanelCloseIcon />}
          {/* Labelled, not icon-only: an unlabelled chevron is not worth guessing at. */}
          <span className="panel__collapseLabel">{collapsed ? 'Show' : 'Hide'}</span>
        </button>
      </header>

      {collapsed ? (
        /*
         * Collapsed state: the title bar plus a narrow rail with just enough to
         * stay recognisable and to hint at the current scheme.
         */
        <div className="panel__rail">
          <span className="panel__railSwatches" aria-hidden="true">
            {derived.palette.swatches.map((swatch) => (
              <span key={swatch.index} style={{ backgroundColor: swatch.hex }} />
            ))}
          </span>
          <span className="panel__railLabel">{derived.palette.rule.label}</span>
        </div>
      ) : (
        <div className="panel__inner">
          <div className="panel__toolbar">
            <button type="button" className="btn btn--solid btn--sm" onClick={controls.shuffle}>
              <ShuffleIcon size={14} />
              Shuffle
            </button>
            <button
              type="button"
              className="iconBtn"
              onClick={controls.reset}
              title="Reset to the default scheme"
            >
              <ResetIcon />
              <span className="visually-hidden">Reset scheme</span>
            </button>
          </div>

          <p className="panel__summary">
            <span className="panel__summaryRule">{derived.palette.rule.label}</span>
            <span className="panel__summaryMeta">
              {derived.palette.swatches.length} colors · {derived.palette.baseHex}
            </span>
          </p>

        <div className="panel__scroll">
          <PanelSection title="Base color" hint="Everything below is derived from this one color.">
            <BaseColorField
              value={state.baseHex}
              onChange={controls.setBaseHex}
              onRandomize={controls.randomizeBase}
            />
          </PanelSection>

          <PanelSection title="Harmony rule">
            <HarmonyPicker value={state.ruleId} onChange={controls.setRuleId} />
          </PanelSection>

          <PanelSection title="Amount">
            <ColorCountSlider value={state.colorCount} onChange={controls.setColorCount} />
          </PanelSection>

          <PanelSection title="Preview" hint="Click a tile to copy its hex value.">
            <PalettePreview
              accents={derived.accents}
              animationKey={`${state.baseHex}-${state.ruleId}-${state.seed}`}
              copiedKey={copiedKey}
              onCopy={copy}
            />
          </PanelSection>

          <PanelSection
            title="Accessibility"
            hint={
              derived.auditClean
                ? `WCAG 2.2 AA holds for all ${derived.accents.length * 2} generated themes.`
                : `WCAG 2.2 · ${derived.failures} failing ${
                    derived.failures === 1 ? 'pair' : 'pairs'
                  } across ${derived.accents.length * 2} themes.`
            }
          >
            <label className="switch">
              <input
                type="checkbox"
                className="switch__input"
                checked={state.enforceContrast}
                onChange={(event) => controls.setEnforceContrast(event.target.checked)}
              />
              <span className="switch__track" aria-hidden="true">
                <span className="switch__thumb" />
              </span>
              <span className="switch__text">
                Enforce contrast
                <span className="switch__hint">
                  Turn off to inspect the unclamped scheme.
                </span>
              </span>
            </label>

            <ContrastAudit
              accents={derived.accents}
              sections={derived.sections}
              enforceContrast={state.enforceContrast}
              overrides={state.overrides}
              onAssign={controls.assignToken}
              onResetOverrides={controls.resetOverrides}
              palette={derived.palette.swatches}
            />
          </PanelSection>

          <PanelSection title="Library" hint="Kept in this browser only.">
            <SavedPalettes
              entries={controls.saved}
              atLimit={controls.atSavedLimit}
              onSave={controls.saveCurrent}
              onRemove={controls.removeSaved}
              onApply={controls.applySaved}
              onCopyLink={() => copy('share-link', shareUrl)}
              linkCopied={copiedKey === 'share-link'}
            />
          </PanelSection>

          <PanelSection title="Export">
            <ExportBlock derived={derived} copiedKey={copiedKey} onCopy={copy} />
          </PanelSection>
        </div>
      </div>
      )}
    </aside>
  );
}