# Harmony

An interactive generator for **website color schemes**. Pick one base color and a
classic color harmony rule; the app derives a palette, turns every color into a
complete design-token set, and renders a realistic website through it — light and
dark sections, cards, links, buttons, focus rings — so the result can be judged as
a page rather than as a row of swatches.

Built with **React 19**, **TypeScript 7** and **Rsbuild 2**. No runtime
dependencies beyond React.

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm build      # production bundle
pnpm typecheck  # tsc --noEmit
pnpm verify     # structural checks on the exported stylesheet
pnpm check      # typecheck + build + verify
```

---

## The idea

A color scheme that only looks right with placeholder text is not a scheme, it is
a screenshot. Real pages carry long headings, one-word links, prices in small
print and paragraphs nobody proof-read.

So the demo page is written **against roles, not colors**. Nothing in the markup
or in `src/styles/site.css` ever asks for "blue". It asks for a link, a muted
caption, a card surface, an inset panel. The scheme decides what those mean.

Two consequences:

- **One stylesheet renders every scheme.** Swapping the scheme changes values,
  never class names or layout rules.
- **The token set is sufficient on its own.** The export is a complete stylesheet,
  invariant layer included — you can paste it into an empty project and style a
  page from it. This is verified, not assumed: see [Verification](#verification).

---

## The token contract

Twenty-four role tokens. **The names are identical for every scheme; only the
values change.** They are declared once in `ROLE_TOKENS` (`src/color/theme.ts`) and
are applied to a subtree by `<ThemeScope>`, which is why adding a role here adds it
to every scheme at once.

The important structural point: a theme is derived from the **whole palette**, not
from one color. Surfaces, text and the primary accent follow the *dominant* entry,
while the secondary and tertiary roles come from the other entries. An earlier
version derived all nineteen roles from a single accent, which produced a
monochrome page — nineteen shades of one hue, with the other computed colors
exported and never used. That is the failure this binding exists to prevent.

### Surfaces

| Token | Purpose |
| --- | --- |
| `--surface` | Section background. |
| `--surface-raised` | Cards and tiles that sit above the section. |
| `--surface-sunken` | Inset wells, code blocks, quiet panels. |
| `--surface-hover` | Hover and selected fill for interactive rows. |

### Text

| Token | Purpose |
| --- | --- |
| `--text-strong` | Headlines, lead paragraphs, primary labels. |
| `--text-body` | Running text and list items. |
| `--text-muted` | Captions, metadata, helper text. **Still AA readable.** |
| `--text-on-accent` | Text placed on top of the accent fill. |

### Brand and links

Roles are bound to **different palette entries**, which is what makes the harmony
visible instead of decorative.

| Token | Bound to | Purpose |
| --- | --- | --- |
| `--accent` | palette[0] | Primary brand fill: buttons, badges, active states. |
| `--accent-hover` | palette[0] | Accent fill for hover and pressed states. |
| `--accent-soft` | palette[0] | Low intensity accent wash for backgrounds. |
| `--accent-alt` | palette[1] | Second harmony color. Secondary calls to action. |
| `--accent-alt-hover` | palette[1] | Hover and pressed state of the second color. |
| `--accent-alt-soft` | palette[1] | Low intensity wash of the second color. |
| `--accent-on-alt` | palette[1] | Text placed on the second color's fill. |
| `--accent-tertiary` | palette[2] | Third harmony color. Highlights and editorial accents. |
| `--link` | palette[1] | Inline link color. Derived from the second harmony color. |
| `--link-hover` | palette[1] | Inline link hover and focus color. |
| `--link-visited` | palette[1] | Inline link, already visited. |

`palette[n]` wraps, and a two-color palette simply repeats — two colors cannot
provide three distinct ones, and pretending otherwise would be a lie.

### Lines, focus and overlays

| Token | Purpose |
| --- | --- |
| `--border` | Hairline separators and card outlines. |
| `--border-strong` | Outlines that need to be perceivable on their own. |
| `--focus-ring` | Keyboard focus indicator. **Never remove it.** |
| `--shadow` | Shadow tint. Alpha is part of the token. |
| `--overlay` | Scrim behind modals and menus. Alpha is part of the token. |

### What is *not* part of the contract

- **Spacing, type scale, radii, motion, layout.** These live in
  `src/styles/tokens.css` and contain no color at all. A scheme change must not
  move anything.
- **`--palette-1 … --palette-N`.** Indexed harmony colors. Their count follows
  the chosen color count, so no stylesheet may depend on them. They are declared
  once on the demo page root and painted by `PaletteStrip`.

---

## Accessibility

Contrast is **solved, not chosen**. Every role starts from an aesthetic value in
`RECIPES` (`src/color/theme.ts`), then a solver walks the color along the OKLCH
lightness axis until it clears its WCAG 2.2 target against every surface it can
land on.

Audited pairs, per theme:

| Pair | Target | Criterion |
| --- | --- | --- |
| `--text-strong` on `--surface` | 4.5:1 | AA · normal text |
| `--text-body` on `--surface` | 4.5:1 | AA · normal text |
| `--text-muted` on `--surface` | 4.5:1 | AA · normal text |
| `--text-body` on `--surface-raised` | 4.5:1 | AA · normal text |
| `--link` on `--surface` | 4.5:1 | AA · normal text |
| `--link` on `--surface-sunken` | 4.5:1 | AA · normal text |
| `--text-on-accent` on `--accent` | 4.5:1 | AA · normal text |
| `--accent` on `--surface` | 3:1 | AA · non-text contrast |
| `--border-strong` on `--surface` | 3:1 | AA · non-text contrast |
| `--focus-ring` on `--surface` | 3:1 | AA · non-text contrast |

That is 13 pairs × 2 variants × up to 8 palettes. The panel audits any of them
and reports the ratio, the threshold and the criterion.

**Enforce contrast** (on by default) toggles the solver. Turn it off to inspect
the unclamped aesthetic scheme — the audit will then show which pairs fall short,
which is a useful way to see what the solver is actually fixing.

Beyond contrast: the demo keeps a visible focus ring on every interactive element,
respects `prefers-reduced-motion`, and is operable from the keyboard throughout
including the radiogroup of harmony rules.

### Secondary buttons

The outline button shares the primary button's hue and differs only in treatment —
filled versus not. Giving it the second harmony color made the pair look unrelated
instead of related. The second color keeps its own jobs: links, badges, the
eyebrow dot. A secondary action recedes because it is unfilled, not because it
borrows a different hue.

### A note on measuring

Two shipped contrast bugs shared one cause worth knowing about: the solver was
auditing **unrounded** OKLCH channels while the stylesheet emits `#rrggbb`. Rounding
moved a muted text token from 4.51:1 to 4.48:1 and nothing noticed. Everything is
now quantized to 8 bits before it is measured, and the panel's own neutral theme is
audited by hand against the same threshold — the tool chrome is not exempt just
because it is not generated.

