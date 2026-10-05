import { ThemeScope } from './ThemeScope';
import { VARIANT_COPY, type VariantCopy } from './content';
import type { AccentTheme, Variant } from '@/state/scheme';

export interface VariantSectionProps {
  accent: AccentTheme;
  variant: Variant;
  /** Which harmony color this section is themed by. */
  accentIndex: number;
  /** Position in the generated sequence, starting at 1. */
  position: number;
  /** Total number of generated sections. */
  total: number;
}

/**
 * One of the generated sections.
 *
 * There is one light and one dark section per harmony color, so every combination
 * the audit allows an assignment for has a surface here. Each section cycles
 * through the copy bank so a long palette does not repeat itself immediately.
 */
export function VariantSection({
  accent,
  variant,
  accentIndex,
  position,
  total,
}: VariantSectionProps) {
  const copy: VariantCopy = VARIANT_COPY[(position - 1) % VARIANT_COPY.length] as VariantCopy;

  return (
    <ThemeScope
      theme={accent[variant]}
      className="variant"
      id={`variant-${position}`}
      // The audit addresses sections by these two values, so they have to be
      // readable from the DOM rather than inferred from the position.
      data-accent={accentIndex}
      data-tone={variant}
      aria-labelledby={`variant-${position}-title`}
    >
      <div className="container variant__inner">
        <div className="variant__copy">
          <p className="eyebrow">
            {copy.eyebrow} · {variant === 'light' ? 'Light' : 'Dark'} ·{' '}
            {accent.swatch.hex} · {position}/{total}
          </p>
          <h2 className="sectionTitle" id={`variant-${position}-title`}>
            {copy.title}
          </h2>
          <p className="variant__body">{copy.body}</p>
          <p>
            <a className="link" href={copy.cta.href}>
              {copy.cta.label}
            </a>
          </p>
        </div>

        <aside className="detailPanel" aria-label={`Section ${position} details`}>
          <dl className="detailPanel__stats">
            {copy.stats.map((stat) => (
              <div className="detailPanel__stat" key={stat.label}>
                <dt className="detailPanel__statLabel">{stat.label}</dt>
                <dd className="detailPanel__statValue">{stat.value}</dd>
              </div>
            ))}
          </dl>

          <ul className="badgeRow">
            {copy.badges.map((badge) => (
              <li className="badge" key={badge}>
                {badge}
              </li>
            ))}
          </ul>

          <div className="well">
            <p className="well__title">Inset surface</p>
            <p className="well__text">
              Muted text on <code>--surface-sunken</code>, kept above the AA threshold.
            </p>
            <a className="link" href="#well">
              A link inside the well
            </a>
          </div>
        </aside>
      </div>
    </ThemeScope>
  );
}