/**
 * Export smoke test.
 *
 * The exported stylesheet is this app's main output, so it is checked
 * structurally instead of trusted. The real generator runs in the browser bundle
 * and its output is verified here.
 *
 *   pnpm verify
 *
 * What it asserts:
 *  - The stylesheet parses: comments and braces balanced.
 *  - No comment opener appears inside a comment body, which would close the
 *    comment early and turn the rest of the file into live CSS.
 *  - Every theme block declares all nineteen role tokens.
 *  - Selectors are unique, so no block silently overrides another.
 *  - The invariant layer carries no color and is not truncated by the parse.
 */

import { execFileSync } from 'node:child_process';

const failures = [];
const check = (label, condition, detail = '') => {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    console.log(`  FAIL ${label}${detail ? ` \u2014 ${detail}` : ''}`);
    failures.push(label);
  }
};

/* ------------------------------------------------------------------ */
/* Structural analysis                                                 */
/* ------------------------------------------------------------------ */

/**
 * Walk the file the way a CSS tokenizer does. CSS comments do not nest, so the
 * first closing delimiter wins and anything after it is live CSS. Testing for an
 * opener inside a comment body is therefore not pedantry: it is exactly how a
 * template that mentions a comment in prose silently corrupts its own output.
 */
function commentProblems(css) {
  const problems = [];
  let index = 0;

  while (index < css.length) {
    const open = css.indexOf('/*', index);
    if (open === -1) break;

    const close = css.indexOf('*/', open + 2);
    if (close === -1) {
      problems.push('unterminated comment');
      break;
    }
    if (css.slice(open + 2, close).includes('/*')) {
      problems.push(`nested comment opener at offset ${open}`);
    }
    index = close + 2;
  }

  return problems;
}

function braceBalance(css) {
  const stripped = css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/"(?:[^"\\]|\\.)*"/g, '""');

  let depth = 0;
  let lowest = 0;
  for (const char of stripped) {
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      lowest = Math.min(lowest, depth);
    }
  }
  return { depth, lowest };
}

/** Top-level rule blocks: selector plus declaration body. */
function ruleBlocks(css) {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selector: (match[1] ?? '').replace(/\s+/g, ' ').trim(),
    body: match[2] ?? '',
  }));
}

