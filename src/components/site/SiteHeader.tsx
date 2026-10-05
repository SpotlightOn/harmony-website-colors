import { Logo } from './Logo';
import { ThemeScope } from './ThemeScope';
import { BRAND, NAV_LINKS } from './content';
import type { AccentTheme } from '@/state/scheme';

export interface SiteHeaderProps {
  primary: AccentTheme;
}

export function SiteHeader({ primary }: SiteHeaderProps) {
  return (
    <ThemeScope theme={primary.light} className="headerScope">
      {/*
        The skip link lives inside the header's scope on purpose. As a direct
        child of the page root it had no role tokens of its own, so it fell back
        to the tool chrome and paired dark ink with the chrome's accent fill.
      */}
      <a className="skipLink" href="#main">
        Skip to content
      </a>

      <header className="siteHeader">
        <div className="container siteHeader__inner">
          <a className="brand" href="#top">
            <Logo size={32} />
            <span className="brand__name">{BRAND.name}</span>
          </a>

          <nav className="siteNav" aria-label="Primary">
            <ul className="siteNav__list">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a className="siteNav__link" href={link.href}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="siteHeader__actions">
            <a className="btn btn--quiet" href="#signin">
              Sign in
            </a>
            <a className="btn btn--solid" href="#start">
              Start free
            </a>
          </div>
        </div>
      </header>
    </ThemeScope>
  );
}