import { Logo } from './Logo';
import { ThemeScope } from './ThemeScope';
import { BRAND, FOOTER } from './content';
import type { AccentTheme } from '@/state/scheme';

export interface SiteFooterProps {
  primary: AccentTheme;
}

export function SiteFooter({ primary }: SiteFooterProps) {
  return (
    <ThemeScope theme={primary.light} className="siteFooter" id="docs">
      <footer className="footer">
        <div className="container footer__inner">
          <div className="footer__brand">
            <a className="brand" href="#top">
              <Logo size={30} />
              <span className="brand__name">{BRAND.name}</span>
            </a>
            <p className="footer__tagline">{BRAND.tagline}</p>
          </div>

          <div className="footer__columns">
            {FOOTER.columns.map((column) => (
              <nav className="footer__column" key={column.title} aria-label={column.title}>
                <h2 className="footer__columnTitle">{column.title}</h2>
                <ul>
                  {column.links.map((link) => (
                    <li key={link}>
                      <a className="footer__link" href="#top">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="container footer__legal">
          <p>{FOOTER.legal}</p>
        </div>
      </footer>
    </ThemeScope>
  );
}