---

---

## Hand-tuning the generated values

The generator is a starting point, not the last word. In the accessibility
section every role token is shown as a swatch next to its name, and clicking it
opens the generated harmony colors as a palette. Pick one and that token takes
that value, for that harmony color, in that tone.

```css
/* generated */
--text-body: #505561;

/* after reassigning it by hand */
--text-body: #7ea6ff;
```

Three details worth knowing:

- **The audit is re-run, not trusted.** Changing `--surface` moves every ratio
  measured against it, so picking a value that fails AA shows the pair as
  failing. Assigning a low-contrast color to `--text-body` really does drop body
  copy from 7.13:1 to 3.59:1, and the panel says so instead of quietly
  correcting it. Manual values are always honored, never repaired.
- **Hand-set values are marked.** The swatch gets a ring and the name an
  asterisk, and a bar offers *Reset all*. The generated value is kept alongside,
  so reverting one token is exact rather than a re-derivation.
- **Overrides are dropped when the palette changes.** They name specific
  colors, so an override pinned to a harmony color is meaningless once the base
  color, rule or count moves. They are also read from `localStorage` but never
  written into the share link, which is why the two sources are merged on load
  rather than one replacing the other.

The popover renders in a portal so it escapes the panel's scroll containers, and
closes on Escape or an outside click.

---

## Harmony rules

All rotations happen in **OKLCH**, not HSL. OKLCH is perceptually uniform, so
rotating the hue keeps perceived lightness steady and stepping lightness gives
evenly spaced tints. HSL does neither, which is where most generators go wrong.
Out-of-gamut requests are resolved by reducing chroma, preserving hue and
lightness.

| Rule | Hue offsets | Colors |
| --- | --- | --- |
| Analogous | −30°, 0°, +30° | 3 |
| Complementary | 0°, 180° | 2 |
| Split complementary | 0°, 150°, 210° | 3 |
| Triadic | 0°, 120°, 240° | 3 |
| Tetradic | 0°, 60°, 180°, 240° | 4 |
| Square | 0°, 90°, 180°, 270° | 4 |
| Monochromatic | one hue, stepped tints and shades | 5 |
| Rainbow | 0° … 315° in 45° steps | 8 |

