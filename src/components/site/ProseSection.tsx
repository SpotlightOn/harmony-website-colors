import { ThemeScope } from './ThemeScope';
import { PROSE } from './content';
import type { AccentTheme } from '@/state/scheme';

export interface ProseSectionProps {
  primary: AccentTheme;
}

/**
 * A light block with dark text, sitting on the inset surface token. Same
 * component vocabulary as the teasers, different surface role.
 */
export function ProseSection({ primary }: ProseSectionProps) {
  return (
    <ThemeScope
      theme={primary.light}
      className="proseSection"
      id="solutions"
      aria-labelledby="prose-title"
    >
      <div className="container proseSection__inner">
        <header className="sectionHead">
          <p className="eyebrow">{PROSE.eyebrow}</p>
          <h2 className="sectionTitle" id="prose-title">
            {PROSE.title}
          </h2>
        </header>

        <div className="prose">
          {PROSE.body.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}

          <blockquote className="pullQuote">
            <p>{PROSE.quote}</p>
          </blockquote>

          <h3 className="prose__subhead">{PROSE.listTitle}</h3>
          <ul className="checkList">
            {PROSE.list.map((item) => (
              <li key={item}>
                <span className="checkList__mark" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>

          <p>
            <a className="link" href={PROSE.cta.href}>
              {PROSE.cta.label}
            </a>
          </p>
        </div>
      </div>
    </ThemeScope>
  );
}