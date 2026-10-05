/**
 * Dummy content for the demo site.
 *
 * The copy is fictional and exists only to give every block realistic text
 * lengths. Nothing here is tied to a color scheme.
 */

export const BRAND = {
  name: 'Meridian',
  tagline: 'Analytics for teams who read the numbers.',
} as const;

export const NAV_LINKS = [
  { label: 'Product', href: '#product' },
  { label: 'Solutions', href: '#solutions' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Documentation', href: '#docs' },
] as const;

export const HERO = {
  eyebrow: 'Release 4.2 is out',
  title: 'Every metric you track, on one honest timeline',
  lead: 'Meridian joins product, revenue and infrastructure data into a single readable graph. No sampling, no guessing, no twelve tabs open next to each other.',
  primaryCta: { label: 'Start free', href: '#start' },
  secondaryCta: { label: 'Book a walkthrough', href: '#demo' },
  stats: [
    { value: '1.2M', label: 'events per second' },
    { value: '38 ms', label: 'median query latency' },
    { value: '99.98%', label: 'uptime, trailing year' },
  ],
} as const;

export interface Teaser {
  title: string;
  body: string;
  href: string;
  linkLabel: string;
}

export const TEASERS = {
  eyebrow: 'What you get',
  title: 'Three things that stop being a weekly argument',
  lead: 'Each one exists because a customer stopped needing a spreadsheet to answer a question.',
  items: [
    {
      title: 'One timeline, no stitching',
      body: 'Events land in a single ordered stream. When a conversion drops, the query that explains it is already written.',
      href: '#timeline',
      linkLabel: 'How the timeline works',
    },
    {
      title: 'Queries you can read',
      body: 'Every chart keeps the query beside it in plain text, so a number can always be traced back to what produced it.',
      href: '#queries',
      linkLabel: 'See a sample query',
    },
    {
      title: 'Alerts that mean something',
      body: 'Thresholds are set against seasonality, not a flat number, so the pager stays quiet until it should not.',
      href: '#alerts',
      linkLabel: 'Alerting, in practice',
    },
  ],
} satisfies { eyebrow: string; title: string; lead: string; items: Teaser[] };

export const PROSE = {
  eyebrow: 'The approach',
  title: 'A color system has to survive its own content',
  body: [
    'A scheme that only looks right with the placeholder text in place is not a scheme, it is a screenshot. Real pages carry long headings, one-word links, prices in small print and paragraphs that nobody proof-read.',
    'So the layout is built against roles instead of colors. Nothing in the markup asks for blue; it asks for a link, a muted caption, a card surface. The scheme decides what those mean. Swap the scheme and the page re-tints itself without a single rule changing.',
    'That is also why the contrast is solved rather than chosen. Each role is given an aesthetic starting point, then moved along the lightness axis until it clears its WCAG target against every surface it can land on.',
  ],
  quote:
    'Pick one base color. The rest is arithmetic — and the arithmetic is only hard until you make the machine do it.',
  listTitle: 'What stays fixed across every scheme',
  list: [
    'Spacing, type scale, radii and motion — never touched by a color change',
    'Nineteen role tokens, always the same nineteen names',
    'Contrast targets enforced per role, in both the light and the dark variant',
  ],
  cta: { label: 'Read the token reference', href: '#tokens' },
} as const;

export interface VariantCopy {
  eyebrow: string;
  title: string;
  body: string;
  cta: { label: string; href: string };
  stats: ReadonlyArray<{ label: string; value: string }>;
  badges: readonly string[];
}

/**
 * Copy for the generated variant sections. The list is cycled when more harmony
 * colors are requested than there are entries, so the page never runs dry.
 */
export const VARIANT_COPY: readonly VariantCopy[] = [
  {
    eyebrow: 'One harmony color',
    title: 'Every section gets its own accent',
    body: 'The surfaces and the type stay the same, only the brand color rotates. Two hues cannot disagree with each other, because they are derived from one rotation of the wheel rather than picked by hand.',
    cta: { label: 'See the token values', href: '#tokens' },
    stats: [
      { label: 'Role tokens', value: '19' },
      { label: 'Audited pairs', value: '10' },
      { label: 'Variants', value: '2' },
    ],
    badges: ['Surfaces', 'Text ramp', 'Links', 'Focus ring'],
  },
  {
    eyebrow: 'Two accents, one system',
    title: 'Rotating the accent is not rotating the design',
    body: 'Switching this section to the next hue changes fifteen values. It changes no class names, no layout rules and no component code, because the markup only ever refers to roles.',
    cta: { label: 'Compare both variants', href: '#compare' },
    stats: [
      { label: 'Values changed', value: '15' },
      { label: 'Rules changed', value: '0' },
      { label: 'Layout shifts', value: 'None' },
    ],
    badges: ['Light', 'Dark', 'AA', 'AAA headings'],
  },
  {
    eyebrow: 'A third step on the wheel',
    title: 'Hues keep their weight at every lightness',
    body: 'Rotating in a perceptually uniform space means a yellow and a blue at the same lightness actually look equally bright. Rotating in HSL does not, which is where most generators quietly go wrong.',
    cta: { label: 'Read the method', href: '#method' },
    stats: [
      { label: 'Working space', value: 'OKLCH' },
      { label: 'Hue steps', value: '120°' },
      { label: 'Gamut mapping', value: 'Chroma' },
    ],
    badges: ['Perceptual', 'Uniform', 'In gamut'],
  },
  {
    eyebrow: 'The fourth color',
    title: 'Harder to use, easier to prove',
    body: 'Tetradic and square schemes give you the most colors and the least help. That makes them the honest test: if the role contract holds up here, it holds up anywhere.',
    cta: { label: 'Try a square scheme', href: '#square' },
    stats: [
      { label: 'Hues', value: '4' },
      { label: 'Dominant', value: '1' },
      { label: 'Accents', value: '3' },
    ],
    badges: ['Tetradic', 'Square', 'Full wheel'],
  },
  {
    eyebrow: 'Now in one hue',
    title: 'Monochromatic is the accessible one',
    body: 'With a single hue you cannot create a hue clash, and you can spend the whole budget on getting the lightness ramp right. It is the scheme we would pick if we only had one.',
    cta: { label: 'Go monochromatic', href: '#mono' },
    stats: [
      { label: 'Hues', value: '1' },
      { label: 'Steps', value: '8' },
      { label: 'Clash risk', value: 'None' },
    ],
    badges: ['Tints', 'Shades', 'One hue'],
  },
  {
    eyebrow: 'The full spectrum',
    title: 'Rainbow is a warning, not a palette',
    body: 'Every hue at once makes it easy to show that the layout survives anything. It is rarely the right answer for a shipping product, which is exactly why it is useful here.',
    cta: { label: 'Back to a sane scheme', href: '#start' },
    stats: [
      { label: 'Hues', value: '8' },
      { label: 'Cards', value: '3' },
      { label: 'Survives', value: 'Yes' },
    ],
    badges: ['Full sweep', 'Even spacing', 'Loud'],
  },
];

export const PALETTE_STRIP = {
  eyebrow: 'Indexed tokens',
  title: 'The harmony colors themselves',
  lead: 'These blocks are painted with the indexed custom properties --palette-1 through --palette-N. Their count follows the color count you chose, which is why no stylesheet may depend on them.',
} as const;

export const FOOTER = {
  columns: [
    { title: 'Product', links: ['Overview', 'Timeline', 'Alerts', 'Changelog'] },
    { title: 'Company', links: ['About', 'Careers', 'Press', 'Contact'] },
    { title: 'Resources', links: ['Docs', 'Guides', 'Status', 'Support'] },
  ],
  legal: 'Meridian is a fictional product used as demo content. The scheme on this page was generated in your browser and never leaves it.',
} as const;