The color count is independent (2–8). Asking for fewer truncates the rule, keeping
the base hue first. Asking for more repeats it and separates the passes with
progressively larger lightness shifts, so a two-color palette can still fill a page.

---

## Export

The panel's export section writes the scheme out as custom properties, with a live
preview of exactly what you are about to paste.

### Two layers, and the split is the point

1. **Scheme-invariant layer** — spacing, type scale, radii, motion, layout. These
   contain no color at all. They are read straight out of `tokens.css` at build
   time rather than restated in TypeScript, so there is one source of truth.
2. **Role tokens** — the twenty-four names above. Only the values change
   between schemes.

Re-coloring a project that already consumes these names means replacing the role
token values and leaving everything else alone.

### Formats

| Format | Output |
| --- | --- |
| **CSS** | `[data-variant]` / class / attribute scoped blocks for every theme. |
| **Tailwind v4** | `@theme` with `--color-*` names, plus `.dark` for the dark tone. |

Tailwind names are kept **verbatim** under a `--color-*` namespace, so they become
`bg-surface`, `text-text-body`, `border-border-strong`. Slightly awkward utility
names are the price of the contract surviving the trip into another project's
conventions, and it is worth paying.

### WordPress

The panel also emits a `theme.json` **style variation** for block themes, as a
separate section rather than a third format: a variation replaces values in a theme
that already declares its own slugs, so the scope, slug and invariant options have
nothing to act on. Save the output as `styles/<name>.json` in the theme and it
appears under Appearance &rarr; Styles.

The generator does not invent slugs. It targets the **Notor** theme's own vocabulary,
so every block and template that references `var(--wp--preset--color--brand)` follows
along instead of being stranded on the default:

| Palette slot | Source |
| --- | --- |
| `brand`, `brand-deep` | the dominant harmony color and its hover |
| `accent` | the second harmony color |
| `base`, `surface`, `surface-deep` | the surface roles |
| `ink`, `ink-soft`, `muted` | the text roles |
| `brand-mist` | the accent wash |
| `brand-light`, `accent-light` | **solved**, see below |

Gradients and duotone presets are rebuilt from the same palette, keeping the theme's
own angles and stops, and the shadow presets are re-tinted — the theme bakes its ink
color into `rgb(16 22 23 / 0.08)`, so overriding only the palette would leave every
shadow carrying the previous scheme's ink.

Three things about this export are worth knowing before changing it:

- **`brand-light` and `accent-light` are solved, not mapped.** Notor paints them as
  link and caption colors *on top of* its dark `brand` and `ink` section fills. A
  saturated harmony color cannot serve that role; measured, it landed at 1.30:1. Both
  are generated as readable tints of the color they belong to, solved against every
  background the theme puts them on.
- **There is no dark variation.** The theme encodes absolute lightness in its sections
  rather than roles — `section-ink` fills with `ink` expecting it to be the darkest
  color in the palette. Inverting the palette turns that section white and leaves
  `brand-light` as a light link color on a light background, measured at 1.55:1. No
  toggle is offered rather than offering one that produces an unreadable site.
- **The contrast checks are the theme's pairs, not invented ones.** The verification
  sweep reads them out of the theme's own `theme.json`. An early version included
  `ink` on `brand`, which the theme never renders — buttons put `base` on `brand`.

### Scopes

| Scope | Selectors | Use for |
| --- | --- | --- |
| **Global** (default) | `:root`, `:root[data-tone='dark']` | Re-coloring a single-theme project. Nothing to wire up. |
| **Class** | `.theme-<slug>-<color>-<tone>` | A page with several colored sections. |
| **Attribute** | `[data-theme='<slug>-<color>-<tone>']` | Same, for markup that prefers attributes. |

Two details worth knowing:

- In **global** scope only the primary accent is exported. `:root` holds one set of
  values, so emitting every accent there would make them silently override each
  other. The panel disables the *All accents* toggle to say so out loud.
- In **class** and **attribute** scope the first theme is *also* applied to
  `:root`. Without that fallback, a stylesheet pasted into markup that carries no
  theme class resolves every `var(--role)` to nothing: transparent backgrounds,
  inherited text, invisible buttons. A wrong-looking page is a much worse failure
  than an unexpected default tone.

### Is my theme compatible?

