import { ThemeScope } from './ThemeScope';
import { HERO } from './content';
import type { AccentTheme } from '@/state/scheme';

export interface HeroSectionProps {
  primary: AccentTheme;
}

/**
 * The dark block of the page. It exists to prove the same markup renders
 * correctly on the dark variant of a scheme, which is a completely different set
 * of derived values rather than an inverted copy of the light one.
 */
export function HeroSection({ primary }: HeroSectionProps) {
  return (
    <ThemeScope theme={primary.dark} className="hero">
      {/* Decorative wash built from the accent role token. */}
      <div className="hero__glow" aria-hidden="true" />

      <div className="container hero__inner">
        <p className="eyebrow">
          <span className="eyebrow__dot" aria-hidden="true" />
          {HERO.eyebrow}
        </p>

        <h1 className="hero__title">{HERO.title}</h1>
        <p className="hero__lead">{HERO.lead}</p>

        <div className="hero__actions">
          <a className="btn btn--solid" href={HERO.primaryCta.href}>
            {HERO.primaryCta.label}
          </a>
          <a className="btn btn--outline" href={HERO.secondaryCta.href}>
            {HERO.secondaryCta.label}
          </a>
        </div>

        <dl className="hero__stats">
          {HERO.stats.map((stat) => (
            <div className="stat" key={stat.label}>
              <dt className="stat__value">{stat.value}</dt>
              <dd className="stat__label">{stat.label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </ThemeScope>
  );
}