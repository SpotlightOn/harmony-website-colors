import { PlaceholderArt } from './PlaceholderArt';
import { ThemeScope } from './ThemeScope';
import { TEASERS } from './content';
import type { AccentTheme } from '@/state/scheme';

export interface TeaserSectionProps {
  secondary: AccentTheme;
}

/** Three teasers on a CSS grid: artwork, heading, short text, link. */
export function TeaserSection({ secondary }: TeaserSectionProps) {
  return (
    <ThemeScope
      theme={secondary.light}
      className="teasers"
      id="product"
      aria-labelledby="teasers-title"
    >
      <div className="container">
        <header className="sectionHead">
          <p className="eyebrow">{TEASERS.eyebrow}</p>
          <h2 className="sectionTitle" id="teasers-title">
            {TEASERS.title}
          </h2>
          <p className="sectionLead">{TEASERS.lead}</p>
        </header>

        <ul className="teaserGrid">
          {TEASERS.items.map((item, index) => (
            <li key={item.href}>
              <article className="teaserCard">
                <div className="teaserCard__media">
                  <PlaceholderArt seed={index + 1} alt="" />
                </div>
                <div className="teaserCard__body">
                  <h3 className="teaserCard__title">{item.title}</h3>
                  <p className="teaserCard__text">{item.body}</p>
                  <a className="linkArrow" href={item.href}>
                    {item.linkLabel}
                    <span className="linkArrow__glyph" aria-hidden="true">
                      →
                    </span>
                  </a>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </ThemeScope>
  );
}