Paste any stylesheet into the contract checker and it reports which of the
twenty-four role names that stylesheet actually defines, plus which are missing or
empty. That turns the contract from documentation into something you can test
against — the question becomes answerable instead of rhetorical.

Matching is by name only, so formatting, ordering and selector style are all
irrelevant.

### Verification

`pnpm verify` runs the real generator across six palettes (including grayscale,
pure black and pure white bases) × three scopes × both tones, and asserts that the
output:

- has well-formed comments and balanced braces,
- contains no comment opener inside a comment body, which would close the comment
  early and turn the rest of the file into live CSS,
- declares all twenty-four roles in every theme block,
- that every text role clears 4.5:1 on every surface it is solved against,
  measured on the **emitted hex** rather than the in-memory color,
- that every generated swatch gets an ink that clears 4.5:1,
- uses unique selectors, so no block silently overrides another,
- emits no role token outside Tailwind's `--color-*` namespace,
- keeps the invariant layer free of color and untruncated by the parse.

The WordPress variation gets its own sweep across all 576 schemes: valid JSON, the
schema and version the theme uses, all twelve palette slugs plus every gradient,
duotone and shadow slug, no missing gradient stops, re-tinted shadows, and the
sixteen foreground/background pairs the theme actually renders at 4.5:1 or better.

That last one caught a real bug: the parser was line-based, which silently cut the
font stacks off after their first line.

The exported stylesheet has also been used to style a page containing **zero**
literal colors — 59 `var()` references, no `#hex`, no `rgb()` anywhere in the
hand-written rules — in both tones.

- Base color via native picker, hex field (accepts `#abc`, `f0a`, `#FF00AA`), dice
  button, or a labeled row of presets.
- 8 harmony rules, each with a polar preview showing its hue rotations.
- Color count 2–8 with a live tile preview. Click a tile to copy its hex.
- Tile previews show the color as a raw swatch **and** as an accent on light and
  dark surfaces.
- Per-accent, per-variant contrast audit with WCAG badges.
- **Every role token can be reassigned by hand** — see [Hand-tuning](#hand-tuning-the-generated-values).
- The control panel collapses to a narrow rail so the demo page gets the full
  width. The state persists.
- Save schemes to `localStorage` (max 24) and reload them; entries preview with a
  freshly derived strip, so they stay accurate if the rules change.
- Share any scheme as a link: `?b=3b6ef5&r=triadic&n=5&aa=0`. Stored in the query
  string rather than the hash, because the demo page has its own in-page anchors.
- Export the scheme as annotated CSS or as JSON, with a live preview, a
  configurable scope, and an optional invariant layer.
- Check any existing stylesheet against the token contract.
- The last open scheme is restored on reload.
- The generated placeholder artwork is inline SVG drawn entirely from theme
  tokens, so it re-tints with the scheme and needs no network requests.
- Nothing is uploaded anywhere. Everything runs in the browser.

---

## Architecture

```
src/
  color/
    color.ts      OKLCH <-> sRGB, WCAG contrast, hue naming
    harmony.ts    The 8 rules as hue-offset stop lists
    palette.ts    Base color + rule + count -> swatches
    invariant.ts  Parses the invariant layer out of tokens.css for the export
    theme.ts      Palette -> 24 role tokens + contrast audit
    css-vars.ts   Themes -> custom properties, CSS / Tailwind / JSON export,
                  plus the contract checker
  state/
    scheme.ts     Scheme state and pure derivation
    urlState.ts   Query string serialization
    storage.ts    localStorage, fully guarded
    useScheme.ts  The single stateful entry point
  components/
    ControlPanel.tsx      Sidebar: all controls, with the collapse toggle
    panel/               One component per control
      TokenPicker.tsx      Per-role swatch and assignment popover
    site/                The demo page
  styles/
    tokens.css   Scheme-invariant: spacing, type, radii, motion
    global.css   Reset and base elements
    app.css      Tool chrome and control panel
    site.css     Demo page. Role tokens only, never a literal color.
scripts/
  verify-export.mjs   Structural checks, run against real generator output
  verify-entry.ts     Bundled for Node by rsbuild.verify.config.ts
```

The color engine is dependency-free and pure. `deriveScheme()` is the single place
where a base color becomes a palette and a palette becomes themes, and it is
memoized on the scheme state — which is enough to keep the page responsive while
controls are dragged (≈5 ms per interaction in a production build).

---

## Notes

- The demo brand *Meridian* is fictional. All content is placeholder copy.
- The scheme is generated in your browser and never leaves it.