const declaredNames = (body) =>
  new Set([...body.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((m) => (m[1] ?? '').toLowerCase()));

const COLOR_LITERAL = /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(|\b(?:red|blue|green|white|black|orange|purple)\b/i;

/** WCAG AA for normal-size text. Kept here so the message is self-describing. */
const AA_TEXT_MIN = 4.5;

/* ------------------------------------------------------------------ */
/* Load the real generator output                                      */
/* ------------------------------------------------------------------ */

console.log('\nverify-export');

// The browser bundle is the only place the TypeScript sources can run, so build
// it with the project's own toolchain and then execute it under Node.
execFileSync('pnpm', ['exec', 'rsbuild', 'build', '-c', 'rsbuild.verify.config.ts'], {
  stdio: 'ignore',
});

const bundle = JSON.parse(
  execFileSync('node', ['.verify/verify.js'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }),
);

/**
 * Role names, taken from the bundle rather than restated here, so the checks
 * follow the contract instead of drifting away from it.
 */
const ROLE_TOKENS = bundle.roles;

/* ------------------------------------------------------------------ */

console.log('\ninvariant layer');
{
  const block = bundle.invariantCss;
  check('parsed from tokens.css', bundle.invariantCount > 40, `got ${bundle.invariantCount}`);
  check('no doubled semicolons', !block.includes(';;'));
  check('multi-line values survive', block.includes('"Helvetica Neue"'), 'font-sans was truncated');
  check('var() recipes excluded', !block.includes('var('), 'a token referencing another leaked in');
  check('declares no color', !COLOR_LITERAL.test(block), 'a color literal leaked in');
  check(
    'reduced-motion block emitted',
    bundle.reducedMotion.includes('prefers-reduced-motion'),
  );
}

console.log('\nexport structure');
for (const sample of bundle.samples) {
  for (const scope of ['global', 'class', 'attribute']) {
    const css = sample.byScope[scope];
    const tag = `${sample.name} (${scope})`;

    const comments = commentProblems(css);
    check(`${tag}: comments well formed`, comments.length === 0, comments.join('; '));

    const braces = braceBalance(css);
    check(`${tag}: braces balanced`, braces.depth === 0 && braces.lowest === 0, `depth ${braces.depth}`);

    const blocks = ruleBlocks(css).filter((block) => !block.selector.startsWith('@'));
    check(`${tag}: has theme blocks`, blocks.length >= 2, `found ${blocks.length}`);

    // Every block that looks like a theme must carry the full contract.
    const themes = blocks.filter((block) => block.body.includes('--surface:'));
    const gaps = [];
    for (const block of themes) {
      const names = declaredNames(block.body);
      for (const role of ROLE_TOKENS) {
        if (!names.has(`--${role}`)) gaps.push(`${block.selector} -> --${role}`);
      }
    }
    check(
      `${tag}: ${themes.length} theme blocks declare all ${ROLE_TOKENS.length} roles`,
      themes.length > 0 && gaps.length === 0,
      gaps.slice(0, 3).join(', '),
    );

    // No two theme blocks may resolve to the same selector, or one wins silently.
    const selectors = themes.map((block) => block.selector.split(',').pop()?.trim());
    check(
      `${tag}: selectors unique`,
      new Set(selectors).size === selectors.length,
      selectors.find((s, i) => selectors.indexOf(s) !== i) ?? '',
    );
  }
}

console.log('\ntailwind export');
{
  const tw = bundle.tailwind;
  check('uses @theme', tw.includes('@theme {'));
  check('dark tone on .dark', tw.includes('.dark {'));
  check('role names namespaced', tw.includes('--color-surface:'));

  // Every role must appear under the --color- namespace. A raw `--surface:`
  // would create a dead custom property that no utility reads.
  const rawRole = new RegExp(
    `(?:^|[;{\\s])--(?!color-)(${ROLE_TOKENS.join('|')})\\s:`,
    'gm',
  );
  const offenders = [...tw.matchAll(rawRole)].map((match) => match[1]);
  check(
    'no role token is emitted outside the --color- namespace',
    offenders.length === 0,
    offenders.slice(0, 4).join(', '),
  );
  check('comments well formed', commentProblems(tw).length === 0, commentProblems(tw).join('; '));
  check('braces balanced', braceBalance(tw).depth === 0);
}

console.log('\nsolver guarantee');
{
  const probe = bundle.solverProbe;
  const sample = probe.failures.slice(0, 5).map((f) => JSON.stringify(f));
  check(
    `text roles clear ${AA_TEXT_MIN}:1 on every surface they are solved for`,
    probe.failures.length === 0,
    `${probe.failures.length} of ${probe.checked} pairs failed. e.g. ${sample.join(' ')}`,
  );
}

console.log('\nink guarantee');
{
  const probe = bundle.solverProbe;
  const sample = probe.inkFailures.slice(0, 4).map((f) => JSON.stringify(f));
  check(
    'every swatch gets an ink that clears 4.5:1',
    probe.inkFailures.length === 0,
    `${probe.inkFailures.length} of ${probe.inkChecked} swatches failed. e.g. ${sample.join(' ')}`,
  );
}

console.log('\ncontract checker');
{
  const complete = bundle.contract.complete;
  const result = bundle.contract.result;
  check('accepts a complete stylesheet', result.compatible === true, JSON.stringify(result.missing));
  check('reports all roles present', result.present.length === ROLE_TOKENS.length);

  const partial = bundle.contract.partialResult;
  check('rejects an incomplete stylesheet', partial.compatible === false);
  check('names what is missing', partial.missing.includes('--focus-ring'));
  check(
    'counts only missing, not present',
    partial.missing.length + partial.present.length === ROLE_TOKENS.length,
  );
  void complete;
}

console.log(
  failures.length === 0
    ? '\nAll checks passed.\n'
    : `\n${failures.length} check(s) failed:\n${failures.map((f) => `  - ${f}`).join('\n')}\n`,
);

process.exit(failures.length === 0 ? 0 : 1);